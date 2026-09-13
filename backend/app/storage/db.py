import sqlite3
import json
import os
import time
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
CREATE TABLE IF NOT EXISTS transactions_cache (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    transactions_json TEXT NOT NULL,
    updated_at REAL NOT NULL
);
"""

@contextmanager
def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA)

def replace_leads(leads: list[dict]):
    with get_conn() as conn:
        conn.execute("DELETE FROM leads")
        for lead in leads:
            conn.execute(
                "INSERT INTO leads VALUES (?, ?, ?, ?, ?, ?, ?)",
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
        rows = conn.execute("SELECT * FROM leads ORDER BY anomaly_score DESC").fetchall()
        return [{
            "wallet": r["wallet"], "anomaly_score": r["anomaly_score"], "severity": r["severity"],
            "reasons": json.loads(r["reasons_json"]), "related_txids": json.loads(r["related_txids_json"]),
            "related_ips": json.loads(r["related_ips_json"]),
            "feature_snapshot": json.loads(r["feature_snapshot_json"]) if r["feature_snapshot_json"] else None
        } for r in rows]

def get_lead(wallet: str) -> dict:
    with get_conn() as conn:
        r = conn.execute("SELECT * FROM leads WHERE wallet = ?", (wallet,)).fetchone()
        if not r:
            return None
        return {
            "wallet": r["wallet"], "anomaly_score": r["anomaly_score"], "severity": r["severity"],
            "reasons": json.loads(r["reasons_json"]), "related_txids": json.loads(r["related_txids_json"]),
            "related_ips": json.loads(r["related_ips_json"]),
            "feature_snapshot": json.loads(r["feature_snapshot_json"]) if r["feature_snapshot_json"] else None
        }

def save_graph(graph_json: dict):
    with get_conn() as conn:
        conn.execute("DELETE FROM graph_cache")
        conn.execute("INSERT INTO graph_cache VALUES (1, ?, ?)", (json.dumps(graph_json), time.time()))

def get_graph() -> dict:
    with get_conn() as conn:
        r = conn.execute("SELECT graph_json FROM graph_cache WHERE id = 1").fetchone()
        return json.loads(r["graph_json"]) if r else None

def save_transactions(tx_records: list[dict]):
    with get_conn() as conn:
        conn.execute("DELETE FROM transactions_cache")
        conn.execute("INSERT INTO transactions_cache VALUES (1, ?, ?)", (json.dumps(tx_records), time.time()))

def get_all_transactions() -> list[dict]:
    with get_conn() as conn:
        r = conn.execute("SELECT transactions_json FROM transactions_cache WHERE id = 1").fetchone()
        return json.loads(r["transactions_json"]) if r else []

def get_transaction(txid: str) -> dict:
    for tx in get_all_transactions():
        if tx["txid"] == txid:
            return tx
    return None