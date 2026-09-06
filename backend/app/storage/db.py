"""
storage/db.py -- Phase 10.2

Simple SQLite persistence using Python's built-in sqlite3 module -- no
ORM needed at this scale. init_db() creates tables if they don't exist;
safe to call every startup.
"""
import sqlite3
import json
import os
from contextlib import contextmanager
from app.config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    wallet TEXT PRIMARY KEY,
    anomaly_score REAL NOT NULL,
    severity TEXT NOT NULL,
    reasons_json TEXT NOT NULL,
    related_txids_json TEXT NOT NULL,
    related_ips_json TEXT NOT NULL,
    feature_snapshot_json TEXT
);

CREATE TABLE IF NOT EXISTS graph_cache (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    graph_json TEXT NOT NULL,
    updated_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    txid TEXT PRIMARY KEY,
    timestamp REAL NOT NULL,
    input_addresses_json TEXT NOT NULL,
    output_addresses_json TEXT NOT NULL,
    input_amounts_json TEXT NOT NULL,
    output_amounts_json TEXT NOT NULL,
    fee REAL NOT NULL,
    script_type TEXT,
    correlated_ips_json TEXT NOT NULL,
    confidence_max REAL DEFAULT 0.0,
    evidence_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pipeline_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    meta_json TEXT NOT NULL,
    updated_at REAL NOT NULL
);
"""


_db_initialized = False

@contextmanager
def get_conn():
    global _db_initialized
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    if not _db_initialized:
        conn.executescript(SCHEMA)
        conn.commit()
        _db_initialized = True
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    global _db_initialized
    with get_conn() as conn:
        conn.executescript(SCHEMA)
    _db_initialized = True



def replace_leads(leads: list[dict]):
    """Wipe and re-insert all leads -- simplest correct behavior for a
    prototype that re-runs the whole pipeline each time new data loads."""
    with get_conn() as conn:
        conn.execute("DELETE FROM leads")
        for lead in leads:
            conn.execute(
                "INSERT INTO leads (wallet, anomaly_score, severity, reasons_json, "
                "related_txids_json, related_ips_json, feature_snapshot_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    lead["wallet"], lead["anomaly_score"], lead["severity"],
                    json.dumps(lead.get("reasons", [])),
                    json.dumps(lead.get("related_txids", [])),
                    json.dumps(lead.get("related_ips", [])),
                    json.dumps(lead.get("feature_snapshot")) if lead.get("feature_snapshot") else None,
                ),
            )


def get_all_leads() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM leads ORDER BY anomaly_score DESC"
        ).fetchall()
        return [_row_to_lead(r) for r in rows]


def get_lead(wallet: str) -> "dict | None":
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM leads WHERE wallet = ?", (wallet,)
        ).fetchone()
        return _row_to_lead(row) if row else None


def _row_to_lead(row) -> dict:
    return {
        "wallet": row["wallet"],
        "anomaly_score": row["anomaly_score"],
        "severity": row["severity"],
        "reasons": json.loads(row["reasons_json"]),
        "related_txids": json.loads(row["related_txids_json"]),
        "related_ips": json.loads(row["related_ips_json"]),
        "feature_snapshot": json.loads(row["feature_snapshot_json"]) if row["feature_snapshot_json"] else None,
    }


def save_graph(graph_json: dict):
    import time
    with get_conn() as conn:
        conn.execute("DELETE FROM graph_cache")
        conn.execute(
            "INSERT INTO graph_cache (id, graph_json, updated_at) VALUES (1, ?, ?)",
            (json.dumps(graph_json), time.time()),
        )


def get_graph() -> "dict | None":
    with get_conn() as conn:
        row = conn.execute("SELECT graph_json FROM graph_cache WHERE id = 1").fetchone()
        return json.loads(row["graph_json"]) if row else None


def replace_transactions(tx_records: list[dict]):
    with get_conn() as conn:
        conn.execute("DELETE FROM transactions")
        for tx in tx_records:
            conn.execute(
                "INSERT INTO transactions (txid, timestamp, input_addresses_json, "
                "output_addresses_json, input_amounts_json, output_amounts_json, "
                "fee, script_type, correlated_ips_json, confidence_max, evidence_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    tx["txid"], tx["timestamp"],
                    json.dumps(tx.get("input_addresses", [])),
                    json.dumps(tx.get("output_addresses", [])),
                    json.dumps(tx.get("input_amounts", [])),
                    json.dumps(tx.get("output_amounts", [])),
                    float(tx.get("fee", 0.0) or 0.0),
                    tx.get("script_type"),
                    json.dumps(tx.get("correlated_ips", [])),
                    float(tx.get("confidence_max", 0.0) or 0.0),
                    json.dumps(tx.get("evidence", [])),
                ),
            )


def get_all_transactions() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM transactions ORDER BY timestamp DESC").fetchall()
        return [_row_to_tx(r) for r in rows]


def get_transaction(txid: str) -> "dict | None":
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM transactions WHERE txid = ?", (txid,)).fetchone()
        return _row_to_tx(row) if row else None


def _row_to_tx(row) -> dict:
    return {
        "txid": row["txid"],
        "timestamp": row["timestamp"],
        "input_addresses": json.loads(row["input_addresses_json"]),
        "output_addresses": json.loads(row["output_addresses_json"]),
        "input_amounts": json.loads(row["input_amounts_json"]),
        "output_amounts": json.loads(row["output_amounts_json"]),
        "fee": row["fee"],
        "script_type": row["script_type"],
        "correlated_ips": json.loads(row["correlated_ips_json"]),
        "confidence_max": row["confidence_max"],
        "evidence": json.loads(row["evidence_json"]),
    }


def save_pipeline_meta(meta: dict):
    import time
    with get_conn() as conn:
        conn.execute("DELETE FROM pipeline_meta")
        conn.execute(
            "INSERT INTO pipeline_meta (id, meta_json, updated_at) VALUES (1, ?, ?)",
            (json.dumps(meta), time.time()),
        )


def get_pipeline_meta() -> "dict | None":
    with get_conn() as conn:
        row = conn.execute("SELECT meta_json FROM pipeline_meta WHERE id = 1").fetchone()
        return json.loads(row["meta_json"]) if row else None


def get_subgraph(entity_id: str, hops: int = 1) -> "dict | None":
    graph = get_graph()
    if not graph:
        return None

    # Determine root node ID: e.g. "wallet:W_A12", "tx:TX2001", "ip:45.33.1.10"
    target_id = entity_id
    if ":" not in target_id:
        # Check matching id in graph nodes
        matching = [n["id"] for n in graph.get("nodes", []) if n["id"].endswith(f":{target_id}")]
        if matching:
            target_id = matching[0]

    nodes_by_id = {n["id"]: n for n in graph.get("nodes", [])}
    if target_id not in nodes_by_id:
        return {"nodes": [], "edges": []}

    visited_nodes = {target_id}
    current_frontier = {target_id}

    for _ in range(max(1, hops)):
        next_frontier = set()
        for edge in graph.get("edges", []):
            s, t = edge["source"], edge["target"]
            if s in current_frontier:
                next_frontier.add(t)
            if t in current_frontier:
                next_frontier.add(s)
        visited_nodes.update(next_frontier)
        current_frontier = next_frontier

    sub_nodes = [nodes_by_id[nid] for nid in visited_nodes if nid in nodes_by_id]
    sub_edges = [
        e for e in graph.get("edges", [])
        if e["source"] in visited_nodes and e["target"] in visited_nodes
    ]

    return {"nodes": sub_nodes, "edges": sub_edges, "root": target_id}

