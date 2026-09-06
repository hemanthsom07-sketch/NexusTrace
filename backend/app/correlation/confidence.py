"""
correlation/confidence.py -- Phase 4.1 / 4.2

Attaches a confidence value + human-readable evidence to every
CorrelationLink. Deliberately simple and explainable -- a formula the
whole team can justify out loud beats a complicated one nobody can
defend under judge questioning.
"""
from app.schemas import NetworkEvent, Transaction, CorrelationLink
from app.config import CORRELATION_WINDOW_SECONDS, BITCOIN_STANDARD_PORT


def score_links(
    links: list[CorrelationLink],
    events_by_id: dict[str, NetworkEvent],
    window_seconds: float = CORRELATION_WINDOW_SECONDS,
) -> list[CorrelationLink]:
    """
    confidence = max(0, 1 - time_delta / window) with a small boost if the
    network event used Bitcoin's standard P2P port (8333). Capped at 1.0.

    This is intentionally simple: a 0-second delta scores ~1.0, a match at
    the edge of the window scores ~0.0 (before the port boost).
    """
    for link in links:
        base = max(0.0, 1.0 - (link.time_delta_seconds / window_seconds))

        ev = events_by_id.get(link.network_event_id)
        port_match = bool(ev and ev.src_port == BITCOIN_STANDARD_PORT)
        boost = 0.1 if port_match else 0.0

        confidence = min(1.0, base + boost)
        link.confidence = round(confidence, 3)

        evidence_bits = [f"\u0394t={link.time_delta_seconds:.1f}s"]
        if port_match:
            evidence_bits.append(f"port={BITCOIN_STANDARD_PORT} (standard)")
        link.evidence = ", ".join(evidence_bits)

        # evidence_refs point back to the exact source rows (Phase 4.2) so
        # explainability (Phase 8) can trace a lead back to raw data, not
        # just a description.
        refs = []
        if ev and ev.source_row is not None:
            refs.append(f"network_row:{ev.source_row}")
        link.evidence_refs = refs

    return links
