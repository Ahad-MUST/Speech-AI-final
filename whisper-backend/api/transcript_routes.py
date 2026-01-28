# api/transcript_routes.py - Transcript History API Routes

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from pydantic import BaseModel
import logging
import os

from auth.middleware import get_current_user
from auth.models import User
from services.transcript_service import TranscriptService
from database.models import db_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcriptions", tags=["transcriptions"])

# Initialize transcript service
transcript_service = TranscriptService(db_manager)


# Pydantic models for request/response
class TranscriptListItem(BaseModel):
    """Lightweight transcript info for list view"""
    id: int
    session_id: str
    filename: str
    num_speakers: Optional[int]
    language: Optional[str]
    duration_seconds: Optional[float]
    created_at: str
    audio_file_size: int
    
    class Config:
        from_attributes = True


class TranscriptDetail(BaseModel):
    """Full transcript details"""
    id: int
    session_id: str
    user_id: int
    user_email: str
    filename: str
    audio_file_path: str
    audio_file_size: int
    segments: List[dict]
    metadata: Optional[dict]
    speaker_stats: Optional[dict]
    processing_settings: Optional[dict] = None
    num_speakers: Optional[int]
    language: Optional[str]
    duration_seconds: Optional[float]
    created_at: str
    completed_at: Optional[str]
    is_deleted: bool
    
    class Config:
        from_attributes = True


class TranscriptStats(BaseModel):
    """User transcript statistics"""
    total_transcripts: int
    total_duration_hours: float
    languages: dict
    this_month: int


class RenameAudioRequest(BaseModel):
    """Request to rename an audio file"""
    new_filename: str


@router.get("/", response_model=List[TranscriptListItem])
async def list_transcripts(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user)
):
    """
    List all transcripts for the current user
    
    Returns lightweight transcript info optimized for sidebar display
    Sorted by creation date (newest first)
    """
    try:
        transcripts = transcript_service.list_user_transcripts(
            user_id=current_user.id,
            limit=limit,
            offset=offset,
            include_deleted=False
        )
        
        # Convert to response format
        result = []
        for t in transcripts:
            result.append(TranscriptListItem(
                id=t.id,
                session_id=t.session_id,
                filename=t.filename,
                num_speakers=t.num_speakers,
                language=t.language,
                duration_seconds=t.duration_seconds,
                created_at=t.created_at.isoformat() if t.created_at else None,
                audio_file_size=t.audio_file_size
            ))
        
        logger.info(f"User {current_user.id} listed {len(result)} transcripts")
        return result
        
    except Exception as e:
        logger.error(f"Error listing transcripts for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list transcripts: {str(e)}")


