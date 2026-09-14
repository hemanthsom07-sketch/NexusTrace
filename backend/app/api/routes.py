from fastapi import APIRouter, HTTPException, UploadFile, File
from app.config import DEFAULT_SAMPLE_NETWORK_CSV, DEFAULT_SAMPLE_TX_JSON
from app.ingestion.parsers import parse_csv, parse_json, parse_xml
from app.ingestion.normalize import normalize_network_events, normalize_transactions
from app.correlation.matcher import correlate
from app.correlation.confidence import score_links
from app.graph.builder import build_graph, to_json_graph
from app.features.extract import extract_features
from app.ml.anomaly import score_anomalies
from app.ml.clustering import perform_common_input_clustering
from app.explain.reasons import generate_reasons, severity_for
from app.geoip.lookup import lookup_ip
from app.storage import db

router = APIRouter()

# --- Phase A: dual-file / merged-file upload support -----------------------
# These helpers are only used by the two NEW endpoints below
# (/api/pipeline/upload-dual, /api/pipeline/upload-merged). The existing
# /api/pipeline/upload endpoint is untouched -- both new endpoints still
# call the same execute_pipeline() as everything else, so there is exactly
# one analysis pipeline, not two.

REQUIRED_NETWORK_FIELDS = ["timestamp", "src_ip", "dst_ip", "src_port", "dst_port"]
REQUIRED_BLOCKCHAIN_FIELDS = ["timestamp", "txid", "input_addresses", "output_addresses"]


def _parse_uploaded_file(content_bytes: bytes, filename: str) -> list[dict]:
    content = content_bytes.decode("utf-8")
    fname = (filename or "").lower()
    if fname.endswith(".csv"):
        return parse_csv(content, is_raw_str=True)
    if fname.endswith(".json"):
        return parse_json(content, is_raw_str=True)
    if fname.endswith(".xml"):
        return parse_xml(content, is_raw_str=True)
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported file format for '{filename}'. Please upload CSV, JSON, or XML.",
    )


def _fields_present(rows: list[dict]) -> set:
    fields = set()
    for row in rows[:50]:  # a sample is enough to know which columns exist
        fields.update(k for k in row.keys() if not str(k).startswith("_"))
    return fields


def _validate_dataset(raw_network: list[dict], raw_tx: list[dict]) -> dict:
    """Validate both dataset structure and actual row parseability.

    Header/field presence alone is not enough: a file can contain every
    required column while all of its records are malformed. Validation
    therefore runs the same normalizers used by execute_pipeline() and
    requires at least one successfully parsed network event and one
    successfully parsed blockchain transaction.
    """
    network_fields = _fields_present(raw_network)
    tx_fields = _fields_present(raw_tx)

    missing_network = [
        f for f in REQUIRED_NETWORK_FIELDS
        if f not in network_fields
    ]

    missing_blockchain = [
        f for f in REQUIRED_BLOCKCHAIN_FIELDS
        if f not in tx_fields
    ]

    network_txids = {
        str(row.get("txid")).strip()
        for row in raw_network
        if row.get("txid")
    }

    tx_txids = {
        str(row.get("txid")).strip()
        for row in raw_tx
        if row.get("txid")
    }

    matching_txids = (
        len(network_txids & tx_txids)
        if network_txids and tx_txids
        else None
    )

    # Use the exact same normalizers as the real pipeline so validation
    # cannot report success for data that the pipeline itself cannot ingest.
    parsed_network, skipped_network = normalize_network_events(raw_network)
    parsed_transactions, skipped_transactions = normalize_transactions(raw_tx)

    network_parseable = len(parsed_network)
    blockchain_parseable = len(parsed_transactions)

    structurally_valid = (
        bool(raw_network)
        and bool(raw_tx)
        and not missing_network
        and not missing_blockchain
    )

    parseable = (
        network_parseable > 0
        and blockchain_parseable > 0
    )

    valid = structurally_valid and parseable

    return {
        "valid": valid,

        "network_records": len(raw_network),
        "blockchain_records": len(raw_tx),

        "network_parseable_records": network_parseable,
        "blockchain_parseable_records": blockchain_parseable,

        "network_unparseable_records": len(skipped_network),
        "blockchain_unparseable_records": len(skipped_transactions),

        "matching_txids": matching_txids,

        "detected_network_fields": sorted(network_fields),
        "detected_blockchain_fields": sorted(tx_fields),

        "missing_network_fields": missing_network,
        "missing_blockchain_fields": missing_blockchain,

        "network_validation_errors": skipped_network[:20],
        "blockchain_validation_errors": skipped_transactions[:20],
    }


