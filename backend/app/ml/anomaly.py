import pandas as pd
from sklearn.ensemble import IsolationForest
from app.config import ISOLATION_FOREST_CONTAMINATION, ISOLATION_FOREST_RANDOM_STATE

FEATURE_COLUMNS = [
    "transaction_velocity", "fan_out_count", "fan_in_count",
    "distinct_ip_count", "total_out_amount", "total_in_amount"
]

def score_anomalies(feature_df: pd.DataFrame) -> pd.DataFrame:
    df = feature_df.copy()
    if len(df) < 2:
        df["raw_score"] = 0.0
        df["anomaly_score"] = 0.0
        return df

    X = df[FEATURE_COLUMNS].fillna(0.0).values
    model = IsolationForest(
        contamination=ISOLATION_FOREST_CONTAMINATION,
        random_state=ISOLATION_FOREST_RANDOM_STATE,
        n_estimators=200
    )
    model.fit(X)
    raw = model.decision_function(X)
    df["raw_score"] = raw
    flipped = -raw
    lo, hi = flipped.min(), flipped.max()
    df["anomaly_score"] = 0.0 if hi - lo < 1e-9 else (flipped - lo) / (hi - lo)
    return df.sort_values("anomaly_score", ascending=False).reset_index(drop=True)