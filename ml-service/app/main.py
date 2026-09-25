from fastapi import FastAPI
from app.routes.health import router as health_router
from app.routes.risk import router as risk_router
from app.risk_engine.calculator import load_model
from app.utils.logger import logger

app = FastAPI(title="HOPE ML Service", version="1.0.0")

app.include_router(health_router, tags=["health"])
app.include_router(risk_router, prefix="/api/risk", tags=["risk"])


@app.on_event("startup")
def startup_event():
    loaded = load_model()
    if loaded:
        logger.info("ML model loaded successfully")
    else:
        logger.info("ML model not available — predictions will return NOT_READY")
