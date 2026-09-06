"""
explain/reasons.py -- Phase 8.1

Turns a raw anomaly score into human-readable reasons, by comparing each
feature to the dataset's own distribution. Deliberately simpler than SHAP
(that's Phase 8.2, P2/postponed) -- this is enough to satisfy "explainable"
for a first prototype: every reason names a specific feature and value,
never a vague "this looks suspicious."
"""
import pandas as pd
from app.config import (
    REASON_PERCENTILE_THRESHOLD, SEVERITY_HIGH_THRESHOLD, SEVERITY_MEDIUM_THRESHOLD,
)

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
    """
    Returns {wallet: [reason strings]}. A feature earns a reason if this
    wallet's value for it is at or above the REASON_PERCENTILE_THRESHOLD
    percentile of the whole dataset for that feature.
    """
    reasons_by_wallet: dict[str, list[str]] = {}
    feature_cols = list(FEATURE_LABELS.keys())

    if scored_df.empty:
        return reasons_by_wallet

    thresholds = {
        col: scored_df[col].quantile(REASON_PERCENTILE_THRESHOLD)
        for col in feature_cols if col in scored_df.columns
    }
    # A feature with (near-)zero variance across the dataset can't meaningfully
    # distinguish anything -- e.g. if almost every wallet has distinct_ip_count=1,
    # the 85th percentile is also 1, and "val >= threshold" would fire for nearly
    # everyone. Only use a feature as a reason if it actually varies.
    stds = {col: scored_df[col].std() for col in feature_cols if col in scored_df.columns}

    for _, row in scored_df.iterrows():
        wallet = row["wallet"]
        reasons = []
        for col, label in FEATURE_LABELS.items():
            if col not in row:
                continue
            val = row[col]
            thresh = thresholds.get(col, float("inf"))
            std = stds.get(col, 0.0)
            # strict > (not >=) plus a real-variance check keeps this from
            # flagging every wallet that merely ties the threshold value.
            if std > 1e-9 and thresh > 0 and val > thresh:
                pct = int(REASON_PERCENTILE_THRESHOLD * 100)
                reasons.append(
                    f"{label.capitalize()} ({val:g}) is at or above the "
                    f"{pct}th percentile for this dataset"
                )
        if not reasons:
            reasons.append("No individual feature stood out sharply; "
                            "flagged by overall pattern across features")
        reasons_by_wallet[wallet] = reasons

    return reasons_by_wallet
