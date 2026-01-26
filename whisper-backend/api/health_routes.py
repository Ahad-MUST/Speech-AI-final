# api/health_routes.py - Health Check Routes

from fastapi import APIRouter
from fastapi.responses import FileResponse
from datetime import datetime
from pathlib import Path
from services.tailscale_service import TailscaleManager
from services.llm_service import LLMService
from config.settings import STATIC_DIR
import core.dependencies as deps

router = APIRouter()
tailscale_manager = TailscaleManager()

@router.get("/")
async def root():
    """Serve main page or redirect to docs"""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Enhanced Speech Diarization API", "docs": "/docs"}

@router.get("/health")
async def health_check():
    """Enhanced health check with all system status"""
    tailscale_ip = tailscale_manager.get_tailscale_ip()
    is_connected = tailscale_manager.is_connected()
    ollama_status = await LLMService.check_ollama_status()
    
    try:
        from database.models import DatabaseManager
        DATABASE_AVAILABLE = True
    except ImportError:
        DATABASE_AVAILABLE = False
    
    return {
        "status": "healthy",
        "message": "Enhanced backend server running",
        "timestamp": datetime.now().isoformat(),
        "database": {
            "available": DATABASE_AVAILABLE,
            "status": "connected" if DATABASE_AVAILABLE else "fallback_mode"
        },
        "tailscale": {
            "connected": is_connected,
            "ip": tailscale_ip,
            "url": f"http://{tailscale_ip}:8888" if tailscale_ip else None
        },
        "features": {
            "pipeline_available": deps.pipeline is not None,
            "whisper_model": getattr(deps.pipeline, 'whisper_model', 'not loaded'),
            "preprocessing": getattr(deps.pipeline, 'enable_preprocessing', False)
        },
        "llm": ollama_status
    }

@router.get("/profile1")
async def get_profile():
    return {"message": "Hello World"}