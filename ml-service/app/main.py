from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import DATABASE_URL, PORT
from app.routes.health import router as health_router
from app.routes.risk import router as risk_router
from app.mentor_alerts.routes import router as mentor_alerts_router, set_pool
from app.risk_engine.calculator import load_model
from app.utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    loaded = load_model()
    if loaded:
        logger.info("ML model loaded successfully")
    else:
        logger.info("ML model not available — predictions will return NOT_READY")

    pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    app.state.db_pool = pool
    set_pool(pool)
    yield
    await pool.close()


app = FastAPI(
    title="HOPE ML Service",
    description="AI/ML service for the HOPE Engagement Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, tags=["health"])
app.include_router(risk_router, prefix="/api/risk", tags=["risk"])
app.include_router(mentor_alerts_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)
