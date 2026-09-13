import networkx as nx
from app.schemas import NetworkEvent, Transaction, CorrelationLink

def build_graph(events: list[NetworkEvent], transactions: list[Transaction], links: list[CorrelationLink]) -> nx.DiGraph:
    g = nx.DiGraph()
    events_by_id = {e.event_id: e for e in events}

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

    for link in links:
        ev = events_by_id.get(link.network_event_id)
        if not ev:
            continue
        ip_node = f"ip:{ev.src_ip}"
        tx_node = f"tx:{link.txid}"
        if not g.has_node(ip_node):
            g.add_node(ip_node, node_type="ip", label=ev.src_ip)
        if g.has_node(tx_node):
            g.add_edge(ip_node, tx_node, edge_type="broadcast", confidence=link.confidence, weight=link.confidence or 0.5)

    return g

def wallet_fan_out(g: nx.DiGraph, wallet: str) -> int:
    node = f"wallet:{wallet}"
    return g.out_degree(node) if g.has_node(node) else 0

def wallet_fan_in(g: nx.DiGraph, wallet: str) -> int:
    node = f"wallet:{wallet}"
    return g.in_degree(node) if g.has_node(node) else 0

def wallet_distinct_ips(g: nx.DiGraph, wallet: str) -> int:
    node = f"wallet:{wallet}"
    if not g.has_node(node):
        return 0
    ips = set()
    for tx_node in set(g.predecessors(node)) | set(g.successors(node)):
        if g.nodes[tx_node].get("node_type") == "transaction":
            for pred in g.predecessors(tx_node):
                if g.nodes[pred].get("node_type") == "ip":
                    ips.add(pred)
    return len(ips)

def to_json_graph(g: nx.DiGraph, wallet_risk: dict = None) -> dict:
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
        edge = {"source": u, "target": v, "edge_type": d.get("edge_type"), "weight": d.get("weight", 1.0)}
        if "confidence" in d:
            edge["confidence"] = d["confidence"]
        edges.append(edge)
    return {"nodes": nodes, "edges": edges}