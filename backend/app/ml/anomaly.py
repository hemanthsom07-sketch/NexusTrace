"""
ml/anomaly.py -- Phase 7.1

Trains + scores an Isolation Forest on the feature table. Unsupervised on
purpose -- there is no reliable criminal/non-criminal label for this data,
so the model learns what "normal" looks like in THIS dataset and flags
what doesn't fit. Retrains on every run rather than persisting a model
file -- fine at this data scale (Phase 7.2 persistence is P1, add only if
retraining actually becomes slow).
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from app.config import ISOLATION_FOREST_CONTAMINATION, ISOLATION_FOREST_RANDOM_STATE

FEATURE_COLUMNS = [
    "transaction_velocity", "fan_out_count", "fan_in_count",
    "distinct_ip_count", "total_out_amount", "total_in_amount",
]


def score_anomalies(feature_df: pd.DataFrame) -> pd.DataFrame:
    """
    Returns a copy of feature_df with two new columns:
      - raw_score: sklearn's decision_function output (lower = more anomalous)
      - anomaly_score: normalized to 0..1, higher = MORE anomalous
        (flipped + rescaled so the rest of the app can treat "higher = worse"
        consistently everywhere)
    """
    df = feature_df.copy()

    if len(df) < 2:
        # Isolation Forest needs at least a couple of points to mean anything.
        # Don't pretend to score a dataset this tiny -- return neutral scores
        # instead of a misleading confident-looking number.
        df["raw_score"] = 0.0
        df["anomaly_score"] = 0.0
        return df

    X = df[FEATURE_COLUMNS].fillna(0.0).values

    model = IsolationForest(
        contamination=ISOLATION_FOREST_CONTAMINATION,
        random_state=ISOLATION_FOREST_RANDOM_STATE,
        n_estimators=200,
    )
    model.fit(X)

    raw = model.decision_function(X)   # higher = more normal in sklearn's convention
    df["raw_score"] = raw

    # flip + min-max normalize to 0..1 so "higher = more anomalous" everywhere
    # else in this codebase (API, frontend, explainability all assume this).
    flipped = -raw
    lo, hi = flipped.min(), flipped.max()
    if hi - lo < 1e-9:
        df["anomaly_score"] = 0.0
    else:
        df["anomaly_score"] = (flipped - lo) / (hi - lo)

    return df.sort_values("anomaly_score", ascending=False).reset_index(drop=True)
