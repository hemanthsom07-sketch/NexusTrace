"""
schemas.py — THE SHARED CONTRACT.

Every module in this backend imports from here. If you need to change a
field, tell the whole team first — this file is the single source of truth
for what data looks like as it moves through the pipeline.

Uses stdlib dataclasses (not pydantic) so this runs with zero extra
dependencies beyond Python itself. FastAPI can still serialize these fine
via .to_dict() / asdict().
"""
from dataclasses import dataclass, field, asdict
from typing import Optional
import uuid


def new_id() -> str:
    return uuid.uuid4().hex[:12]


# ---------------------------------------------------------------------------
# Raw / normalized input records
# ---------------------------------------------------------------------------

@dataclass
class NetworkEvent:
    """One observed network-layer event (a node talking on the P2P network)."""
    event_id: str
    timestamp: float          # unix epoch seconds
    src_ip: str
    dst_ip: Optional[str] = None
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    source_row: Optional[int] = None   # which raw row this came from (for evidence)

    def to_dict(self):
        return asdict(self)


@dataclass
class Transaction:
    """One Bitcoin transaction (blockchain-layer record)."""
    txid: str
    timestamp: float
    input_addresses: list[str]
    output_addresses: list[str]
    input_amounts: list[float] = field(default_factory=list)
    output_amounts: list[float] = field(default_factory=list)
    fee: float = 0.0
    script_type: Optional[str] = None
    source_row: Optional[int] = None

    def to_dict(self):
        return asdict(self)


# ---------------------------------------------------------------------------
# Derived / pipeline objects
# ---------------------------------------------------------------------------

@dataclass
class CorrelationLink:
    """A candidate link between a network event and a transaction."""
    link_id: str
    network_event_id: str
    txid: str
    time_delta_seconds: float
    confidence: Optional[float] = None       # filled in by Phase 4 (confidence.py)
    evidence: Optional[str] = None           # human-readable evidence string
    evidence_refs: list[str] = field(default_factory=list)  # source row refs

    def to_dict(self):
        return asdict(self)


@dataclass
class FeatureRow:
    """One row of the feature table -- one wallet, several numeric signals."""
    wallet: str
    transaction_velocity: float = 0.0   # tx count in the observed time span
    fan_out_count: float = 0.0          # distinct wallets this wallet paid out to
    fan_in_count: float = 0.0           # distinct wallets that paid this wallet
    distinct_ip_count: float = 0.0      # distinct IPs correlated with this wallet
    total_out_amount: float = 0.0
    total_in_amount: float = 0.0

    def to_dict(self):
        return asdict(self)


@dataclass
class InvestigationLead:
    """Final output object -- what the investigator actually sees."""
    wallet: str
    anomaly_score: float           # 0..1, higher = more unusual
    severity: str                  # LOW / MEDIUM / HIGH
    reasons: list[str] = field(default_factory=list)
    related_txids: list[str] = field(default_factory=list)
    related_ips: list[str] = field(default_factory=list)
    feature_snapshot: Optional[dict] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class GraphNode:
    id: str
    node_type: str   # "ip" | "wallet" | "transaction"
    label: str
    anomaly_score: Optional[float] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class GraphEdge:
    source: str
    target: str
    edge_type: str   # "broadcast" | "input" | "output"
    weight: float = 1.0

    def to_dict(self):
        return asdict(self)
