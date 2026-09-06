"""
ingestion/normalize.py -- Phase 2.4

Takes raw dicts from parsers.py and turns them into validated
NetworkEvent / Transaction objects from schemas.py. Broken rows are
logged and skipped -- never silently dropped without a trace, and never
allowed to crash the whole ingestion run.
"""
import logging
from app.schemas import NetworkEvent, Transaction, new_id

logger = logging.getLogger("nexustrace.ingestion")


def normalize_network_events(raw_rows: list[dict]) -> tuple[list[NetworkEvent], list[dict]]:
    """
    Returns (events, skipped) where `skipped` is a list of
    {"row": <original row>, "reason": <why it was skipped>} for anything
    that failed validation -- so the failure is visible, not silent.
    """
    events: list[NetworkEvent] = []
    skipped: list[dict] = []

    for row in raw_rows:
        src_row = row.get("_source_row")
        try:
            src_ip = (row.get("src_ip") or "").strip()
            if not src_ip:
                skipped.append({"row": row, "reason": "missing src_ip"})
                continue

            timestamp = float(row["timestamp"])

            src_port = _safe_int(row.get("src_port"))
            dst_port = _safe_int(row.get("dst_port"))

            events.append(NetworkEvent(
                event_id=new_id(),
                timestamp=timestamp,
                src_ip=src_ip,
                dst_ip=(row.get("dst_ip") or "").strip() or None,
                src_port=src_port,
                dst_port=dst_port,
                source_row=src_row,
            ))
        except (KeyError, ValueError, TypeError) as e:
            skipped.append({"row": row, "reason": f"{type(e).__name__}: {e}"})

    logger.info("normalize_network_events: %d ok, %d skipped", len(events), len(skipped))
    return events, skipped


def normalize_transactions(raw_rows: list[dict]) -> tuple[list[Transaction], list[dict]]:
    transactions: list[Transaction] = []
    skipped: list[dict] = []

    for row in raw_rows:
        src_row = row.get("_source_row")
        try:
            txid = row["txid"]
            timestamp = float(row["timestamp"])
            inputs = row.get("input_addresses") or []
            outputs = row.get("output_addresses") or []
            if not inputs or not outputs:
                skipped.append({"row": row, "reason": "missing input or output addresses"})
                continue

            transactions.append(Transaction(
                txid=txid,
                timestamp=timestamp,
                input_addresses=list(inputs),
                output_addresses=list(outputs),
                input_amounts=[float(a) for a in row.get("input_amounts", [])],
                output_amounts=[float(a) for a in row.get("output_amounts", [])],
                fee=float(row.get("fee", 0.0) or 0.0),
                script_type=row.get("script_type"),
                source_row=src_row,
            ))
        except (KeyError, ValueError, TypeError) as e:
            skipped.append({"row": row, "reason": f"{type(e).__name__}: {e}"})

    logger.info("normalize_transactions: %d ok, %d skipped", len(transactions), len(skipped))
    return transactions, skipped


def _safe_int(v) -> "int | None":
    try:
        if v in (None, ""):
            return None
        return int(v)
    except (ValueError, TypeError):
        return None
