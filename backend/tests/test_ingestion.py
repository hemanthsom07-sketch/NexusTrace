import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.ingestion.parsers import parse_csv, parse_json
from app.ingestion.normalize import normalize_network_events, normalize_transactions
from app.config import DEFAULT_SAMPLE_NETWORK_CSV, DEFAULT_SAMPLE_TX_JSON


def test_parse_csv_reads_all_rows():
    rows = parse_csv(DEFAULT_SAMPLE_NETWORK_CSV)
    assert len(rows) == 20  # matches the fabricated sample file


def test_parse_json_reads_all_rows():
    rows = parse_json(DEFAULT_SAMPLE_TX_JSON)
    assert len(rows) == 18


def test_normalize_skips_missing_src_ip():
    rows = parse_csv(DEFAULT_SAMPLE_NETWORK_CSV)
    events, skipped = normalize_network_events(rows)
    assert len(skipped) == 1
    assert "missing src_ip" in skipped[0]["reason"]
    assert len(events) == 19


def test_normalize_transactions_all_valid():
    rows = parse_json(DEFAULT_SAMPLE_TX_JSON)
    transactions, skipped = normalize_transactions(rows)
    assert len(skipped) == 0
    assert len(transactions) == 18


def test_normalize_network_event_fields():
    rows = parse_csv(DEFAULT_SAMPLE_NETWORK_CSV)
    events, _ = normalize_network_events(rows)
    first = events[0]
    assert first.src_ip == "45.33.1.10"
    assert first.src_port == 8333
    assert first.timestamp == 1735700400.0
