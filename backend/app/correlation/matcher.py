"""
correlation/matcher.py -- Phase 3.1

Links NetworkEvents to Transactions by time proximity. This is the actual
"cross-layer correlation" the problem statement asks for -- everything
downstream (graph, features, ML) depends on getting this reasonably right.
"""
from app.schemas import NetworkEvent, Transaction, CorrelationLink, new_id
from app.config import CORRELATION_WINDOW_SECONDS


def correlate(
    events: list[NetworkEvent],
    transactions: list[Transaction],
    window_seconds: float = CORRELATION_WINDOW_SECONDS,
) -> list[CorrelationLink]:
    """
    For each transaction, find network events within `window_seconds` of it.
    Deliberately O(n*m) -- fine for hackathon-scale sample data. If the real
    dataset is large enough for this to matter, sort both lists by timestamp
    and use a sliding window instead (note this for Phase 3.2/optimization,
    don't prematurely optimize before you know it's needed).
    """
    links: list[CorrelationLink] = []

    for tx in transactions:
        for ev in events:
            delta = abs(tx.timestamp - ev.timestamp)
            if delta <= window_seconds:
                links.append(CorrelationLink(
                    link_id=new_id(),
                    network_event_id=ev.event_id,
                    txid=tx.txid,
                    time_delta_seconds=delta,
                    # confidence + evidence populated by confidence.py (Phase 4)
                ))

    return links
