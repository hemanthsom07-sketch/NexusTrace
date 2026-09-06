# Implementation Status

Matches the phases from the implementation plan. ✅ = built and tested,
🟡 = stubbed/degrades gracefully, ⬜ = not built (intentionally, per plan).

| Phase | Status | Notes |
|---|---|---|
| 1 — Repository architecture | ✅ | `schemas.py` is the locked contract |
| 2 — Data ingestion & normalization | ✅ | CSV/JSON tested; XML stubbed (raises `NotImplementedError`, build only if real dataset needs it) |
| 3 — Cross-layer correlation | ✅ | Time-window matcher, tested |
| 4 — Confidence scoring | ✅ | Simple, explainable formula: Δt-based + port-match boost |
| 5 — Entity & transaction graph | ✅ | NetworkX, in-memory, tested |
| 6 — Feature engineering | ✅ | P0 feature set only (velocity, fan-in/out, distinct IPs, amounts). Burstiness/centrality = P1, not built |
| 7 — Isolation Forest | ✅ | Retrains on every run (no persistence -- fine at this data scale) |
| 8 — Evidence & explainability | ✅ | Threshold-based (not SHAP -- that's P2) |
| 9 — GeoIP/ASN enrichment | 🟡 | Code is there, degrades to `None` if `geoip2` isn't installed or no `.mmdb` file present. Not wired into the API yet. |
| 10 — FastAPI integration | ✅ | 3 endpoints only, logic-tested via a stub (see README) |
| 11 — React dashboard | ✅ (untested in-browser) | Syntax-checked, not yet run with real `npm install` |
| 12 — E2E testing & demo prep | ⬜ | This is on your team once you have internet access to actually run both servers together |

## Explicitly NOT built (per the plan's own scope discipline)

- SHAP explainability (threshold-based reasons are the P0 approach)
- Clustering as a second ML signal
- Model persistence (retrain-on-run is fine at this scale)
- Auth / multi-user
- Pagination / filtering
- XML ingestion (add only if your real dataset needs it)
- Any accuracy claim or benchmark number

## First things to check once you have internet access

1. `pip install -r backend/requirements.txt` then `python scripts/run_pipeline.py`
   — should reproduce the exact output shown in the build log (W_A12 on top,
   score ~1.0, HIGH severity).
2. `uvicorn app.main:app --reload --port 8000` then `curl -X POST localhost:8000/api/pipeline/run`
   — should return `{"status": "ok", ...}` with 19 events, 18 transactions.
3. `cd frontend && npm install && npm run dev` — if `react-force-graph-3d`
   has install issues, see the fallback note in the main README.
