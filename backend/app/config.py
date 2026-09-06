"""
config.py — shared constants. If more than one module needs to agree on a
value (a threshold, a path, a window size), it goes here, not hardcoded
in the module that happens to use it first.
"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DATA_DIR = os.path.join(BASE_DIR, "data")
SAMPLE_DIR = os.path.join(DATA_DIR, "sample")
GEOIP_DIR = os.path.join(DATA_DIR, "geoip")
DB_PATH = os.path.join(DATA_DIR, "nexustrace.db")

# --- correlation ---
# Max time gap (seconds) between a network event and a transaction for them
# to be considered a candidate link at all. Tune this against real data once
# you have it -- too wide and everything correlates with everything.
CORRELATION_WINDOW_SECONDS = 5.0

BITCOIN_STANDARD_PORT = 8333

# --- anomaly detection ---
ISOLATION_FOREST_CONTAMINATION = 0.1   # expected proportion of anomalies
ISOLATION_FOREST_RANDOM_STATE = 42     # fixed seed -> reproducible demo runs

# --- severity thresholds (on normalized 0..1 anomaly score) ---
SEVERITY_HIGH_THRESHOLD = 0.7
SEVERITY_MEDIUM_THRESHOLD = 0.4

# --- explainability ---
# a feature is called out as a "reason" if the entity's value is at or above
# this percentile of the dataset for that feature
REASON_PERCENTILE_THRESHOLD = 0.85

DEFAULT_SAMPLE_NETWORK_CSV = os.path.join(SAMPLE_DIR, "sample_network.csv")
DEFAULT_SAMPLE_TX_JSON = os.path.join(SAMPLE_DIR, "sample_transactions.json")
