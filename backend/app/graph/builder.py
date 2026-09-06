"""
graph/builder.py -- Phase 5.1

Builds one NetworkX DiGraph from validated records + correlation links.
In-memory only, on purpose -- no graph database needed at this scale.
Node types: "ip", "wallet", "transaction". Edge types: "broadcast",
"input", "output".
"""
import networkx as nx
from app.schemas import NetworkEvent, Transaction, CorrelationLink


def build_graph(
    events: list[NetworkEvent],
    transactions: list[Transaction],
    links: list[CorrelationLink],
) -> nx.DiGraph:
    g = nx.DiGraph()

    events_by_id = {e.event_id: e for e in events}

    # transaction nodes + wallet nodes + input/output edges
    for tx in transactions:
        tx_node = f"tx:{tx.txid}"
        g.add_node(tx_node, node_type="transaction", label=tx.txid)

        for addr in tx.input_addresses:
            w_node = f"wallet:{addr}"
            if not g.has_node(w_node):
                g.add_node(w_node, node_type="wallet", label=addr)
            g.add_edge(w_node, tx_node, edge_type="input")

        for addr in tx.output_addresses:
            w_node = f"wallet:{addr}"
            if not g.has_node(w_node):
                g.add_node(w_node, node_type="wallet", label=addr)
            g.add_edge(tx_node, w_node, edge_type="output")

    # ip nodes + broadcast edges, from correlation links
    for link in links:
        ev = events_by_id.get(link.network_event_id)
        if ev is None:
            continue
        ip_node = f"ip:{ev.src_ip}"
        tx_node = f"tx:{link.txid}"
        if not g.has_node(ip_node):
            g.add_node(ip_node, node_type="ip", label=ev.src_ip)
        if g.has_node(tx_node):
            g.add_edge(ip_node, tx_node, edge_type="broadcast",
                       confidence=link.confidence, weight=link.confidence or 0.5)

    return g


def wallet_fan_out(g: nx.DiGraph, wallet: str) -> int:
    """How many distinct transactions this wallet is an input to."""
    node = f"wallet:{wallet}"
    if not g.has_node(node):
        return 0
    return g.out_degree(node)


def wallet_fan_in(g: nx.DiGraph, wallet: str) -> int:
    """How many distinct transactions this wallet is an output of."""
    node = f"wallet:{wallet}"
    if not g.has_node(node):
        return 0
    return g.in_degree(node)


def wallet_distinct_ips(g: nx.DiGraph, wallet: str) -> int:
    """Number of distinct IPs correlated with any transaction this wallet touches."""
    node = f"wallet:{wallet}"
    if not g.has_node(node):
        return 0
    ips = set()
    tx_neighbors = set(g.predecessors(node)) | set(g.successors(node))
    for tx_node in tx_neighbors:
        if g.nodes[tx_node].get("node_type") != "transaction":
            continue
        for pred in g.predecessors(tx_node):
            if g.nodes[pred].get("node_type") == "ip":
                ips.add(pred)
    return len(ips)


def to_json_graph(g: nx.DiGraph) -> dict:
    """Serialize to the {nodes: [...], edges: [...]} shape the frontend expects."""
    nodes = [
        {"id": n, "node_type": d.get("node_type"), "label": d.get("label")}
        for n, d in g.nodes(data=True)
    ]
    edges = [
        {"source": u, "target": v, "edge_type": d.get("edge_type"),
         "weight": d.get("weight", 1.0)}
        for u, v, d in g.edges(data=True)
    ]
    return {"nodes": nodes, "edges": edges}
