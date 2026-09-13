import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
SAMPLE_DIR = os.path.join(DATA_DIR, "sample")
GEOIP_DIR = os.path.join(DATA_DIR, "geoip")
DB_PATH = os.path.join(DATA_DIR, "nexustrace.db")

CORRELATION_WINDOW_SECONDS = 5.0
BITCOIN_STANDARD_PORT = 8333

ISOLATION_FOREST_CONTAMINATION = 0.1
ISOLATION_FOREST_RANDOM_STATE = 42

SEVERITY_HIGH_THRESHOLD = 0.7
SEVERITY_MEDIUM_THRESHOLD = 0.4
REASON_PERCENTILE_THRESHOLD = 0.85

DEFAULT_SAMPLE_NETWORK_CSV = os.path.join(SAMPLE_DIR, "sample_network.csv")
DEFAULT_SAMPLE_TX_JSON = os.path.join(SAMPLE_DIR, "sample_transactions.json")