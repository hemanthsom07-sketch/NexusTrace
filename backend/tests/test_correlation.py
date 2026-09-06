import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.ingestion.parsers import parse_csv, parse_json
from app.ingestion.normalize import normalize_network_events, normalize_transactions
from app.correlation.matcher import correlate
from app.correlation.confidence import score_links
from app.config import DEFAULT_SAMPLE_NETWORK_CSV, DEFAULT_SAMPLE_TX_JSON


def _load():
    events, _ = normalize_network_events(parse_csv(DEFAULT_SAMPLE_NETWORK_CSV))
    transactions, _ = normalize_transactions(parse_json(DEFAULT_SAMPLE_TX_JSON))
    return events, transactions


def test_correlate_finds_known_pair():
    events, transactions = _load()
    links = correlate(events, transactions)
    # TX1001 (ts=1735700400) should correlate with the network event at the same timestamp
    tx1001_links = [l for l in links if l.txid == "TX1001"]
    assert len(tx1001_links) >= 1


def test_correlate_ignores_far_apart_events():
    events, transactions = _load()
    links = correlate(events, transactions, window_seconds=5.0)
    # TX3007 (ts=1735707001) should NOT correlate with an event from ts=1735700400 (way outside window)
    for link in links:
        if link.txid == "TX3007":
            assert link.time_delta_seconds <= 5.0


def test_confidence_scores_are_bounded():
    events, transactions = _load()
    links = correlate(events, transactions)
    events_by_id = {e.event_id: e for e in events}
    scored = score_links(links, events_by_id)
    for link in scored:
        assert 0.0 <= link.confidence <= 1.0
        assert link.evidence is not None


def test_zero_delta_scores_high_confidence():
    events, transactions = _load()
    links = correlate(events, transactions)
    events_by_id = {e.event_id: e for e in events}
    scored = score_links(links, events_by_id)
    zero_delta_links = [l for l in scored if l.time_delta_seconds == 0.0]
    assert len(zero_delta_links) > 0
    for link in zero_delta_links:
        assert link.confidence >= 0.9
