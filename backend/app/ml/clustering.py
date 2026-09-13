import networkx as nx
from app.schemas import Transaction, EntityCluster, new_id

def perform_common_input_clustering(transactions: list[Transaction]) -> list[EntityCluster]:
    """
    Implements Common Input Ownership Heuristic:
    Wallets co-spent as inputs in the same transaction are controlled by one entity.
    """
    g = nx.Graph()
    for tx in transactions:
        inputs = tx.input_addresses
        if len(inputs) > 1:
            for i in range(len(inputs) - 1):
                g.add_edge(inputs[i], inputs[i+1])
        elif len(inputs) == 1:
            g.add_node(inputs[0])

    clusters = []
    for comp in nx.connected_components(g):
        wallets = list(comp)
        if len(wallets) > 1:
            clusters.append(EntityCluster(
                cluster_id=f"CLUSTER_{new_id()[:6].upper()}",
                wallets=wallets,
                heuristic_used="Common Input Ownership",
                associated_ips=[]
            ))
    return clusters