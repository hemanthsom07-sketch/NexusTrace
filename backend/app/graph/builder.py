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
            # Evidence already computed by correlation/confidence.py -- carried
            # onto the edge as-is so the API/graph can expose it without
            # recomputing or duplicating that logic here.
            g.add_edge(ip_node, tx_node, edge_type="broadcast",
                       confidence=link.confidence, weight=link.confidence or 0.5,
                       time_delta_seconds=link.time_delta_seconds,
                       port=ev.src_port, evidence=link.evidence)

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


def to_json_graph(g: nx.DiGraph, wallet_risk: "dict[str, dict] | None" = None) -> dict:
    """Serialize to the {nodes: [...], edges: [...]} shape the frontend expects.

    wallet_risk is optional -- {wallet_address: {"anomaly_score": float,
    "severity": str}}, as produced in api/routes.py after scoring. When
    given, wallet nodes get anomaly_score/severity attached so the graph can
    color by risk; when omitted (e.g. the existing tests, which build a
    graph before scoring runs), behavior is unchanged from before.
    """
    wallet_risk = wallet_risk or {}
    nodes = []
    for n, d in g.nodes(data=True):
        node = {"id": n, "node_type": d.get("node_type"), "label": d.get("label")}
        if d.get("node_type") == "wallet":
            risk = wallet_risk.get(d.get("label"))
            if risk:
                node["anomaly_score"] = risk.get("anomaly_score")
                node["severity"] = risk.get("severity")
        nodes.append(node)

    edges = []
    for u, v, d in g.edges(data=True):
        edge = {"source": u, "target": v, "edge_type": d.get("edge_type"),
                "weight": d.get("weight", 1.0)}
        # Correlation evidence only exists on broadcast (ip -> tx) edges --
        # present when build_graph attached it, absent (and simply omitted)
        # for input/output edges, which never carry this data.
        if "confidence" in d:
            edge["confidence"] = d.get("confidence")
        if "time_delta_seconds" in d:
            edge["time_delta_seconds"] = d.get("time_delta_seconds")
        if "port" in d:
            edge["port"] = d.get("port")
        if "evidence" in d:
            edge["evidence"] = d.get("evidence")
        edges.append(edge)

    return {"nodes": nodes, "edges": edges}
