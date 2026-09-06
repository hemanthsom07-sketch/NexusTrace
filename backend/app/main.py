"""
main.py -- FastAPI entrypoint. Run with:
    uvicorn app.main:app --reload --port 8000
from inside the backend/ directory.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.storage.db import init_db
from app.api.routes import router

app = FastAPI(
    title="NexusTrace API",
    description="AI-Powered Cross-Layer Correlation & Explainable Anomaly "
                "Detection for Bitcoin Transaction Networks (SIH26146)",
    version="0.1.0",
)

# Dev-mode CORS -- React runs on a different port (5173) during local dev.
# This is intentionally permissive for a hackathon prototype; tighten before
# any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "service": "nexustrace-backend"}
