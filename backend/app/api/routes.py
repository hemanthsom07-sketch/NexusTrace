"""
api/routes.py -- Phase 10.1 & Cyber Intelligence Extension

Endpoints:
  POST /api/pipeline/run          -- re-run pipeline with sample files (or custom paths)
  POST /api/pipeline/upload       -- upload CSV & JSON directly from the browser
  GET  /api/leads                 -- ranked list of investigation leads
  GET  /api/leads/{wallet}        -- one lead's full detail with GeoIP
  GET  /api/graph                 -- complete entity graph
  GET  /api/graph/subgraph/{id}   -- ego-network subgraph around an entity (hops=1 or 2)
  GET  /api/stats                 -- executive intelligence summary metrics
  GET  /api/transactions          -- all transactions ledger
  GET  /api/transactions/{txid}   -- single transaction detail with correlation evidence
"""
import io
import os
import time
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Optional

from app.config import DEFAULT_SAMPLE_NETWORK_CSV, DEFAULT_SAMPLE_TX_JSON, DATA_DIR
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


def _process_and_persist(raw_network: list[dict], raw_tx: list[dict]) -> dict:
    """Core pipeline execution shared by run and upload endpoints."""
    events, skipped_events = normalize_network_events(raw_network)
    transactions, skipped_tx = normalize_transactions(raw_tx)

    links = correlate(events, transactions)
    events_by_id = {e.event_id: e for e in events}
    links = score_links(links, events_by_id)

    g = build_graph(events, transactions, links)
    feature_df = extract_features(transactions, g)
    scored_df = score_anomalies(feature_df)
    reasons = generate_reasons(scored_df)

    # Performance optimization: index transactions by txid (eliminates O(N) linear scans)
    tx_by_id = {tx.txid: tx for tx in transactions}

    # Map transactions and IPs per wallet
    tx_by_wallet: dict[str, set] = {}
    for tx in transactions:
        for addr in tx.input_addresses + tx.output_addresses:
            tx_by_wallet.setdefault(addr, set()).add(tx.txid)

    ip_by_wallet: dict[str, set] = {}
    tx_links_map: dict[str, list] = {}
    for link in links:
        tx_links_map.setdefault(link.txid, []).append(link)
        ev = events_by_id.get(link.network_event_id)
        if not ev:
            continue
        tx = tx_by_id.get(link.txid)
        if not tx:
            continue
        for addr in tx.input_addresses + tx.output_addresses:
            ip_by_wallet.setdefault(addr, set()).add(ev.src_ip)

    # Score lookup for nodes
    score_by_wallet = {row["wallet"]: float(row["anomaly_score"]) for _, row in scored_df.iterrows()}

    # Construct leads with GeoIP enrichment
    leads = []
    high_count = 0
    med_count = 0
    low_count = 0

    for _, row in scored_df.iterrows():
        wallet = row["wallet"]
        sev = severity_for(row["anomaly_score"])
        if sev == "HIGH":
            high_count += 1
        elif sev == "MEDIUM":
            med_count += 1
        else:
            low_count += 1

        wallet_ips = sorted(ip_by_wallet.get(wallet, []))
        leads.append({
            "wallet": wallet,
            "anomaly_score": round(float(row["anomaly_score"]), 4),
            "severity": sev,
            "reasons": reasons.get(wallet, []),
            "related_txids": sorted(tx_by_wallet.get(wallet, [])),
            "related_ips": wallet_ips,
            "related_ips_details": [lookup_ip(ip) for ip in wallet_ips],
            "feature_snapshot": {
                k: v for k, v in row.items()
                if k not in ("wallet", "raw_score", "anomaly_score")
            },
        })

    # Prepare transaction records
    tx_records = []
    total_out_btc = 0.0
    total_in_btc = 0.0

    for tx in transactions:
        tx_corr_links = tx_links_map.get(tx.txid, [])
        corr_ips = []
        for l in tx_corr_links:
            ev = events_by_id.get(l.network_event_id)
            if ev and ev.src_ip not in corr_ips:
                corr_ips.append(ev.src_ip)

        c_max = max([l.confidence or 0.0 for l in tx_corr_links], default=0.0)
        evidence_list = [l.evidence for l in tx_corr_links if l.evidence]
        out_sum = sum(tx.output_amounts or [0.0])
        in_sum = sum(tx.input_amounts or [0.0])
        total_out_btc += out_sum
        total_in_btc += in_sum

        tx_records.append({
            "txid": tx.txid,
            "timestamp": tx.timestamp,
            "input_addresses": tx.input_addresses,
            "output_addresses": tx.output_addresses,
            "input_amounts": tx.input_amounts,
            "output_amounts": tx.output_amounts,
            "fee": tx.fee,
            "script_type": tx.script_type,
            "correlated_ips": corr_ips,
            "confidence_max": round(c_max, 3),
            "evidence": evidence_list,
        })

    # Enrich graph nodes with metadata (scores for wallets, geoip for ips)
    graph_dict = to_json_graph(g)
    for node in graph_dict.get("nodes", []):
        nid = node.get("id", "")
        if nid.startswith("wallet:"):
            w_addr = nid.replace("wallet:", "")
            node["anomaly_score"] = round(score_by_wallet.get(w_addr, 0.0), 4)
            node["severity"] = severity_for(score_by_wallet.get(w_addr, 0.0))
        elif nid.startswith("ip:"):
            ip_addr = nid.replace("ip:", "")
            geo = lookup_ip(ip_addr)
            node["country"] = geo.get("country")
            node["city"] = geo.get("city")
            node["asn"] = geo.get("asn")
            node["org"] = geo.get("org")
            node["is_private"] = geo.get("is_private")

    # Persist all data
    db.replace_leads(leads)
    db.replace_transactions(tx_records)
    db.save_graph(graph_dict)

    summary_stats = {
        "status": "ok",
        "events_ingested": len(events),
        "events_skipped": len(skipped_events),
        "transactions_ingested": len(transactions),
        "transactions_skipped": len(skipped_tx),
        "links_found": len(links),
        "leads_generated": len(leads),
        "wallets_count": len(leads),
        "high_risk_count": high_count,
        "medium_risk_count": med_count,
        "low_risk_count": low_count,
        "total_out_btc": round(total_out_btc, 4),
        "total_in_btc": round(total_in_btc, 4),
        "graph_nodes": len(graph_dict.get("nodes", [])),
        "graph_edges": len(graph_dict.get("edges", [])),
        "last_updated": time.time(),
    }
    db.save_pipeline_meta(summary_stats)
    return summary_stats


