# core/lifespan.py - Application Lifespan Management

import asyncio
import concurrent.futures
from contextlib import asynccontextmanager
from fastapi import FastAPI
import core.dependencies as deps
from services.tailscale_service import TailscaleManager
from services.llm_service import LLMService

tailscale_manager = TailscaleManager()

async def periodic_queue_cleanup():
    """Run periodic cleanup of stuck sessions"""
    while True:
        try:
            if deps.queue_manager:
                cleaned = await deps.queue_manager.cleanup_expired_sessions()
                if cleaned > 0:
                    print(f"Periodic cleanup: resolved {cleaned} stuck sessions")
        except Exception as e:
            print(f"Error in periodic cleanup: {e}")
        
        # Run every 10 minutes
        await asyncio.sleep(600)

async def display_startup_info():
    """Display connection information on startup"""
    tailscale_ip = tailscale_manager.get_tailscale_ip()
    is_connected = tailscale_manager.is_connected()
    ollama_status = await LLMService.check_ollama_status()
    
    print("=" * 80)
    print("ENHANCED SPEECH DIARIZATION + LLM BACKEND SERVER")
    print("=" * 80)
    print(f"Local URL: http://localhost:8888")
    print(f"Local Network: http://192.168.x.x:8888")
    
    if is_connected and tailscale_ip:
        print(f"Tailscale URL: http://{tailscale_ip}:8888")
        print(f"Tailscale IP: {tailscale_ip}")
        print("Tailscale connected - accessible from remote devices")
    else:
        print("Tailscale not connected - only local access available")
    
    print(f"API Documentation: http://localhost:8888/docs")
    print(f"Health Check: http://localhost:8888/health")
    
    # Database status
    try:
        from database.models import DatabaseManager
        DATABASE_AVAILABLE = True
    except ImportError:
        DATABASE_AVAILABLE = False
    
    if DATABASE_AVAILABLE:
        print("Database: Connected (SQLite)")
        print("Prompt Management: Available")
    else:
        print("Database: Not available (using fallback prompts)")
    
    # Ollama status
    if ollama_status["status"] == "connected":
        print(f"Ollama LLM: Connected ({ollama_status['current_model']})")
        if not ollama_status["model_available"]:
            print(f"Model {ollama_status['default']} not found. Available: {ollama_status['available_models']}")
    else:
        print("Ollama LLM: Disconnected")
        print("   Start Ollama: ollama serve")
        print(f"   Pull model: ollama pull {ollama_status['default']}")
    
    print("=" * 80)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("Starting Enhanced Speech Diarization API...")
    
    # Initialize database if available
    try:
        from database.models import DatabaseManager
        DATABASE_AVAILABLE = True
        deps.db_manager = DatabaseManager()
        
        try:
            deps.db_manager.create_tables()
            deps.db_manager.init_default_prompts()
            print("Database initialized successfully")
            
            # Register auth routes now that db_manager is available
            try:
                from auth.routes import create_auth_router
                auth_router = create_auth_router(deps.db_manager)
                app.include_router(auth_router)
                print("✅ Authentication routes registered")
                print("🔗 Login: /auth/login")
                print("🔗 Profile: /auth/me")
                print("🔗 Admin: /auth/admin/users")
            except Exception as e:
                print(f"⚠️  Auth router registration failed: {e}")
                
        except Exception as e:
            print(f"Database initialization failed: {e}")
    except ImportError:
        DATABASE_AVAILABLE = False
        print("Database not available")
    
    # Initialize AI pipeline
    try:
        print("Initializing Enhanced Speech Diarization Pipeline...")
        from services.pipeline_service import GDPRCompliantPipeline
        deps.pipeline = GDPRCompliantPipeline(
            whisper_model="base",
            device="auto",
            enable_preprocessing=True
        )
        print("AI Pipeline initialized successfully")
    except Exception as e:
        print(f"AI Pipeline initialization failed: {e}")
        print("   Some features may not be available")
    
    # Initialize Queue Manager
    if DATABASE_AVAILABLE and deps.db_manager:
        try:
            from services.queue_service import AudioQueueManager
            deps.queue_manager = AudioQueueManager(deps.db_manager, max_concurrent=1)
            await deps.queue_manager.recover_stuck_sessions()
            print("✅ Queue manager initialized and recovered")
        except Exception as e:
            print(f"❌ Queue manager initialization failed: {e}")
    else:
        print("❌ Queue manager not available - database required")

    # Initialize Thread Pool
    try:
        deps.thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        print("✅ Thread pool initialized with 1 worker")
    except Exception as e:
        print(f"❌ Thread pool initialization failed: {e}")

    # Start background cleanup task
    cleanup_task = None
    if deps.queue_manager:
        cleanup_task = asyncio.create_task(periodic_queue_cleanup())
        print("✅ Background cleanup task started")

    # Display connection info
    await display_startup_info()
    
    yield
    
    # Shutdown
    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
    print("Shutting down...")