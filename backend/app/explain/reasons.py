import pandas as pd
from app.config import REASON_PERCENTILE_THRESHOLD, SEVERITY_HIGH_THRESHOLD, SEVERITY_MEDIUM_THRESHOLD

FEATURE_LABELS = {
    "transaction_velocity": "transaction velocity",
    "fan_out_count": "fan-out (distinct outgoing transactions)",
    "fan_in_count": "fan-in (distinct incoming transactions)",
    "distinct_ip_count": "number of distinct correlated IPs",
    "total_out_amount": "total outgoing amount",
    "total_in_amount": "total incoming amount",
}

def severity_for(score: float) -> str:
    if score >= SEVERITY_HIGH_THRESHOLD:
        return "HIGH"
    if score >= SEVERITY_MEDIUM_THRESHOLD:
        return "MEDIUM"
    return "LOW"

def generate_reasons(scored_df: pd.DataFrame) -> dict[str, list[str]]:
    reasons_by_wallet = {}
    if scored_df.empty:
        return reasons_by_wallet

    feature_cols = list(FEATURE_LABELS.keys())
    thresholds = {col: scored_df[col].quantile(REASON_PERCENTILE_THRESHOLD) for col in feature_cols if col in scored_df.columns}
    stds = {col: scored_df[col].std() for col in feature_cols if col in scored_df.columns}

    for _, row in scored_df.iterrows():
        wallet = row["wallet"]
        reasons = []
        for col, label in FEATURE_LABELS.items():
            val = row[col]
            thresh = thresholds.get(col, float("inf"))
            std = stds.get(col, 0.0)
            if std > 1e-9 and thresh > 0 and val > thresh:
                reasons.append(f"{label.capitalize()} ({val:g}) is at or above the 85th percentile for this dataset")
        if not reasons:
            reasons.append("Flagged by multi-variate anomaly score profile across features")
        reasons_by_wallet[wallet] = reasons
    return reasons_by_wallet