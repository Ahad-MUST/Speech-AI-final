# api/queue_routes.py - Queue Management Routes

from fastapi import APIRouter, HTTPException
from datetime import datetime
import core.dependencies as deps

router = APIRouter(prefix="/api", tags=["queue"])

@router.get("/queue/stats")
async def get_queue_stats():
    """Get queue statistics"""
    if not deps.queue_manager:
        raise HTTPException(status_code=503, detail="Queue system not available")
    
    try:
        stats = await deps.queue_manager.get_queue_stats()
        return {
            "queue_stats": stats,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get queue stats: {str(e)}")

@router.get("/queue/health")
async def queue_health_check():
    """Check queue health and auto-fix issues"""
    if not deps.queue_manager:
        raise HTTPException(status_code=503, detail="Queue system not available")
    
    try:
        # Run cleanup
        cleaned = await deps.queue_manager.cleanup_expired_sessions()
        
        # Get current stats
        stats = await deps.queue_manager.get_queue_stats()
        
        return {
            "status": "healthy",
            "cleaned_sessions": cleaned,
            "queue_stats": stats,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@router.post("/admin/reset-queue")
async def reset_queue_state():
    """Reset queue to consistent state (emergency fix)"""
    if not deps.queue_manager:
        raise HTTPException(status_code=503, detail="Queue system not available")
    
    try:
        from database.models import AudioQueue
        # Force all stuck PROCESSING items to FAILED
        db = deps.queue_manager.get_db_session()
        try:
            stuck_items = db.query(AudioQueue).filter(
                AudioQueue.status == "PROCESSING"
            ).all()
            
            reset_count = 0
            for item in stuck_items:
                item.status = "FAILED"
                item.error_message = "Reset by admin - queue consistency fix"
                item.completed_at = datetime.utcnow()
                reset_count += 1
            
            db.commit()
            
            # Recalculate positions and start next items
            await deps.queue_manager._recalculate_queue_positions()
            started = await deps.queue_manager.force_queue_consistency()
            
            return {
                "message": f"Reset {reset_count} stuck sessions, started {started} new ones",
                "reset_sessions": reset_count,
                "started_sessions": started
            }
        finally:
            db.close()
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

@router.get("/admin/queue-debug")
async def queue_debug():
    """Debug queue state"""
    if not deps.queue_manager:
        return {"error": "Queue manager not available"}
    
    from database.models import AudioQueue
    db = deps.queue_manager.get_db_session()
    try:
        all_sessions = db.query(AudioQueue).all()
        
        debug_info = {
            "total_sessions": len(all_sessions),
            "by_status": {},
            "processing_sessions": [],
            "queued_sessions": []
        }
        
        for session in all_sessions:
            status = session.status
            debug_info["by_status"][status] = debug_info["by_status"].get(status, 0) + 1
            
            if status == "PROCESSING":
                debug_info["processing_sessions"].append({
                    "session_id": session.session_id,
                    "filename": session.filename,
                    "started_at": session.started_processing_at.isoformat() if session.started_processing_at else None
                })
            elif status == "QUEUED":
                debug_info["queued_sessions"].append({
                    "session_id": session.session_id,
                    "filename": session.filename,
                    "position": session.queue_position,
                    "created_at": session.created_at.isoformat()
                })
        
        return debug_info
    finally:
        db.close()

@router.post("/admin/init-prompts")
async def init_default_prompts():
    """Initialize default prompts"""
    if not deps.db_manager:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        deps.db_manager.init_default_prompts()
        return {"message": "Default prompts initialized successfully"}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to initialize prompts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize prompts: {str(e)}")