def _split_merged_rows(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """Splits a merged file's rows into network-shaped and blockchain-shaped
    rows by field presence. Handles either layout: rows that already combine
    both field sets (each becomes both a network AND a blockchain row), or a
    file that's a mix of separately-shaped rows -- the two checks below are
    independent, not mutually exclusive, so both cases work without knowing
    in advance which one a given file uses."""
    network_rows, tx_rows = [], []
    for i, row in enumerate(rows):
        src_row = row.get("_source_row", i)
        has_network = bool(row.get("src_ip"))
        has_blockchain = bool(row.get("txid")) and (row.get("input_addresses") or row.get("output_addresses"))

        if has_network:
            network_rows.append({
                "_source_row": src_row,
                "timestamp": row.get("timestamp"),
                "src_ip": row.get("src_ip"),
                "dst_ip": row.get("dst_ip"),
                "src_port": row.get("src_port"),
                "dst_port": row.get("dst_port"),
                "txid": row.get("txid"),  # not read by normalize_network_events; kept only so
                                          # _validate_dataset can report a real matching-TXIDs count
            })
        if has_blockchain:
            tx_rows.append({
                "_source_row": src_row,
                "timestamp": row.get("timestamp"),
                "txid": row.get("txid"),
                "input_addresses": row.get("input_addresses"),
                "output_addresses": row.get("output_addresses"),
                "input_amounts": row.get("input_amounts"),
                "output_amounts": row.get("output_amounts"),
                "fee": row.get("fee"),
                "script_type": row.get("script_type"),
            })
    return network_rows, tx_rows

def execute_pipeline(raw_network: list[dict], raw_tx: list[dict]):
    db.init_db()

    events, skipped_events = normalize_network_events(raw_network)
    transactions, skipped_tx = normalize_transactions(raw_tx)

    links = correlate(events, transactions)

    events_by_id = {e.event_id: e for e in events}
    tx_by_id = {tx.txid: tx for tx in transactions}

    links = score_links(links, events_by_id)

    # Preserve source-row provenance directly on every correlation link.
    # This allows the correlation object itself to point back to the
    # original network and blockchain dataset rows.
    for link in links:
        ev = events_by_id.get(link.network_event_id)
        tx = tx_by_id.get(link.txid)

        link.evidence_refs = []

        if ev and ev.source_row is not None:
            link.evidence_refs.append(
                f"network:row:{ev.source_row}"
            )

        if tx and tx.source_row is not None:
            link.evidence_refs.append(
                f"blockchain:row:{tx.source_row}"
            )

    g = build_graph(events, transactions, links)

    feature_df = extract_features(transactions, g)
    scored_df = score_anomalies(feature_df)
    reasons = generate_reasons(scored_df)

    # Wallet -> transaction relationships.
    tx_by_wallet = {}

    for tx in transactions:
        for addr in tx.input_addresses + tx.output_addresses:
            tx_by_wallet.setdefault(addr, set()).add(tx.txid)

    # Wallet -> observed network IP relationships.
    ip_by_wallet = {}

    for link in links:
        ev = events_by_id.get(link.network_event_id)
        tx = tx_by_id.get(link.txid)

        if ev and tx:
            for addr in tx.input_addresses + tx.output_addresses:
                ip_by_wallet.setdefault(addr, set()).add(ev.src_ip)

    # Entity clustering is a forensic heuristic, not an ML model.
    clusters = perform_common_input_clustering(transactions)

    cluster_records = []
    cluster_by_wallet = {}

    for cluster in clusters:
        record = cluster.to_dict()

        record["associated_ips"] = sorted({
            ip
            for wallet in cluster.wallets
            for ip in ip_by_wallet.get(wallet, set())
        })

        cluster_records.append(record)

        for wallet in cluster.wallets:
            cluster_by_wallet[wallet] = record

    # Generate investigation leads.
    leads = []
    wallet_risk = {}

    for _, row in scored_df.iterrows():
        wallet = row["wallet"]

        anomaly_score = round(
            float(row["anomaly_score"]),
            4,
        )

        severity = severity_for(row["anomaly_score"])

        wallet_risk[wallet] = {
            "anomaly_score": anomaly_score,
            "severity": severity,
        }

        leads.append({
            "wallet": wallet,
            "anomaly_score": anomaly_score,
            "severity": severity,
            "reasons": reasons.get(wallet, []),
            "related_txids": sorted(
                tx_by_wallet.get(wallet, [])
            ),
            "related_ips": sorted(
                ip_by_wallet.get(wallet, [])
            ),
            "feature_snapshot": {
                k: v
                for k, v in row.items()
                if k not in (
                    "wallet",
                    "raw_score",
                    "anomaly_score",
                )
            },
            "cluster_id": cluster_by_wallet.get(
                wallet,
                {},
            ).get("cluster_id"),
        })

    # Cross-layer evidence indexed by transaction.
    evidence_by_txid = {}

    for link in links:
        ev = events_by_id.get(link.network_event_id)
        tx = tx_by_id.get(link.txid)

        if not ev:
            continue

        evidence_by_txid.setdefault(
            link.txid,
            [],
        ).append({
            "ip": ev.src_ip,
            "port": ev.src_port,

            # Preserve the actual timestamps from both datasets.
            "network_timestamp": ev.timestamp,
            "transaction_timestamp": (
                tx.timestamp if tx else None
            ),

            # Preserve original source rows.
            "network_source_row": ev.source_row,
            "transaction_source_row": (
                tx.source_row if tx else None
            ),

            "time_delta_seconds": link.time_delta_seconds,
            "confidence": link.confidence,
            "evidence": link.evidence,

            # Use the provenance stored directly on the link.
            "evidence_refs": list(link.evidence_refs),
        })

    # Save every ingested transaction, including transactions that may not
    # have a network correlation.
    tx_records = []

    for tx in transactions:
        tx_evidence = evidence_by_txid.get(tx.txid, [])

        primary = (
            max(
                tx_evidence,
                key=lambda item: item.get("confidence") or 0.0,
            )
            if tx_evidence
            else None
        )

        tx_records.append({
            "txid": tx.txid,
            "timestamp": tx.timestamp,
            "input_addresses": tx.input_addresses,
            "output_addresses": tx.output_addresses,
            "input_amounts": tx.input_amounts,
            "output_amounts": tx.output_amounts,
            "fee": tx.fee,
            "script_type": tx.script_type,
            "source_row": tx.source_row,

            "btc_amount": round(
                sum(tx.output_amounts),
                8,
            ) if tx.output_amounts else 0.0,

            "correlated_ip": (
                primary["ip"]
                if primary
                else None
            ),

            "confidence": (
                primary["confidence"]
                if primary
                else None
            ),

            "correlation_evidence": tx_evidence,
        })

    db.replace_leads(leads)
    db.replace_clusters(cluster_records)
    db.save_transactions(tx_records)
    db.save_graph(to_json_graph(g, wallet_risk))

    return {
        "status": "ok",
        "events_ingested": len(events),
        "events_skipped": len(skipped_events),
        "transactions_ingested": len(transactions),
        "transactions_skipped": len(skipped_tx),
        "links_found": len(links),
        "leads_generated": len(leads),
        "clusters_generated": len(cluster_records),
    }

@router.post("/api/pipeline/run")
def run_pipeline():
    raw_network = parse_csv(DEFAULT_SAMPLE_NETWORK_CSV)
    raw_tx = parse_json(DEFAULT_SAMPLE_TX_JSON)
    return execute_pipeline(raw_network, raw_tx)

@router.post("/api/pipeline/upload")
async def upload_pipeline(file: UploadFile = File(...)):
    """Legacy single-file entry point. Treat the file as a merged dataset;
    never silently combine user data with the built-in sample dataset."""
    rows = _parse_uploaded_file(await file.read(), file.filename)
    raw_network, raw_tx = _split_merged_rows(rows)
    validation = _validate_dataset(raw_network, raw_tx)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail={"message": "Merged dataset validation failed.", **validation})
    result = execute_pipeline(raw_network, raw_tx)
    result["validation"] = validation
    return result

