# main.py - Enhanced Speech Diarization API Entry Point (UPDATED WITH TRANSCRIPT ROUTER)

from dotenv import load_dotenv
load_dotenv()

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Import core components
from core.lifespan import lifespan
from config.settings import STATIC_DIR

# Import routers
from api.health_routes import router as health_router
from api.audio_routes import router as audio_router
from api.llm_routes import router as llm_router
from api.queue_routes import router as queue_router

# Database and Auth routers (conditional imports)
try:
    from api.prompt_routes import router as prompt_router
    PROMPT_ROUTER_AVAILABLE = True
except ImportError:
    PROMPT_ROUTER_AVAILABLE = False
    prompt_router = None

# NEW: Transcript history router
try:
    from api.transcript_routes import router as transcript_router
    TRANSCRIPT_ROUTER_AVAILABLE = True
except ImportError:
    TRANSCRIPT_ROUTER_AVAILABLE = False
    transcript_router = None
    print("⚠️  Transcript router not available")

try:
    from auth.routes import create_auth_router
    from database.models import DatabaseManager
    AUTH_ROUTER_AVAILABLE = True
    DATABASE_AVAILABLE = True
except ImportError:
    AUTH_ROUTER_AVAILABLE = False
    DATABASE_AVAILABLE = False

# Create FastAPI app
app = FastAPI(
    title="Enhanced Speech Diarization API",
    description="GDPR-compliant speech diarization with LLM analysis, database-driven prompt management, and transcript history",
    version="2.1.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(audio_router)
app.include_router(llm_router)
app.include_router(queue_router)

# Include prompt management routes if available
if PROMPT_ROUTER_AVAILABLE and prompt_router:
    app.include_router(prompt_router, tags=["prompts"])
    print("✅ Prompt management routes included")
else:
    print("❌ Prompt router not available")

# NEW: Include transcript history routes if available
if TRANSCRIPT_ROUTER_AVAILABLE and transcript_router:
    app.include_router(transcript_router, tags=["transcriptions"])
    print("✅ Transcript history routes included")
else:
    print("❌ Transcript router not available")

# Include auth routes if available - will be registered during lifespan startup
# Note: Auth router needs db_manager which is initialized during lifespan
# So we'll register it dynamically after startup
if AUTH_ROUTER_AVAILABLE and DATABASE_AVAILABLE:
    print("⏳ Authentication routes will be registered after startup")
else:
    print("❌ Auth router not available")

# Serve static files
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8888,
        reload=False,
        log_level="info"
    )