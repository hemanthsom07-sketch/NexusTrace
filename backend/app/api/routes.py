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
    """Real, computed validation summary for the upload UI -- record counts,
    which required fields were actually detected, and how many TXIDs the two
    sides share (informational only -- this does NOT feed the correlation
    engine, which still matches on timestamp proximity as before)."""
    network_fields = _fields_present(raw_network)
    tx_fields = _fields_present(raw_tx)

    missing_network = [f for f in REQUIRED_NETWORK_FIELDS if f not in network_fields]
    missing_blockchain = [f for f in REQUIRED_BLOCKCHAIN_FIELDS if f not in tx_fields]

    network_txids = {row.get("txid") for row in raw_network if row.get("txid")}
    tx_txids = {row.get("txid") for row in raw_tx if row.get("txid")}
    matching_txids = len(network_txids & tx_txids) if network_txids and tx_txids else None

    return {
        "valid": bool(raw_network) and bool(raw_tx) and not missing_network and not missing_blockchain,
        "network_records": len(raw_network),
        "blockchain_records": len(raw_tx),
        "matching_txids": matching_txids,
        "detected_network_fields": sorted(network_fields),
        "detected_blockchain_fields": sorted(tx_fields),
        "missing_network_fields": missing_network,
        "missing_blockchain_fields": missing_blockchain,
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
    events, skipped_events = normalize_network_events(raw_network)
    transactions, skipped_tx = normalize_transactions(raw_tx)
    links = correlate(events, transactions)
    events_by_id = {e.event_id: e for e in events}
    links = score_links(links, events_by_id)
    g = build_graph(events, transactions, links)
    feature_df = extract_features(transactions, g)
    scored_df = score_anomalies(feature_df)
    reasons = generate_reasons(scored_df)

    tx_by_wallet = {}
    for tx in transactions:
        for addr in tx.input_addresses + tx.output_addresses:
            tx_by_wallet.setdefault(addr, set()).add(tx.txid)

    ip_by_wallet = {}
    for link in links:
        ev = events_by_id.get(link.network_event_id)
        tx = next((t for t in transactions if t.txid == link.txid), None)
        if ev and tx:
            for addr in tx.input_addresses + tx.output_addresses:
                ip_by_wallet.setdefault(addr, set()).add(ev.src_ip)

    leads = []
    wallet_risk = {}
    for _, row in scored_df.iterrows():
        wallet = row["wallet"]
        anomaly_score = round(float(row["anomaly_score"]), 4)
        severity = severity_for(row["anomaly_score"])
        wallet_risk[wallet] = {"anomaly_score": anomaly_score, "severity": severity}
        leads.append({
            "wallet": wallet, "anomaly_score": anomaly_score, "severity": severity,
            "reasons": reasons.get(wallet, []),
            "related_txids": sorted(tx_by_wallet.get(wallet, [])),
            "related_ips": sorted(ip_by_wallet.get(wallet, [])),
            "feature_snapshot": {k: v for k, v in row.items() if k not in ("wallet", "raw_score", "anomaly_score")},
        })

    evidence_by_txid = {}
    for link in links:
        ev = events_by_id.get(link.network_event_id)
        if ev:
            evidence_by_txid.setdefault(link.txid, []).append({
                "ip": ev.src_ip, "port": ev.src_port, "time_delta_seconds": link.time_delta_seconds,
                "confidence": link.confidence, "evidence": link.evidence,
            })

    tx_records = []
    for tx in transactions:
        tx_evidence = sorted(evidence_by_txid.get(tx.txid, []), key=lambda e: (e["confidence"] or 0.0), reverse=True)
        primary = tx_evidence[0] if tx_evidence else None
        tx_records.append({
            "txid": tx.txid, "timestamp": tx.timestamp, "input_addresses": tx.input_addresses,
            "output_addresses": tx.output_addresses, "input_amounts": tx.input_amounts,
            "output_amounts": tx.output_amounts, "fee": tx.fee, "script_type": tx.script_type,
            "btc_amount": round(sum(tx.output_amounts), 8) if tx.output_amounts else 0.0,
            "correlated_ip": primary["ip"] if primary else None,
            "confidence": primary["confidence"] if primary else None,
            "correlation_evidence": tx_evidence,
        })

    db.replace_leads(leads)
    db.save_transactions(tx_records)
    db.save_graph(to_json_graph(g, wallet_risk))

    return {
        "status": "ok",
        "events_ingested": len(events), "events_skipped": len(skipped_events),
        "transactions_ingested": len(transactions), "transactions_skipped": len(skipped_tx),
        "links_found": len(links), "leads_generated": len(leads),
    }

@router.post("/api/pipeline/run")
def run_pipeline():
    raw_network = parse_csv(DEFAULT_SAMPLE_NETWORK_CSV)
    raw_tx = parse_json(DEFAULT_SAMPLE_TX_JSON)
    return execute_pipeline(raw_network, raw_tx)

@router.post("/api/pipeline/upload")
async def upload_pipeline(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8")
    fname = file.filename.lower()
    if fname.endswith(".csv"):
        raw_network = parse_csv(content, is_raw_str=True)
        raw_tx = parse_json(DEFAULT_SAMPLE_TX_JSON)
    elif fname.endswith(".json"):
        raw_network = parse_csv(DEFAULT_SAMPLE_NETWORK_CSV)
        raw_tx = parse_json(content, is_raw_str=True)
    elif fname.endswith(".xml"):
        raw_network = parse_xml(content, is_raw_str=True)
        raw_tx = parse_json(DEFAULT_SAMPLE_TX_JSON)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV, JSON, or XML.")
    return execute_pipeline(raw_network, raw_tx)

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
        "ip": ip, "classification": "private" if geo["is_private"] else "public",
        "country": geo["country"], "region": geo["region"], "city": geo["city"],
        "latitude": geo["latitude"], "longitude": geo["longitude"],
        "asn": geo["asn"], "org": geo["org"],
        "geoip_available": geo["available"], "geoip_status": geo["status"],
        "connected_transactions": sorted({tx["txid"] for tx in connected_tx}),
        "connected_wallets": connected_wallets,
    }