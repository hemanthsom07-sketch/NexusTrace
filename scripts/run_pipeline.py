"""
scripts/run_pipeline.py -- debugging shortcut (mentioned in the
implementation plan). Runs the whole backend pipeline against the sample
dataset and prints results at every stage, with no FastAPI/React involved.
Use this to isolate bugs: if something's wrong, this tells you which phase
it's in before you even start the web server.

Run from the `backend/` directory:
    python ../scripts/run_pipeline.py
"""
import sys
import os

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.config import DEFAULT_SAMPLE_NETWORK_CSV, DEFAULT_SAMPLE_TX_JSON
from app.ingestion.parsers import parse_csv, parse_json
from app.ingestion.normalize import normalize_network_events, normalize_transactions
from app.correlation.matcher import correlate
from app.correlation.confidence import score_links
from app.graph.builder import build_graph, to_json_graph
from app.features.extract import extract_features
from app.ml.anomaly import score_anomalies
from app.explain.reasons import generate_reasons, severity_for


def run(network_csv=DEFAULT_SAMPLE_NETWORK_CSV, tx_json=DEFAULT_SAMPLE_TX_JSON, verbose=True):
    # --- Phase 2: ingestion + normalization ---
    raw_network = parse_csv(network_csv)
    raw_tx = parse_json(tx_json)
    events, skipped_events = normalize_network_events(raw_network)
    transactions, skipped_tx = normalize_transactions(raw_tx)

    if verbose:
        print(f"[ingestion] {len(events)} network events ({len(skipped_events)} skipped)")
        print(f"[ingestion] {len(transactions)} transactions ({len(skipped_tx)} skipped)")
        for s in skipped_events:
            print(f"  skipped network row: {s['reason']}")
        for s in skipped_tx:
            print(f"  skipped tx row: {s['reason']}")

    # --- Phase 3+4: correlation + confidence ---
    links = correlate(events, transactions)
    events_by_id = {e.event_id: e for e in events}
    links = score_links(links, events_by_id)

    if verbose:
        print(f"\n[correlation] {len(links)} candidate links found")
        for link in sorted(links, key=lambda l: -l.confidence)[:5]:
            print(f"  txid={link.txid} confidence={link.confidence} evidence={link.evidence}")

    # --- Phase 5: graph ---
    g = build_graph(events, transactions, links)
    if verbose:
        print(f"\n[graph] {g.number_of_nodes()} nodes, {g.number_of_edges()} edges")

    # --- Phase 6: features ---
    feature_df = extract_features(transactions, g)
    if verbose:
        print(f"\n[features] {len(feature_df)} wallets scored")
        print(feature_df.sort_values('fan_out_count', ascending=False).head(5).to_string(index=False))

    # --- Phase 7: anomaly detection ---
    scored_df = score_anomalies(feature_df)
    if verbose:
        print(f"\n[ml] top 5 anomaly scores:")
        print(scored_df[["wallet", "anomaly_score"] + [c for c in scored_df.columns
              if c not in ("wallet", "anomaly_score", "raw_score")]].head(5).to_string(index=False))

    # --- Phase 8: explainability ---
    reasons = generate_reasons(scored_df)

    leads = []
    for _, row in scored_df.head(10).iterrows():
        wallet = row["wallet"]
        leads.append({
            "wallet": wallet,
            "anomaly_score": round(float(row["anomaly_score"]), 4),
            "severity": severity_for(row["anomaly_score"]),
            "reasons": reasons.get(wallet, []),
        })

    if verbose:
        print(f"\n[leads] top investigation leads:")
        for lead in leads[:5]:
            print(f"  {lead['wallet']}  score={lead['anomaly_score']}  severity={lead['severity']}")
            for r in lead["reasons"]:
                print(f"      - {r}")

    graph_json = to_json_graph(g)
    return {
        "events": len(events), "transactions": len(transactions),
        "links": len(links), "graph": graph_json, "leads": leads,
    }


if __name__ == "__main__":
    run()
