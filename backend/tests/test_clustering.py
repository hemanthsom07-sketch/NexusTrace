from app.ml.clustering import perform_common_input_clustering
from app.schemas import Transaction


def test_common_input_clustering_groups_co_spent_wallets():
    txs = [
        Transaction(
            txid="TX1",
            timestamp=1.0,
            input_addresses=["W_A", "W_B"],
            output_addresses=["W_C"],
        ),
        Transaction(
            txid="TX2",
            timestamp=2.0,
            input_addresses=["W_B", "W_D"],
            output_addresses=["W_E"],
        ),
    ]
    clusters = perform_common_input_clustering(txs)
    wallets = set(clusters[0].wallets)
    assert {"W_A", "W_B", "W_D"}.issubset(wallets)
    assert clusters[0].heuristic_used == "Common Input Ownership"
