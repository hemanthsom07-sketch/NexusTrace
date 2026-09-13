import pandas as pd
import networkx as nx
from app.schemas import Transaction, FeatureRow
from app.graph.builder import wallet_fan_out, wallet_fan_in, wallet_distinct_ips

def extract_features(transactions: list[Transaction], g: nx.DiGraph) -> pd.DataFrame:
    if not transactions:
        return pd.DataFrame()
    timestamps = [tx.timestamp for tx in transactions]
    time_span_hours = max((max(timestamps) - min(timestamps)) / 3600.0, 1.0 / 3600.0)

    tx_count, out_amount, in_amount = {}, {}, {}
    for tx in transactions:
        for addr in tx.input_addresses:
            tx_count[addr] = tx_count.get(addr, 0) + 1
            out_amount[addr] = out_amount.get(addr, 0.0) + sum(tx.input_amounts or [0.0])
        for addr in tx.output_addresses:
            tx_count[addr] = tx_count.get(addr, 0) + 1
            in_amount[addr] = in_amount.get(addr, 0.0) + sum(tx.output_amounts or [0.0])

    rows = []
    for wallet, count in tx_count.items():
        rows.append(FeatureRow(
            wallet=wallet,
            transaction_velocity=round(count / time_span_hours, 4),
            fan_out_count=float(wallet_fan_out(g, wallet)),
            fan_in_count=float(wallet_fan_in(g, wallet)),
            distinct_ip_count=float(wallet_distinct_ips(g, wallet)),
            total_out_amount=round(out_amount.get(wallet, 0.0), 4),
            total_in_amount=round(in_amount.get(wallet, 0.0), 4),
        ))
    return pd.DataFrame([r.to_dict() for r in rows])