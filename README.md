# NexusTrace

**SIH26146 — AI-Powered Monitoring & Analysis of Bitcoin Transaction Traffic**

NexusTrace is an offline Bitcoin transaction intelligence and investigation prototype that correlates network telemetry with blockchain transaction metadata, detects anomalous wallet behavior using Isolation Forest, groups candidate entities using Common Input Ownership, enriches public IPs with offline GeoIP/ASN data, and produces explainable investigation evidence.

## Quick start

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Offline GeoIP

Optional DB-IP Lite MMDB files can be downloaded before the demo:

**PowerShell:**

```powershell
.\scripts\download_geoip.ps1
```

**Linux/macOS:**

```bash
./scripts/download_geoip.sh
```

The databases are intentionally not committed to this repository. See `backend/data/geoip/README.md` for supported filenames and attribution requirements.

## Demo flow

1. Login
2. Open **Dataset Input**
3. Upload network telemetry + blockchain transactions
4. Run **Analyze Data**
5. Open **Overview** to show detection method, correlations and priorities
6. Open **Investigate**
7. Select the highest-risk wallet
8. Show the Isolation Forest signals and **Entity Cluster** when present
9. Select a transaction/IP in the graph
10. Show correlation timing, GeoIP/ASN and evidence
11. Open **Transactions** and **Alerts**
12. Generate the final investigation report

## Technical notes

- AI/ML: scikit-learn Isolation Forest, unsupervised anomaly detection
- Features: transaction velocity, fan-in, fan-out, distinct IPs, total in/out amount
- Entity clustering: Common Input Ownership heuristic using NetworkX
- Correlation: timestamp-window matching with deterministic correlation confidence
- Graph: wallet ↔ transaction ↔ network evidence relationships
- Storage: local SQLite current-analysis state
- Runtime: designed for offline Linux deployment

See `SIH26146_TECHNICAL_WRITEUP.md` for the judge-facing technical explanation and model terminology.
