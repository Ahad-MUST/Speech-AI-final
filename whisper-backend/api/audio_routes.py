# api/audio_routes.py - Audio Processing Routes (ENHANCED AUDIO SERVING)

import uuid
import shutil
import json
import time
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Query
from fastapi.responses import FileResponse, StreamingResponse
from auth.middleware import get_current_user
from auth.models import User
from services.audio_processing_service import AudioProcessingService, processing_sessions
from config.settings import OUTPUT_DIR
import core.dependencies as deps
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["audio"])

# Create audios directory if it doesn't exist
AUDIOS_DIR = Path("audios")
AUDIOS_DIR.mkdir(exist_ok=True)

@router.post("/upload-audio")
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form(""),
    apply_preprocessing: str = Form("true"),
    num_speakers: str = Form(""),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and process audio file with queue management
    
    NEW: Audio files are now saved to audios/{user_id}/{timestamp}_{filename}
    for permanent storage and organization by user
    """
    if not deps.pipeline:
        raise HTTPException(status_code=503, detail="Pipeline not available")
    
    if not deps.queue_manager:
        raise HTTPException(status_code=503, detail="Queue system not available")
    
    # Generate session ID
    session_id = str(uuid.uuid4())
    
    # NEW FILE PATH STRUCTURE: audios/{user_id}/{timestamp}_{filename}
    user_audio_dir = AUDIOS_DIR / str(current_user.id)
    user_audio_dir.mkdir(exist_ok=True)
    
    # Add timestamp to filename for uniqueness
    timestamp = int(time.time())
    timestamped_filename = f"{timestamp}_{file.filename}"
    upload_path = user_audio_dir / timestamped_filename
    
    try:
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Get file size
    file_size = upload_path.stat().st_size
    
    # Prepare processing settings
    processing_settings = {
        "language": language if language else None,
        "preprocessing": apply_preprocessing.lower() == "true",
        "num_speakers": int(num_speakers) if num_speakers.isdigit() else None
    }
    
    # Add to queue
    try:
        queue_position = await deps.queue_manager.add_to_queue(
            user_id=current_user.id,
            user_email=current_user.email,
            session_id=session_id,
            filename=file.filename,  # Original filename (without timestamp)
            file_path=str(upload_path),  # Full path with timestamp
            file_size=file_size,
            processing_settings=processing_settings
        )
        
        # Always try to start next available item after adding to queue
        await deps.queue_manager.start_next_if_available()
        
        # Check if this session started processing
        updated_status = await deps.queue_manager.get_queue_status(session_id)
        if updated_status and updated_status["status"] == "PROCESSING":
            return {
                "session_id": session_id,
                "status": "processing",
                "queue_position": 0,
                "message": "Processing started immediately"
            }
        
        # If still queued, return queue position
        return {
            "session_id": session_id,
            "status": "queued",
            "queue_position": queue_position,
            "message": f"Your audio is at position {queue_position} in the queue"
        }
        
    except Exception as e:
        # Clean up file if queue addition fails
        if upload_path.exists():
            upload_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to add to queue: {str(e)}")

@router.get("/processing-status/{session_id}")
async def get_processing_status(session_id: str):
    """Get processing status for a session - now with queue support"""
    
    # First check queue system if available
    if deps.queue_manager:
        try:
            queue_status = await deps.queue_manager.get_queue_status(session_id)
            if queue_status:
                # If in queue system, return queue-based status
                if queue_status["status"] == "QUEUED":
                    return {
                        "session_id": session_id,
                        "status": "queued",
                        "queue_position": queue_status["queue_position"],
                        "message": f"Your position in queue: #{queue_status['queue_position']}",
                        "created_at": queue_status["created_at"]
                    }
                elif queue_status["status"] == "PROCESSING":
                    # Check if we have progress info in old system
                    if session_id in processing_sessions:
                        session = processing_sessions[session_id]
                        return {
                            "session_id": session_id,
                            "status": "processing", 
                            "progress": session.get("progress", 0),
                            "message": session.get("message", "Processing..."),
                            "created_at": queue_status["created_at"]
                        }
                    else:
                        return {
                            "session_id": session_id,
                            "status": "processing",
                            "progress": 0,
                            "message": "Processing in progress...",
                            "created_at": queue_status["created_at"]
                        }
                elif queue_status["status"] == "COMPLETED":
                    return {
                        "session_id": session_id,
                        "status": "completed",
                        "progress": 100,
                        "message": "Processing completed successfully",
                        "created_at": queue_status["created_at"],
                        "completed_at": queue_status["completed_at"]
                    }
                elif queue_status["status"] == "FAILED":
                    return {
                        "session_id": session_id,
                        "status": "failed",
                        "progress": 0,
                        "message": queue_status.get("error_message", "Processing failed"),
                        "created_at": queue_status["created_at"],
                        "completed_at": queue_status["completed_at"]
                    }
        except Exception as e:
            print(f"Error getting queue status: {e}")
    
    # Fallback to old system for backward compatibility
    if session_id not in processing_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = processing_sessions[session_id]
    return {
        "session_id": session_id,
        "status": session["status"],
        "progress": session["progress"],
        "message": session["message"],
        "created_at": session["created_at"].isoformat()
    }

@router.get("/results/{session_id}")
async def get_results(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get processing results for a session
    
    NEW: Now checks database first for permanent storage, then falls back
    to memory and filesystem for backward compatibility
    """
    
    # PRIORITY 1: Check database for completed transcripts
    try:
        from services.transcript_service import TranscriptService
        from database.models import db_manager
        
        transcript_service = TranscriptService(db_manager)
        transcript = transcript_service.get_transcript_by_session(
            session_id=session_id,
            user_id=current_user.id
        )
        
        if transcript:
            # Found in database - return from there
            transcript_dict = transcript.to_dict(
                include_segments=True,
                include_metadata=True
            )
            
            # Format for backward compatibility with frontend
            return {
                "session_id": session_id,
                "status": "completed",
                "filename": transcript.filename,
                "results": {
                    "segments": transcript_dict["segments"],
                    "metadata": transcript_dict.get("metadata", {}),
                    "speaker_stats": transcript_dict.get("speaker_stats", {})
                },
                "created_at": transcript_dict["created_at"],
                "output_dir": str(OUTPUT_DIR / session_id),
                "source": "database"
            }
    except Exception as e:
        print(f"Database lookup failed, falling back to memory/filesystem: {e}")
    
    # PRIORITY 2: Check if we have results in the old system (memory)
    if session_id in processing_sessions:
        session = processing_sessions[session_id]
        
        if session["status"] != "completed":
            raise HTTPException(status_code=400, detail="Processing not completed yet")
        
        if "results" not in session:
            raise HTTPException(status_code=404, detail="Results not found")
        
        # Get filename from different possible sources
        filename = session.get("filename") or session.get("file_path", "").split("/")[-1] or "audio_file"
        
        return {
            "session_id": session_id,
            "status": session["status"],
            "filename": filename,
            "results": session["results"],
            "created_at": session["created_at"].isoformat(),
            "output_dir": session.get("output_dir"),
            "source": "memory"
        }
    
    # PRIORITY 3: Check queue system and try filesystem
    if deps.queue_manager:
        try:
            queue_status = await deps.queue_manager.get_queue_status(session_id)
            if queue_status and queue_status["status"] == "COMPLETED":
                # Try to load results from file system
                output_dir = OUTPUT_DIR / session_id
                results_file = output_dir / f"{session_id}_results.json"
                
                if results_file.exists():
                    with open(results_file, 'r', encoding='utf-8') as f:
                        results = json.load(f)
                    
                    return {
                        "session_id": session_id,
                        "status": "completed",
                        "filename": queue_status["filename"],
                        "results": results,
                        "created_at": queue_status["created_at"],
                        "output_dir": str(output_dir),
                        "source": "filesystem"
                    }
                else:
                    raise HTTPException(status_code=404, detail="Results files not found")
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error getting results from queue: {e}")
    
    raise HTTPException(status_code=404, detail="Session not found")

