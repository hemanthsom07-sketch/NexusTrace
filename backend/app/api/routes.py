"""
api/routes.py -- Phase 10.1

Exactly 3 endpoints for the prototype, deliberately kept small:
  GET /api/leads              -- ranked list of investigation leads
  GET /api/leads/{wallet}     -- one lead's full detail
  GET /api/graph              -- nodes/edges for the loaded dataset
  POST /api/pipeline/run      -- re-run the pipeline against the sample data
                                  (a convenience endpoint for the demo --
                                  in a real deployment this would take an
                                  uploaded file instead)

These routes only call functions that were already tested via
scripts/run_pipeline.py -- they don't contain new logic of their own.
"""
import ipaddress

from fastapi import APIRouter, HTTPException

from app.config import DEFAULT_SAMPLE_NETWORK_CSV, DEFAULT_SAMPLE_TX_JSON
from app.ingestion.parsers import parse_csv, parse_json
from app.ingestion.normalize import normalize_network_events, normalize_transactions
from app.correlation.matcher import correlate
from app.correlation.confidence import score_links
from app.graph.builder import build_graph, to_json_graph
from app.features.extract import extract_features
from app.ml.anomaly import score_anomalies
from app.explain.reasons import generate_reasons, severity_for
from app.geoip.lookup import lookup_ip
from app.storage import db

router = APIRouter()


@router.post("/api/pipeline/run")
def run_pipeline(network_csv: str = None, tx_json: str = None):
    """
    Runs the full pipeline against sample data (or the given file paths)
    and persists the results to SQLite. Call this once after starting the
    server (or whenever new data should be loaded) before hitting the
    /api/leads or /api/graph endpoints.
    """
    network_csv = network_csv or DEFAULT_SAMPLE_NETWORK_CSV
    tx_json = tx_json or DEFAULT_SAMPLE_TX_JSON

    try:
        raw_network = parse_csv(network_csv)
        raw_tx = parse_json(tx_json)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    events, skipped_events = normalize_network_events(raw_network)
    transactions, skipped_tx = normalize_transactions(raw_tx)

    links = correlate(events, transactions)
    events_by_id = {e.event_id: e for e in events}
    links = score_links(links, events_by_id)

    g = build_graph(events, transactions, links)
    feature_df = extract_features(transactions, g)
    scored_df = score_anomalies(feature_df)
    reasons = generate_reasons(scored_df)

    # figure out related txids/ips per wallet for the lead detail view
    tx_by_wallet: dict[str, set] = {}
    for tx in transactions:
        for addr in tx.input_addresses + tx.output_addresses:
            tx_by_wallet.setdefault(addr, set()).add(tx.txid)

    ip_by_wallet: dict[str, set] = {}
    for link in links:
        ev = events_by_id.get(link.network_event_id)
        if not ev:
            continue
        tx = next((t for t in transactions if t.txid == link.txid), None)
        if not tx:
            continue
        for addr in tx.input_addresses + tx.output_addresses:
            ip_by_wallet.setdefault(addr, set()).add(ev.src_ip)

    leads = []
    wallet_risk: dict[str, dict] = {}
    for _, row in scored_df.iterrows():
        wallet = row["wallet"]
        anomaly_score = round(float(row["anomaly_score"]), 4)
        severity = severity_for(row["anomaly_score"])
        wallet_risk[wallet] = {"anomaly_score": anomaly_score, "severity": severity}
        leads.append({
            "wallet": wallet,
            "anomaly_score": anomaly_score,
            "severity": severity,
            "reasons": reasons.get(wallet, []),
            "related_txids": sorted(tx_by_wallet.get(wallet, [])),
            "related_ips": sorted(ip_by_wallet.get(wallet, [])),
            "feature_snapshot": {
                k: v for k, v in row.items()
                if k not in ("wallet", "raw_score", "anomaly_score")
            },
        })

    # Per-transaction detail + correlation evidence, built from data the
    # existing correlation/confidence logic already computed above -- no
    # new scoring or matching logic, just reshaped for the API to serve.
    evidence_by_txid: dict[str, list] = {}
    for link in links:
        ev = events_by_id.get(link.network_event_id)
        if not ev:
            continue
        evidence_by_txid.setdefault(link.txid, []).append({
            "ip": ev.src_ip,
            "port": ev.src_port,
            "time_delta_seconds": link.time_delta_seconds,
            "confidence": link.confidence,
            "evidence": link.evidence,
        })

    tx_records = []
    for tx in transactions:
        tx_evidence = sorted(
            evidence_by_txid.get(tx.txid, []),
            key=lambda e: (e["confidence"] or 0.0), reverse=True,
        )
        primary = tx_evidence[0] if tx_evidence else None
        tx_records.append({
            "txid": tx.txid,
            "timestamp": tx.timestamp,
            "input_addresses": tx.input_addresses,
            "output_addresses": tx.output_addresses,
            "input_amounts": tx.input_amounts,
            "output_amounts": tx.output_amounts,
            "fee": tx.fee,
            "script_type": tx.script_type,
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


@router.get("/api/leads")
def get_leads():
    leads = db.get_all_leads()
    if not leads:
        raise HTTPException(
            status_code=404,
            detail="No leads found -- call POST /api/pipeline/run first to load data.",
        )
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
        raise HTTPException(
            status_code=404,
            detail="No graph found -- call POST /api/pipeline/run first to load data.",
        )
    return graph


@router.get("/api/transactions")
def list_transactions():
    """Searchable transaction ledger -- one row per transaction, with the
    primary correlation evidence already resolved (highest-confidence link)
    for a quick-scan column."""
    txs = db.get_all_transactions()
    if not txs:
        raise HTTPException(
            status_code=404,
            detail="No transactions found -- call POST /api/pipeline/run first to load data.",
        )
    return txs


@router.get("/api/transactions/{txid}")
def get_transaction_detail(txid: str):
    """Full transaction detail: inputs/outputs/amounts plus every candidate
    correlation link found for this tx (not just the best one), so the
    investigator can see all the evidence, not a hidden single number."""
    tx = db.get_transaction(txid)
    if not tx:
        raise HTTPException(status_code=404, detail=f"No transaction found for txid '{txid}'")
    return tx


@router.get("/api/ip/{ip}")
def get_ip_detail(ip: str):
    """IP/network intelligence for one address: public/private classification
    (stdlib ipaddress, no new dependency), GeoIP country/ASN if a GeoLite2
    .mmdb file is present (degrades to nulls otherwise -- see app/geoip/
    lookup.py), and every transaction/wallet this IP is correlated with.
    Works even before a pipeline run has produced transactions -- the
    classification/GeoIP part doesn't depend on it.
    """
    try:
        is_private = ipaddress.ip_address(ip).is_private
        classification = "private" if is_private else "public"
    except ValueError:
        classification = "unknown"

    geo = lookup_ip(ip)

    txs = db.get_all_transactions()
    connected_tx = [
        tx for tx in txs
        if any(ev.get("ip") == ip for ev in tx.get("correlation_evidence", []))
    ]
    connected_wallets = sorted({
        addr
        for tx in connected_tx
        for addr in (tx["input_addresses"] + tx["output_addresses"])
    })

    return {
        "ip": ip,
        "classification": classification,
        "country": geo["country"],
        "asn": geo["asn"],
        "geoip_available": geo["available"],
        "connected_transactions": sorted({tx["txid"] for tx in connected_tx}),
        "connected_wallets": connected_wallets,
    }
