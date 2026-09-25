from fastapi import APIRouter
from app.risk_engine.calculator import is_model_ready, get_model_metadata

router = APIRouter()


@router.get("/health")
def health_check():
    model_ready = is_model_ready()
    metadata = get_model_metadata() if model_ready else None
    return {
        "status": "healthy",
        "modelReady": model_ready,
        "model": metadata,
    }