@router.post("/api/pipeline/upload-dual")
async def upload_pipeline_dual(
    network_file: UploadFile = File(...),
    blockchain_file: UploadFile = File(...),
):
    """Mode A from the ingestion spec: two separate files, one for network
    telemetry and one for blockchain transactions. Feeds the same
    execute_pipeline() as every other entry point -- no second pipeline."""
    raw_network = _parse_uploaded_file(await network_file.read(), network_file.filename)
    raw_tx = _parse_uploaded_file(await blockchain_file.read(), blockchain_file.filename)

    validation = _validate_dataset(raw_network, raw_tx)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail={"message": "Dataset validation failed.", **validation})

    result = execute_pipeline(raw_network, raw_tx)
    result["validation"] = validation
    return result


@router.post("/api/pipeline/upload-merged")
async def upload_pipeline_merged(file: UploadFile = File(...)):
    """Mode B from the ingestion spec: one file containing both layers.
    Rows are split by field presence (see _split_merged_rows), then fed
    through the identical execute_pipeline() -- same pipeline as Mode A and
    the original single-file endpoint, just a different front door."""
    rows = _parse_uploaded_file(await file.read(), file.filename)
    raw_network, raw_tx = _split_merged_rows(rows)

    validation = _validate_dataset(raw_network, raw_tx)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail={"message": "Dataset validation failed.", **validation})

    result = execute_pipeline(raw_network, raw_tx)
    result["validation"] = validation
    return result