@router.post("/api/pipeline/run")
def run_pipeline(network_csv: str = None, tx_json: str = None):
    """Runs pipeline against sample data or specified local files."""
    network_csv = network_csv or DEFAULT_SAMPLE_NETWORK_CSV
    tx_json = tx_json or DEFAULT_SAMPLE_TX_JSON

    try:
        raw_network = parse_csv(network_csv)
        raw_tx = parse_json(tx_json)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return _process_and_persist(raw_network, raw_tx)


@router.post("/api/pipeline/upload")
async def upload_pipeline(
    network_csv: Optional[UploadFile] = File(None),
    tx_json: Optional[UploadFile] = File(None),
):
    """Accepts uploaded CSV and JSON files directly from the browser."""
    import csv, json

    raw_network = None
    raw_tx = None

    if network_csv and network_csv.filename:
        content = await network_csv.read()
        text = content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        raw_network = []
        for i, row in enumerate(reader):
            row["_source_row"] = i
            raw_network.append(row)

    if tx_json and tx_json.filename:
        content = await tx_json.read()
        text = content.decode("utf-8", errors="replace")
        data = json.loads(text)
        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="Transaction JSON must be an array of objects.")
        for i, row in enumerate(data):
            row["_source_row"] = i
        raw_tx = data

    # Fall back to defaults if one or both not uploaded
    if raw_network is None:
        raw_network = parse_csv(DEFAULT_SAMPLE_NETWORK_CSV)
    if raw_tx is None:
        raw_tx = parse_json(DEFAULT_SAMPLE_TX_JSON)

    return _process_and_persist(raw_network, raw_tx)


@router.get("/api/stats")
def get_stats():
    """Executive KPI metrics computed from the current intelligence dataset."""
    meta = db.get_pipeline_meta()
    if meta:
        return meta

    leads = db.get_all_leads()
    graph = db.get_graph()
    txs = db.get_all_transactions()

    high_c = sum(1 for l in leads if l.get("severity") == "HIGH")
    med_c = sum(1 for l in leads if l.get("severity") == "MEDIUM")
    low_c = sum(1 for l in leads if l.get("severity") == "LOW")
    total_out = sum(sum(t.get("output_amounts", [])) for t in txs)

    return {
        "status": "ready" if leads else "empty",
        "wallets_count": len(leads),
        "high_risk_count": high_c,
        "medium_risk_count": med_c,
        "low_risk_count": low_c,
        "transactions_ingested": len(txs),
        "graph_nodes": len(graph.get("nodes", [])) if graph else 0,
        "graph_edges": len(graph.get("edges", [])) if graph else 0,
        "total_out_btc": round(total_out, 4),
        "last_updated": time.time(),
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
    # Attach GeoIP details if missing
    if "related_ips_details" not in lead:
        lead["related_ips_details"] = [lookup_ip(ip) for ip in lead.get("related_ips", [])]
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


@router.get("/api/graph/subgraph/{entity_id}")
def get_subgraph(entity_id: str, hops: int = Query(1, ge=1, le=3)):
    """Returns focused ego-network subgraph around an entity."""
    subgraph = db.get_subgraph(entity_id, hops=hops)
    if not subgraph:
        raise HTTPException(status_code=404, detail=f"No graph data found for entity '{entity_id}'")
    return subgraph


@router.get("/api/transactions")
def get_transactions():
    """Returns all ingested transactions."""
    return db.get_all_transactions()


@router.get("/api/transactions/{txid}")
def get_transaction_detail(txid: str):
    """Returns detail for one transaction including correlation evidence."""
    tx = db.get_transaction(txid)
    if not tx:
        raise HTTPException(status_code=404, detail=f"No transaction found with id '{txid}'")
    return tx

