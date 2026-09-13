from dataclasses import dataclass, field, asdict
from typing import Optional
import uuid

def new_id() -> str:
    return uuid.uuid4().hex[:12]

@dataclass
class NetworkEvent:
    event_id: str
    timestamp: float
    src_ip: str
    dst_ip: Optional[str] = None
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    source_row: Optional[int] = None

    def to_dict(self):
        return asdict(self)

@dataclass
class Transaction:
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

@dataclass
class CorrelationLink:
    link_id: str
    network_event_id: str
    txid: str
    time_delta_seconds: float
    confidence: Optional[float] = None
    evidence: Optional[str] = None
    evidence_refs: list[str] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)

@dataclass
class FeatureRow:
    wallet: str
    transaction_velocity: float = 0.0
    fan_out_count: float = 0.0
    fan_in_count: float = 0.0
    distinct_ip_count: float = 0.0
    total_out_amount: float = 0.0
    total_in_amount: float = 0.0

    def to_dict(self):
        return asdict(self)

@dataclass
class EntityCluster:
    cluster_id: str
    wallets: list[str]
    heuristic_used: str
    associated_ips: list[str]

    def to_dict(self):
        return asdict(self)