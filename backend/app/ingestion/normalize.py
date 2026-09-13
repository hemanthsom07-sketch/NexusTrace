import ast
import json
import logging
from datetime import datetime, timezone

from app.schemas import NetworkEvent, Transaction, new_id

logger = logging.getLogger("nexustrace.ingestion")


def _parse_timestamp(value):
    """Accept Unix seconds and common ISO-8601 timestamps used by uploaded CSVs."""
    if value is None or value == "":
        raise ValueError("missing timestamp")
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    try:
        return float(text)
    except ValueError:
        normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()


def _parse_list(value):
    """Parse native lists plus JSON/Python-list strings from CSV cells."""
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, list) else [parsed]
        except json.JSONDecodeError:
            try:
                parsed = ast.literal_eval(text)
                return list(parsed) if isinstance(parsed, (list, tuple)) else [parsed]
            except (ValueError, SyntaxError):
                # A plain scalar is still a usable one-item list for tolerant ingestion.
                return [text]
    return [value]


def normalize_network_events(raw_rows: list[dict]) -> tuple[list[NetworkEvent], list[dict]]:
    events: list[NetworkEvent] = []
    skipped: list[dict] = []
    for row in raw_rows:
        src_row = row.get("_source_row")
        try:
            src_ip = (row.get("src_ip") or "").strip()
            if not src_ip:
                skipped.append({"row": row, "reason": "missing src_ip"})
                continue
            timestamp = _parse_timestamp(row.get("timestamp"))
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
    return events, skipped


def normalize_transactions(raw_rows: list[dict]) -> tuple[list[Transaction], list[dict]]:
    transactions: list[Transaction] = []
    skipped: list[dict] = []
    for row in raw_rows:
        src_row = row.get("_source_row")
        try:
            txid = str(row["txid"]).strip()
            timestamp = _parse_timestamp(row.get("timestamp"))
            inputs = _parse_list(row.get("input_addresses"))
            outputs = _parse_list(row.get("output_addresses"))
            if not inputs or not outputs:
                skipped.append({"row": row, "reason": "missing input or output addresses"})
                continue
            transactions.append(Transaction(
                txid=txid,
                timestamp=timestamp,
                input_addresses=[str(a).strip() for a in inputs if str(a).strip()],
                output_addresses=[str(a).strip() for a in outputs if str(a).strip()],
                input_amounts=[float(a) for a in _parse_list(row.get("input_amounts"))],
                output_amounts=[float(a) for a in _parse_list(row.get("output_amounts"))],
                fee=float(row.get("fee", 0.0) or 0.0),
                script_type=row.get("script_type"),
                source_row=src_row,
            ))
        except (KeyError, ValueError, TypeError) as e:
            skipped.append({"row": row, "reason": f"{type(e).__name__}: {e}"})
    return transactions, skipped


def _safe_int(v) -> "int | None":
    try:
        return int(v) if v not in (None, "") else None
    except (ValueError, TypeError):
        return None
