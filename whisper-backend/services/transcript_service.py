# services/transcript_service.py - Transcript History Service

import json
import logging
from typing import List, Optional, Dict
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from database.models import TranscriptHistory, DatabaseManager

logger = logging.getLogger(__name__)


class TranscriptService:
    """Service for managing transcript history operations"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def get_db_session(self) -> Session:
        """Get database session"""
        return self.db_manager.get_session()
    
    def create_transcript(
        self,
        session_id: str,
        user_id: int,
        user_email: str,
        filename: str,
        audio_file_path: str,
        audio_file_size: int,
        segments: List[Dict],
        metadata: Optional[Dict] = None,
        speaker_stats: Optional[Dict] = None,
        processing_settings: Optional[Dict] = None,
        num_speakers: Optional[int] = None,
        language: Optional[str] = None,
        duration_seconds: Optional[float] = None
    ) -> Optional[TranscriptHistory]:
        """
        Create a new transcript history record
        
        Args:
            session_id: Unique session identifier
            user_id: User ID who owns this transcript
            user_email: User's email
            filename: Original filename
            audio_file_path: Path to stored audio file
            audio_file_size: File size in bytes
            segments: List of transcript segments
            metadata: Processing metadata
            speaker_stats: Speaker statistics
            processing_settings: Settings used for processing
            num_speakers: Number of speakers detected
            language: Language code
            duration_seconds: Audio duration
            
        Returns:
            Created TranscriptHistory object or None if failed
        """
        db = self.get_db_session()
        try:
            # Create transcript record
            # Note: metadata parameter is stored as 'processing_metadata' in database to avoid SQLAlchemy conflict
            transcript = TranscriptHistory(
                session_id=session_id,
                user_id=user_id,
                user_email=user_email,
                filename=filename,
                audio_file_path=audio_file_path,
                audio_file_size=audio_file_size,
                segments=json.dumps(segments, ensure_ascii=False),
                processing_metadata=json.dumps(metadata, ensure_ascii=False) if metadata else None,
                speaker_stats=json.dumps(speaker_stats, ensure_ascii=False) if speaker_stats else None,
                processing_settings=json.dumps(processing_settings, ensure_ascii=False) if processing_settings else None,
                num_speakers=num_speakers,
                language=language,
                duration_seconds=duration_seconds,
                completed_at=datetime.utcnow()
            )
            
            db.add(transcript)
            db.commit()
            db.refresh(transcript)
            
            logger.info(f"Created transcript history for session {session_id}")
            return transcript
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating transcript history: {e}")
            return None
        finally:
            db.close()
    
    def get_transcript_by_id(self, transcript_id: int, user_id: int) -> Optional[TranscriptHistory]:
        """
        Get transcript by ID with user verification
        
        Args:
            transcript_id: Transcript ID
            user_id: User ID for verification
            
        Returns:
            TranscriptHistory object or None if not found/unauthorized
        """
        db = self.get_db_session()
        try:
            transcript = db.query(TranscriptHistory).filter(
                TranscriptHistory.id == transcript_id,
                TranscriptHistory.user_id == user_id,
                TranscriptHistory.is_deleted == False
            ).first()
            
            return transcript
            
        finally:
            db.close()
    
    def get_transcript_by_session(self, session_id: str, user_id: int) -> Optional[TranscriptHistory]:
        """
        Get transcript by session ID with user verification
        
        Args:
            session_id: Session ID
            user_id: User ID for verification
            
        Returns:
            TranscriptHistory object or None if not found/unauthorized
        """
        db = self.get_db_session()
        try:
            transcript = db.query(TranscriptHistory).filter(
                TranscriptHistory.session_id == session_id,
                TranscriptHistory.user_id == user_id,
                TranscriptHistory.is_deleted == False
            ).first()
            
            return transcript
            
        finally:
            db.close()
    
    def list_user_transcripts(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        include_deleted: bool = False
    ) -> List[TranscriptHistory]:
        """
        List all transcripts for a user
        
        Args:
            user_id: User ID
            limit: Maximum number of results
            offset: Offset for pagination
            include_deleted: Whether to include soft-deleted transcripts
            
        Returns:
            List of TranscriptHistory objects
        """
        db = self.get_db_session()
        try:
            query = db.query(TranscriptHistory).filter(
                TranscriptHistory.user_id == user_id
            )
            
            if not include_deleted:
                query = query.filter(TranscriptHistory.is_deleted == False)
            
            transcripts = query.order_by(
                desc(TranscriptHistory.created_at)
            ).limit(limit).offset(offset).all()
            
            return transcripts
            
        finally:
            db.close()
    
    def search_transcripts(
        self,
        user_id: int,
        search_query: str,
        limit: int = 50
    ) -> List[TranscriptHistory]:
        """
        Search transcripts by filename or content
        
        Args:
            user_id: User ID
            search_query: Search string
            limit: Maximum number of results
            
        Returns:
            List of matching TranscriptHistory objects
        """
        db = self.get_db_session()
        try:
            # Search in filename
            transcripts = db.query(TranscriptHistory).filter(
                TranscriptHistory.user_id == user_id,
                TranscriptHistory.is_deleted == False,
                or_(
                    TranscriptHistory.filename.ilike(f"%{search_query}%"),
                    TranscriptHistory.segments.ilike(f"%{search_query}%")
                )
            ).order_by(
                desc(TranscriptHistory.created_at)
            ).limit(limit).all()
            
            return transcripts
            
        finally:
            db.close()
    
    def update_filename(
        self,
        session_id: str,
        user_id: int,
        new_filename: str
    ) -> bool:
        """
        Update the filename for a transcript
        
        Args:
            session_id: Session ID of the transcript
            user_id: User ID for verification
            new_filename: New filename to set
            
        Returns:
            True if successful, False otherwise
        """
        db = self.get_db_session()
        try:
            # Find the transcript
            transcript = db.query(TranscriptHistory).filter(
                TranscriptHistory.session_id == session_id,
                TranscriptHistory.user_id == user_id,
                TranscriptHistory.is_deleted == False
            ).first()
            
            if not transcript:
                return False
            
            # Update the filename
            transcript.filename = new_filename
            
            # Commit changes
            db.commit()
            
            logger.info(f"Updated filename for session {session_id} to {new_filename}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating filename: {e}")
            return False
        finally:
            db.close()
    
    def delete_transcript(self, transcript_id: int, user_id: int, hard_delete: bool = False) -> bool:
        """
        Delete transcript (soft delete by default)
        
        Args:
            transcript_id: Transcript ID
            user_id: User ID for verification
            hard_delete: If True, permanently delete; if False, soft delete
            
        Returns:
            True if successful, False otherwise
        """
        db = self.get_db_session()
        try:
            transcript = db.query(TranscriptHistory).filter(
                TranscriptHistory.id == transcript_id,
                TranscriptHistory.user_id == user_id
            ).first()
            
            if not transcript:
                logger.warning(f"Transcript {transcript_id} not found or unauthorized for user {user_id}")
                return False
            
            if hard_delete:
                # Permanently delete
                db.delete(transcript)
                logger.info(f"Hard deleted transcript {transcript_id}")
            else:
                # Soft delete
                transcript.is_deleted = True
                logger.info(f"Soft deleted transcript {transcript_id}")
            
            db.commit()
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting transcript {transcript_id}: {e}")
            return False
        finally:
            db.close()
    
    def delete_transcript_by_session(self, session_id: str, user_id: int, hard_delete: bool = False) -> bool:
        """
        Delete transcript by session ID (soft delete by default)
        
        Args:
            session_id: Session ID
            user_id: User ID for verification
            hard_delete: If True, permanently delete; if False, soft delete
            
        Returns:
            True if successful, False otherwise
        """
        db = self.get_db_session()
        try:
            transcript = db.query(TranscriptHistory).filter(
                TranscriptHistory.session_id == session_id,
                TranscriptHistory.user_id == user_id
            ).first()
            
            if not transcript:
                logger.warning(f"Transcript with session {session_id} not found or unauthorized for user {user_id}")
                return False
            
            if hard_delete:
                # Permanently delete
                db.delete(transcript)
                logger.info(f"Hard deleted transcript with session {session_id}")
            else:
                # Soft delete
                transcript.is_deleted = True
                logger.info(f"Soft deleted transcript with session {session_id}")
            
            db.commit()
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting transcript with session {session_id}: {e}")
            return False
        finally:
            db.close()
    
    def get_user_stats(self, user_id: int) -> Dict:
        """
        Get statistics for a user's transcripts
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with statistics
        """
        db = self.get_db_session()
        try:
            from sqlalchemy import func
            
            # Total transcripts
            total = db.query(func.count(TranscriptHistory.id)).filter(
                TranscriptHistory.user_id == user_id,
                TranscriptHistory.is_deleted == False
            ).scalar()
            
            # Total duration
            total_duration = db.query(func.sum(TranscriptHistory.duration_seconds)).filter(
                TranscriptHistory.user_id == user_id,
                TranscriptHistory.is_deleted == False
            ).scalar() or 0
            
            # Language breakdown
            languages = db.query(
                TranscriptHistory.language,
                func.count(TranscriptHistory.id)
            ).filter(
                TranscriptHistory.user_id == user_id,
                TranscriptHistory.is_deleted == False,
                TranscriptHistory.language.isnot(None)
            ).group_by(TranscriptHistory.language).all()
            
            language_stats = {lang: count for lang, count in languages}
            
            # This month's count
            from datetime import datetime, timedelta
            month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            this_month = db.query(func.count(TranscriptHistory.id)).filter(
                TranscriptHistory.user_id == user_id,
                TranscriptHistory.is_deleted == False,
                TranscriptHistory.created_at >= month_start
            ).scalar()
            
            return {
                "total_transcripts": total,
                "total_duration_hours": round(total_duration / 3600, 2) if total_duration else 0,
                "languages": language_stats,
                "this_month": this_month
            }
            
        finally:
            db.close()
    
    def restore_transcript(self, transcript_id: int, user_id: int) -> bool:
        """
        Restore a soft-deleted transcript
        
        Args:
            transcript_id: Transcript ID
            user_id: User ID for verification
            
        Returns:
            True if successful, False otherwise
        """
        db = self.get_db_session()
        try:
            transcript = db.query(TranscriptHistory).filter(
                TranscriptHistory.id == transcript_id,
                TranscriptHistory.user_id == user_id,
                TranscriptHistory.is_deleted == True
            ).first()
            
            if not transcript:
                logger.warning(f"Deleted transcript {transcript_id} not found or unauthorized for user {user_id}")
                return False
            
            transcript.is_deleted = False
            db.commit()
            
            logger.info(f"Restored transcript {transcript_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error restoring transcript {transcript_id}: {e}")
            return False
        finally:
            db.close()