@router.get("/search")
async def search_transcripts(
    q: str = Query(..., min_length=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """
    Search transcripts by filename or content
    """
    try:
        transcripts = transcript_service.search_transcripts(
            user_id=current_user.id,
            search_query=q,
            limit=limit
        )
        
        # Convert to response format
        result = []
        for t in transcripts:
            result.append(TranscriptListItem(
                id=t.id,
                session_id=t.session_id,
                filename=t.filename,
                num_speakers=t.num_speakers,
                language=t.language,
                duration_seconds=t.duration_seconds,
                created_at=t.created_at.isoformat() if t.created_at else None,
                audio_file_size=t.audio_file_size
            ))
        
        logger.info(f"User {current_user.id} searched for '{q}' - found {len(result)} results")
        return result
        
    except Exception as e:
        logger.error(f"Error searching transcripts for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/{session_id}", response_model=TranscriptDetail)
async def get_transcript(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get full transcript details by session ID
    
    Returns complete transcript with segments, metadata, and statistics
    """
    try:
        transcript = transcript_service.get_transcript_by_session(
            session_id=session_id,
            user_id=current_user.id
        )
        
        if not transcript:
            raise HTTPException(
                status_code=404,
                detail=f"Transcript with session ID '{session_id}' not found or access denied"
            )
        
        # Convert to dict with all fields
        transcript_dict = transcript.to_dict(
            include_segments=True,
            include_metadata=True
        )
        
        logger.info(f"User {current_user.id} retrieved transcript {session_id}")
        return TranscriptDetail(**transcript_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting transcript {session_id} for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve transcript: {str(e)}")


@router.put("/{session_id}")
async def update_transcript(
    session_id: str,
    edit_data: dict,
    current_user: User = Depends(get_current_user)
):
    """
    Update transcript with edited segments and speaker mappings
    """
    try:
        # Verify transcript exists and user has access
        transcript = transcript_service.get_transcript_by_session(
            session_id=session_id,
            user_id=current_user.id
        )
        
        if not transcript:
            raise HTTPException(
                status_code=404,
                detail=f"Transcript with session ID '{session_id}' not found or access denied"
            )
        
        # Extract segments and speaker mappings from request
        segments = edit_data.get('segments', [])
        speaker_mappings = edit_data.get('speaker_mappings', {})
        
        if not segments:
            raise HTTPException(
                status_code=400,
                detail="No segments provided for update"
            )
        
        # Convert segments to proper format
        updated_segments = []
        for seg in segments:
            updated_segments.append({
                "speaker": seg.get("speaker", "Unknown"),
                "text": seg.get("text", ""),
                "start": float(seg.get("start", 0.0)),
                "end": float(seg.get("end", 0.0))
            })
        
        # Update the transcript using the database directly
        import json
        from database.models import db_manager, TranscriptHistory
        db = db_manager.get_session()
        
        try:
            # Find and update the transcript
            db_transcript = db.query(TranscriptHistory).filter(
                TranscriptHistory.session_id == session_id,
                TranscriptHistory.user_id == current_user.id
            ).first()
            
            if not db_transcript:
                raise HTTPException(status_code=404, detail="Transcript not found")
            
            # Update segments (must be JSON string)
            db_transcript.segments = json.dumps(updated_segments)
            
            # Update processing_metadata with speaker mappings
            processing_metadata = json.loads(db_transcript.processing_metadata) if db_transcript.processing_metadata else {}
            processing_metadata['speaker_mappings'] = speaker_mappings
            
            # Update speaker count
            db_transcript.num_speakers = len(set(seg['speaker'] for seg in updated_segments))
            
            # Recalculate speaker stats
            speaker_stats = {}
            for segment in updated_segments:
                speaker = segment["speaker"]
                if speaker not in speaker_stats:
                    speaker_stats[speaker] = {
                        "segments": 0,
                        "total_duration": 0,
                        "word_count": 0
                    }
                
                speaker_stats[speaker]["segments"] += 1
                speaker_stats[speaker]["total_duration"] += (segment["end"] - segment["start"])
                speaker_stats[speaker]["word_count"] += len(segment["text"].split())
            
            # Update speaker stats in processing_metadata
            processing_metadata['speaker_stats'] = speaker_stats
            db_transcript.processing_metadata = json.dumps(processing_metadata)
            
            # Commit changes
            db.commit()
            db.refresh(db_transcript)
            
            logger.info(f"User {current_user.id} updated transcript {session_id}")
            
            # Return updated transcript
            return {
                "success": True,
                "message": "Transcript updated successfully",
                "session_id": session_id,
                "updated_segments": len(updated_segments),
                "speaker_mappings_applied": len(speaker_mappings),
                "transcript": {
                    "id": db_transcript.id,
                    "session_id": db_transcript.session_id,
                    "segments": json.loads(db_transcript.segments),
                    "metadata": json.loads(db_transcript.processing_metadata) if db_transcript.processing_metadata else {},
                    "num_speakers": db_transcript.num_speakers
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Database error updating transcript: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update transcript: {str(e)}")
        finally:
            db.close()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating transcript {session_id} for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update transcript: {str(e)}")


@router.patch("/{session_id}/rename", response_model=TranscriptListItem)
async def rename_audio(
    session_id: str,
    request: RenameAudioRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Rename an audio file
    
    Args:
        session_id: Session ID of the transcript
        request: Contains new_filename
        current_user: Current authenticated user
        
    Returns:
        Updated transcript info
    """
    try:
        # Validate filename
        new_filename = request.new_filename.strip()
        if not new_filename:
            raise HTTPException(status_code=400, detail="Filename cannot be empty")
        
        # Check for invalid characters
        invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
        if any(char in new_filename for char in invalid_chars):
            raise HTTPException(
                status_code=400, 
                detail=f"Filename contains invalid characters: {', '.join(invalid_chars)}"
            )
        
        # Ensure filename has extension
        if not new_filename.endswith(('.mp3', '.wav', '.m4a', '.flac', '.ogg', '.wma')):
            # Try to preserve original extension
            transcript = transcript_service.get_transcript_by_session(
                session_id=session_id,
                user_id=current_user.id
            )
            if transcript:
                original_ext = os.path.splitext(transcript.filename)[1]
                if original_ext:
                    new_filename = new_filename + original_ext
        
        # Update the filename
        success = transcript_service.update_filename(
            session_id=session_id,
            user_id=current_user.id,
            new_filename=new_filename
        )
        
        if not success:
            raise HTTPException(
                status_code=404, 
                detail="Transcript not found or you don't have permission to rename it"
            )
        
        # Get updated transcript
        transcript = transcript_service.get_transcript_by_session(
            session_id=session_id,
            user_id=current_user.id
        )
        
        if not transcript:
            raise HTTPException(status_code=404, detail="Transcript not found after update")
        
        logger.info(f"User {current_user.id} renamed audio {session_id} to {new_filename}")
        
        # Return updated transcript info
        return TranscriptListItem(
            id=transcript.id,
            session_id=transcript.session_id,
            filename=transcript.filename,
            num_speakers=transcript.num_speakers,
            language=transcript.language,
            duration_seconds=transcript.duration_seconds,
            created_at=transcript.created_at.isoformat(),
            audio_file_size=transcript.audio_file_size
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error renaming audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{session_id}")
async def delete_transcript(
    session_id: str,
    hard_delete: bool = Query(False, description="Permanently delete (cannot be undone)"),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a transcript (soft delete by default)
    
    - Soft delete (default): Sets is_deleted flag, can be restored
    - Hard delete (hard_delete=true): Permanently removes from database
    """
    try:
        success = transcript_service.delete_transcript_by_session(
            session_id=session_id,
            user_id=current_user.id,
            hard_delete=hard_delete
        )
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Transcript with session ID '{session_id}' not found or access denied"
            )
        
        delete_type = "permanently deleted" if hard_delete else "deleted"
        logger.info(f"User {current_user.id} {delete_type} transcript {session_id}")
        
        return {
            "success": True,
            "message": f"Transcript {delete_type} successfully",
            "session_id": session_id,
            "hard_delete": hard_delete
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting transcript {session_id} for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete transcript: {str(e)}")


@router.post("/{transcript_id}/restore")
async def restore_transcript(
    transcript_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Restore a soft-deleted transcript
    """
    try:
        success = transcript_service.restore_transcript(
            transcript_id=transcript_id,
            user_id=current_user.id
        )
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Deleted transcript with ID {transcript_id} not found or access denied"
            )
        
        logger.info(f"User {current_user.id} restored transcript {transcript_id}")
        
        return {
            "success": True,
            "message": "Transcript restored successfully",
            "transcript_id": transcript_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring transcript {transcript_id} for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to restore transcript: {str(e)}")


@router.get("/stats/overview", response_model=TranscriptStats)
async def get_user_stats(
    current_user: User = Depends(get_current_user)
):
    """
    Get transcript statistics for the current user
    
    Returns:
    - Total transcript count
    - Total duration in hours
    - Language breakdown
    - This month's transcript count
    """
    try:
        stats = transcript_service.get_user_stats(user_id=current_user.id)
        
        logger.info(f"User {current_user.id} retrieved transcript stats")
        return TranscriptStats(**stats)
        
    except Exception as e:
        logger.error(f"Error getting stats for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve statistics: {str(e)}")