# NexusTrace — Prototype (SIH26146)

AI-Powered Cross-Layer Correlation & Explainable Anomaly Detection for
Bitcoin Transaction Networks.

## What's been tested vs. what you need to verify

**Fully tested, end-to-end, with real output** (done in the environment that built this):
- All backend logic: ingestion → normalization → correlation → confidence
  scoring → graph building → feature engineering → Isolation Forest →
  explainability. 16/16 tests pass, run directly against the sample data.
- The FastAPI route *logic* (tested with a stub standing in for the
  `fastapi` package itself, since that environment had no internet access
  to install it) — including the related-TXID/related-IP lookups.
- SQLite storage layer — insert, retrieve, overwrite, all verified.
- Every `.jsx`/`.js` file — syntax-checked with `tsc`, confirmed to catch
  real errors (deliberately broke one file to confirm the check works,
  then restored it).

**Not yet run, because it needs a real `pip install` / `npm install` with
internet access, which the build environment didn't have:**
- Actually starting `uvicorn` and hitting it with real HTTP requests.
- Actually running `npm install` and `npm run dev` / `npm run build`.
- The 3D graph rendering itself, visually, in a browser.

None of this means the code is unverified guesswork — the actual business
logic (the hard part) has real, reproducible test output behind it. What's
left is standard "does the web server start / does npm install cleanly"
verification that only works with the internet access your machine has.

---

## 1. Backend setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Run the pipeline once directly (no web server) to confirm everything works
on your machine, same as was verified during the build:

```bash
python ../scripts/run_pipeline.py
```

You should see the planted anomaly wallet `W_A12` come out on top with a
HIGH severity and an anomaly score near 1.0. If you see that, the entire
core pipeline is working correctly on your machine.

Then start the actual API server:

```bash
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for the interactive API docs (this page
is generated automatically by FastAPI). From there, or via curl:

```bash
curl -X POST http://localhost:8000/api/pipeline/run
curl http://localhost:8000/api/leads
curl http://localhost:8000/api/leads/W_A12
curl http://localhost:8000/api/graph
```

## 2. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Click
**"Run Pipeline"** — this calls the backend, loads the sample data, and
populates the lead list, the 3D graph, and the detail panel.

**If `react-force-graph-3d` gives you trouble** (WebGL issues, slow
performance, or install problems): swap it for `react-force-graph-2d` from
the same package family — it's a drop-in replacement with the same props
and data shape, just import `ForceGraph2D` instead of `ForceGraph3D` in
`src/components/GraphView.jsx`. This was flagged as a real risk in the
implementation plan (Day 3 milestone: load-test the 3D view and be ready
to fall back to 2D if it's not performing well).

## 3. Using your own dataset instead of the sample

Replace the files in `backend/data/sample/sample_network.csv` and
`sample_transactions.json` with real data in the same shape (see
`app/schemas.py` for the exact fields), or pass explicit paths:

```bash
curl -X POST "http://localhost:8000/api/pipeline/run?network_csv=/path/to/your.csv&tx_json=/path/to/your.json"
```

## 4. What's P0 (done) vs. P1/P2 (not built, on purpose)

See `IMPLEMENTATION_STATUS.md` for the full breakdown matching the phased
plan. Short version: ingestion, correlation, confidence scoring, graph,
features, Isolation Forest, and threshold-based explainability are all
P0-complete. GeoIP enrichment is stubbed (degrades gracefully if you don't
add a GeoLite2 `.mmdb` file — see `app/geoip/lookup.py` for how to enable
it for real). SHAP explainability, clustering as a second ML signal, model
persistence, auth, and pagination are all intentionally not built — see
the implementation plan for why.

## 5. Directory structure

```
nexustrace/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entrypoint
│   │   ├── config.py            # shared constants
│   │   ├── schemas.py           # THE CONTRACT -- shared data shapes
│   │   ├── ingestion/           # Phase 2
│   │   ├── correlation/         # Phase 3+4
│   │   ├── graph/               # Phase 5
│   │   ├── features/            # Phase 6
│   │   ├── ml/                  # Phase 7
│   │   ├── explain/             # Phase 8
│   │   ├── geoip/               # Phase 9 (P1)
│   │   ├── storage/             # Phase 10.2
│   │   └── api/                 # Phase 10.1
│   ├── data/sample/             # fabricated CSV/JSON with a planted anomaly
│   ├── tests/                   # pytest-style tests, verified logic
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Phase 11 -- ties everything together
│   │   ├── api/client.js        # thin fetch wrapper
│   │   └── components/
│   │       ├── LeadList.jsx
│   │       ├── LeadDetail.jsx
│   │       └── GraphView.jsx    # the 3D graph
│   └── package.json
└── scripts/
    └── run_pipeline.py          # CLI debugging shortcut, no web server needed
```

## 6. Running the backend tests yourself

```bash
cd backend
pip install pytest
pytest tests/ -v
```

All 16 tests should pass, including the two that matter most:
`test_planted_anomaly_scores_highest` and
`test_planted_anomaly_has_high_fan_out` — these confirm the deliberately
unusual wallet in the sample data (`W_A12`) actually gets caught by the
pipeline, not just that the code runs without crashing.