@router.get("/api/leads")
def get_leads():
    leads = db.get_all_leads()
    if not leads:
        raise HTTPException(status_code=404, detail="No leads found -- run pipeline first.")
    return leads

@router.get("/api/leads/{wallet}")
def get_lead_detail(wallet: str):
    lead = db.get_lead(wallet)
    if not lead:
        raise HTTPException(status_code=404, detail=f"No lead found for wallet '{wallet}'")
    return lead

@router.get("/api/clusters")
def get_clusters():
    return db.get_all_clusters()

@router.get("/api/clusters/{wallet}")
def get_wallet_cluster(wallet: str):
    cluster = db.get_cluster_for_wallet(wallet)
    if not cluster:
        raise HTTPException(status_code=404, detail=f"No entity cluster found for wallet '{wallet}'")
    return cluster

@router.get("/api/graph")
def get_graph():
    graph = db.get_graph()
    if not graph:
        raise HTTPException(status_code=404, detail="No graph found -- run pipeline first.")
    return graph

@router.get("/api/transactions")
def list_transactions():
    return db.get_all_transactions()

@router.get("/api/transactions/{txid}")
def get_transaction_detail(txid: str):
    tx = db.get_transaction(txid)
    if not tx:
        raise HTTPException(status_code=404, detail=f"Transaction '{txid}' not found.")
    return tx

@router.get("/api/ip/{ip}")
def get_ip_detail(ip: str):
    geo = lookup_ip(ip)
    txs = db.get_all_transactions()
    connected_tx = [tx for tx in txs if any(ev.get("ip") == ip for ev in tx.get("correlation_evidence", []))]
    connected_wallets = sorted({addr for tx in connected_tx for addr in (tx["input_addresses"] + tx["output_addresses"])})
    return {
        "ip": ip,
        "classification": geo.get("network_type") or ("private" if geo["is_private"] else "public"),
        "network_type": geo.get("network_type"),
        "country": geo["country"], "region": geo["region"], "city": geo["city"],
        "latitude": geo["latitude"], "longitude": geo["longitude"],
        "asn": geo["asn"], "org": geo["org"],
        "geoip_available": geo["available"], "geoip_status": geo["status"],
        "geoip_source": geo.get("source"), "prototype": geo.get("prototype", False),
        "connected_transactions": sorted({tx["txid"] for tx in connected_tx}),
        "connected_wallets": connected_wallets,
    }