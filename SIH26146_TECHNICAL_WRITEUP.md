# NexusTrace — SIH26146 Technical Write-up

## Problem
NexusTrace addresses SIH26146, **AI-Powered Monitoring & Analysis of Bitcoin Transaction Traffic**, by correlating Bitcoin blockchain activity with network-layer telemetry and turning those observations into ranked, explainable investigation leads.

## Offline architecture

```text
CSV / JSON / XML
      │
      ▼
Validation + Normalization
      │
      ├──────────────► Network Events
      │                     │
      │                     ▼
      │              Time-window correlation
      │                     │
      ▼                     ▼
Blockchain Transactions ─► Evidence Graph
      │                     │
      ├──────────────► Behavioral Features
      │                     │
      │                     ▼
      │              Isolation Forest
      │                     │
      │                     ▼
      │              Ranked Risk Leads
      │                     │
      ├──────────────► Common-input Entity Clusters
      │                     │
      ▼                     ▼
                Investigation Workspace
                Graph • Inspector • Timeline
                Alerts • Evidence • Report
```

All analysis runs locally. The application does not require a live Bitcoin node, blockchain API, cloud inference service, or network connection during analysis.

## AI/ML model

### Isolation Forest
NexusTrace uses **scikit-learn IsolationForest**, an unsupervised anomaly-detection model. This is appropriate for synthetic forensic traffic where labeled illicit/benign examples are not guaranteed.

The model is fitted on each analysis run using six wallet-level behavioral features:

1. Transaction velocity
2. Fan-out count
3. Fan-in count
4. Distinct correlated IP count
5. Total outgoing amount
6. Total incoming amount

A fixed `random_state=42` keeps demo results reproducible.

The model's anomaly output is used to rank wallets and assign investigation severity. The UI then explains the result using the same underlying feature values and dataset-relative percentile comparisons.

**Important terminology:** the anomaly score is an anomaly ranking, not a probability that a wallet is illicit. A score of 100% means the wallet is the most anomalous item in the current batch after normalization; it does not mean 100% certainty of criminal activity.

## Entity clustering

NexusTrace also implements a **Common Input Ownership** forensic heuristic using NetworkX connected components. Wallets that co-spend as inputs in the same transaction are grouped as a candidate entity cluster.

This is deliberately labelled as a forensic heuristic rather than ML. Co-spending is an investigative signal and does not by itself prove common ownership.

Clusters are persisted, exposed through `/api/clusters`, and shown in the Entity Inspector together with associated network IPs when available.

## Cross-layer correlation

Network observations are correlated with blockchain transactions using timestamp proximity. The configured correlation window is 5 seconds. A port-8333 observation provides an additional deterministic signal.

The resulting **Correlation Confidence** is a heuristic score based on observed timing/port evidence. It is not presented as a calibrated probability.

## Graph semantics

The graph preserves evidence direction:

- Wallet → Transaction = input relationship
- Transaction → Wallet = output relationship
- IP → Transaction = network/broadcast correlation

NexusTrace does not fabricate direct wallet-to-IP edges. Network evidence is connected to transactions, and wallet relationships are derived from actual transaction inputs/outputs.

## Explainability

Every investigation lead can be explained using the actual values observed in the current dataset. Examples include unusually high transaction velocity, fan-out, fan-in, IP diversity, or transaction amounts relative to the dataset.

The explanation layer is intentionally separated from the ML model: Isolation Forest performs anomaly detection, while deterministic percentile comparisons make the result understandable to investigators.

## GeoIP / ASN

The GeoIP layer supports offline MMDB databases and recognizes:

- public routable addresses
- private/internal addresses
- documentation/test networks
- unknown public addresses

DB-IP Lite MMDB files can be used as a free downloadable source under its attribution terms. The application also supports GeoLite2-style MMDB files. Prototype profiles are clearly marked as illustrative and are never used for documentation/private ranges.

## Investigation workflow

The dashboard is organized around an investigator's workflow:

**Dataset Input → Analysis → Overview → Investigation → Transactions → Alerts → Report**

The Investigation workspace combines:

- ranked investigation queue
- focused relationship graph
- entity inspector
- model signals
- entity clusters
- network/GeoIP evidence
- transaction evidence
- chronological timeline
- final investigation report

## Why this is useful

The system is not intended to declare guilt. It reduces a large synthetic transaction/telemetry dataset into a small set of explainable leads that an investigator can inspect, correlate, and document.

## Demo talking points

1. **"This is real unsupervised ML."** Isolation Forest is fitted locally on six behavioral features; it is not a hand-written fraud rule.
2. **"The graph is evidence-driven."** Wallets, transactions, and network observations are linked using explicit relationships; no direct wallet/IP relationship is fabricated.
3. **"Clustering is separate from anomaly detection."** Common-input ownership is a forensic heuristic used to group candidate entities.
4. **"Every alert is explainable."** The investigator can see the actual signals, correlation evidence, timing delta, related transactions, and network IPs.
5. **"It works offline."** Inference, correlation, storage, and investigation run locally.
6. **"We distinguish anomaly from guilt."** A high anomaly score prioritizes investigation; it is not a declaration of illicit activity.

## Data-source attribution

If DB-IP Lite data is installed and displayed by the application, retain DB-IP attribution in the product as required by its CC BY license.
