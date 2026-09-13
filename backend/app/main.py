from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.storage.db import init_db
from app.api.routes import router

app = FastAPI(
    title="NexusTrace API",
    description="AI-Powered Cross-Layer Correlation & Explainable Anomaly Detection for Bitcoin Networks (NTRO SIH26146)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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