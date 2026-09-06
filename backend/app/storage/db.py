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


def save_transactions(tx_records: list[dict]):
    """Persist per-transaction detail (inputs/outputs/amounts + correlation
    evidence) built in api/routes.py from data that's already computed by
    the existing ingestion/correlation logic -- no new business logic here,
    just a place to store it so GET requests can serve it back."""
    import time
    with get_conn() as conn:
        conn.execute("DELETE FROM transactions_cache")
        conn.execute(
            "INSERT INTO transactions_cache (id, transactions_json, updated_at) VALUES (1, ?, ?)",
            (json.dumps(tx_records), time.time()),
        )


def get_all_transactions() -> list[dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT transactions_json FROM transactions_cache WHERE id = 1"
        ).fetchone()
        return json.loads(row["transactions_json"]) if row else []


def get_transaction(txid: str) -> "dict | None":
    for tx in get_all_transactions():
        if tx["txid"] == txid:
            return tx
    return None
