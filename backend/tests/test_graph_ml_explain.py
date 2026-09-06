import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.ingestion.parsers import parse_csv, parse_json
from app.ingestion.normalize import normalize_network_events, normalize_transactions
from app.correlation.matcher import correlate
from app.correlation.confidence import score_links
from app.graph.builder import build_graph, wallet_fan_out, to_json_graph
from app.features.extract import extract_features
from app.ml.anomaly import score_anomalies
from app.explain.reasons import generate_reasons, severity_for
from app.config import DEFAULT_SAMPLE_NETWORK_CSV, DEFAULT_SAMPLE_TX_JSON

PLANTED_ANOMALY_WALLET = "W_A12"  # deliberately unusual wallet in the sample data


def _full_pipeline():
    events, _ = normalize_network_events(parse_csv(DEFAULT_SAMPLE_NETWORK_CSV))
    transactions, _ = normalize_transactions(parse_json(DEFAULT_SAMPLE_TX_JSON))
    links = correlate(events, transactions)
    events_by_id = {e.event_id: e for e in events}
    links = score_links(links, events_by_id)
    g = build_graph(events, transactions, links)
    feature_df = extract_features(transactions, g)
    scored_df = score_anomalies(feature_df)
    return g, feature_df, scored_df


def test_graph_has_expected_node_types():
    g, _, _ = _full_pipeline()
    node_types = {d["node_type"] for _, d in g.nodes(data=True)}
    assert node_types == {"ip", "wallet", "transaction"}


def test_planted_anomaly_has_high_fan_out():
    g, _, _ = _full_pipeline()
    assert wallet_fan_out(g, PLANTED_ANOMALY_WALLET) == 4  # 4 transactions, planted in sample data


def test_to_json_graph_shape():
    g, _, _ = _full_pipeline()
    graph_json = to_json_graph(g)
    assert "nodes" in graph_json and "edges" in graph_json
    assert len(graph_json["nodes"]) == g.number_of_nodes()
    assert len(graph_json["edges"]) == g.number_of_edges()


def test_planted_anomaly_has_highest_features():
    _, feature_df, _ = _full_pipeline()
    row = feature_df[feature_df["wallet"] == PLANTED_ANOMALY_WALLET].iloc[0]
    assert row["fan_out_count"] == feature_df["fan_out_count"].max()
    assert row["transaction_velocity"] == feature_df["transaction_velocity"].max()


def test_planted_anomaly_scores_highest():
    _, _, scored_df = _full_pipeline()
    top_wallet = scored_df.iloc[0]["wallet"]
    assert top_wallet == PLANTED_ANOMALY_WALLET
    assert scored_df.iloc[0]["anomaly_score"] > 0.9


def test_severity_thresholds():
    assert severity_for(0.9) == "HIGH"
    assert severity_for(0.5) == "MEDIUM"
    assert severity_for(0.1) == "LOW"


def test_explanations_mention_planted_features():
    _, _, scored_df = _full_pipeline()
    reasons = generate_reasons(scored_df)
    planted_reasons = " ".join(reasons[PLANTED_ANOMALY_WALLET]).lower()
    assert "fan-out" in planted_reasons or "velocity" in planted_reasons
