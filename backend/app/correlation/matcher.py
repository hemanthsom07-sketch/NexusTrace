from app.schemas import NetworkEvent, Transaction, CorrelationLink, new_id
from app.config import CORRELATION_WINDOW_SECONDS

def correlate(events: list[NetworkEvent], transactions: list[Transaction], window_seconds: float = CORRELATION_WINDOW_SECONDS) -> list[CorrelationLink]:
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
                ))
    return links