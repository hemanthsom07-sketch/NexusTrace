from app.schemas import NetworkEvent, CorrelationLink
from app.config import CORRELATION_WINDOW_SECONDS, BITCOIN_STANDARD_PORT

def score_links(links: list[CorrelationLink], events_by_id: dict[str, NetworkEvent], window_seconds: float = CORRELATION_WINDOW_SECONDS) -> list[CorrelationLink]:
    for link in links:
        base = max(0.0, 1.0 - (link.time_delta_seconds / window_seconds))
        ev = events_by_id.get(link.network_event_id)
        port_match = bool(ev and ev.src_port == BITCOIN_STANDARD_PORT)
        boost = 0.1 if port_match else 0.0
        confidence = min(1.0, base + boost)
        link.confidence = round(confidence, 3)
        evidence_bits = [f"Δt={link.time_delta_seconds:.1f}s"]
        if port_match:
            evidence_bits.append(f"port={BITCOIN_STANDARD_PORT} (standard)")
        link.evidence = ", ".join(evidence_bits)
    return links