@router.get("/audio/{session_id}")
async def get_audio_file(
    session_id: str,
    token: str = Query(None, description="Authentication token for HTML5 audio element")
):
    """
    ✅ ENHANCED: Get audio file for a specific transcript session
    Returns the original audio file for playback with proper streaming support
    
    Note: Accepts token as query parameter because HTML5 <audio> element
    cannot send custom headers. Token is validated the same way.
    
    Features:
    - Range request support for seeking
    - Proper CORS headers
    - Content-Type detection
    - Error handling
    """
    try:
        # ✅ Validate token from query parameter
        if not token:
            logger.warning(f"Audio request without token for session {session_id}")
            raise HTTPException(status_code=401, detail="Authentication token required")
        
        # ✅ Verify token and get user
        from auth.service import TokenService
        try:
            payload = TokenService.verify_token(token)
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token")
            user_id = int(user_id)
        except Exception as e:
            logger.error(f"Token validation error for session {session_id}: {e}")
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        # ✅ Check database for transcript with audio file path
        from services.transcript_service import TranscriptService
        from database.models import db_manager
        
        transcript_service = TranscriptService(db_manager)
        transcript = transcript_service.get_transcript_by_session(
            session_id=session_id,
            user_id=user_id
        )
        
        if not transcript:
            logger.warning(f"Transcript not found or access denied: session={session_id}, user={user_id}")
            raise HTTPException(status_code=404, detail="Transcript not found or access denied")
        
        audio_path = Path(transcript.audio_file_path)
        
        if not audio_path.exists():
            logger.error(f"Audio file not found on disk: {audio_path}")
            raise HTTPException(status_code=404, detail="Audio file not found on disk")
        
        # ✅ Determine media type from file extension
        media_type_map = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.m4a': 'audio/mp4',
            '.ogg': 'audio/ogg',
            '.flac': 'audio/flac',
            '.aac': 'audio/aac',
            '.wma': 'audio/x-ms-wma',
            '.webm': 'audio/webm'
        }
        media_type = media_type_map.get(audio_path.suffix.lower(), 'audio/mpeg')
        
        logger.info(f"Serving audio file: session={session_id}, path={audio_path}, type={media_type}")
        
        # ✅ Return with proper headers for streaming
        return FileResponse(
            path=str(audio_path),
            media_type=media_type,
            filename=transcript.filename,
            headers={
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Range, Accept-Encoding'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving audio file for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to serve audio file: {str(e)}")

@router.get("/download/{session_id}/{filename}")
async def download_file(session_id: str, filename: str):
    """Download a file from session output"""
    if session_id not in processing_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = processing_sessions[session_id]
    output_dir = session.get("output_dir")
    
    if not output_dir:
        raise HTTPException(status_code=404, detail="No output directory found")
    
    file_path = Path(output_dir) / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type='application/octet-stream'
    )