# services/audio_processing_service.py - Audio Processing Service (FIXED - FINAL VERSION)

import logging
import asyncio
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional
from functools import partial
from config.settings import OUTPUT_DIR

logger = logging.getLogger(__name__)

# Session storage
processing_sessions: Dict[str, Dict] = {}

def normalize_speaker_ids(results: Dict) -> Dict:
    """
    Normalize speaker IDs to be consecutive (0, 1, 2, ...) instead of (0, 1, 3, 5, ...)
    
    This fixes issues when diarization skips speaker IDs due to filtering or post-processing.
    Applied AFTER all diarization and transcription is complete, before database save.
    
    Args:
        results: Processing results dictionary containing segments
        
    Returns:
        Updated results with consecutive speaker IDs
    """
    if not results or 'segments' not in results:
        return results
    
    segments = results.get('segments', [])
    if not segments:
        return results
    
    # Find all unique speakers in order of appearance
    unique_speakers = []
    seen = set()
    for segment in segments:
        speaker = segment.get('speaker', 'SPEAKER_00')
        if speaker not in seen:
            unique_speakers.append(speaker)
            seen.add(speaker)
    
    # Create mapping: SPEAKER_00 -> SPEAKER_00, SPEAKER_01 -> SPEAKER_01, SPEAKER_03 -> SPEAKER_02, etc.
    speaker_mapping = {}
    for idx, old_speaker in enumerate(unique_speakers):
        new_speaker_id = f"SPEAKER_{idx:02d}"
        speaker_mapping[old_speaker] = new_speaker_id
    
    print(f"🔄 Normalizing speaker IDs: {speaker_mapping}")
    
    # Apply mapping to all segments
    for segment in segments:
        old_speaker = segment.get('speaker', 'SPEAKER_00')
        segment['speaker'] = speaker_mapping.get(old_speaker, old_speaker)
    
    # Update speaker_stats if present
    if 'speaker_stats' in results:
        old_stats = results['speaker_stats']
        new_stats = {}
        for old_speaker, stats in old_stats.items():
            new_speaker = speaker_mapping.get(old_speaker, old_speaker)
            new_stats[new_speaker] = stats
        results['speaker_stats'] = new_stats
    
    # Update speakers list if present
    if 'speakers' in results:
        results['speakers'] = [speaker_mapping.get(s, s) for s in results['speakers']]
    
    # Update timeline if present (same as segments)
    if 'timeline' in results:
        for segment in results['timeline']:
            old_speaker = segment.get('speaker', 'SPEAKER_00')
            segment['speaker'] = speaker_mapping.get(old_speaker, old_speaker)
    
    print(f"✅ Speaker IDs normalized: {len(unique_speakers)} speakers → {list(speaker_mapping.values())}")
    
    return results

class AudioProcessingService:
    """Service for handling audio processing operations"""
    
    def __init__(self, pipeline=None, thread_pool=None, queue_manager=None):
        self.pipeline = pipeline
        self.thread_pool = thread_pool
        self.queue_manager = queue_manager
    
    async def process_audio_background(self, session_id: str, file_path: Path):
        """Background task for audio processing - now with queue management and database save"""
        try:
            # Get processing settings and user info from queue if available
            processing_settings = {}
            user_id = None
            user_email = None
            filename = None
            audio_file_path = str(file_path)  # Full path to audio file
            file_size = 0
            
            if self.queue_manager:
                queue_status = await self.queue_manager.get_queue_status(session_id)
                if queue_status:
                    user_id = queue_status.get("user_id")
                    user_email = queue_status.get("user_email")
                    filename = queue_status.get("filename")
                    
                    # Get the actual file path from queue
                    if queue_status.get("file_path"):
                        audio_file_path = queue_status.get("file_path")
                    
                    if queue_status.get("processing_settings"):
                        processing_settings = json.loads(queue_status["processing_settings"])
            
            # Get file size if file exists
            if file_path.exists():
                file_size = file_path.stat().st_size
            
            # Initialize session in old system for progress tracking
            processing_sessions[session_id] = {
                "id": session_id,
                "filename": filename or file_path.name,
                "status": "processing",
                "progress": 10,
                "message": "Loading audio file...",
                "created_at": datetime.now(),
                "file_path": audio_file_path,
                "settings": processing_settings
            }
            
            session = processing_sessions[session_id]
            settings = session["settings"]
            
            print(f"Starting audio processing for session {session_id}")
            print(f"   File: {file_path}")
            print(f"   Audio file path: {audio_file_path}")
            print(f"   User ID: {user_id}")
            print(f"   Settings: {settings}")
            
            session["progress"] = 20
            session["message"] = "Processing with GDPR pipeline..."

            # Run CPU-intensive processing in thread pool (NON-BLOCKING)
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self.thread_pool,
                partial(
                    self.pipeline.process_audio,
                    audio_path=file_path,
                    language=settings.get("language"),
                    num_speakers=settings.get("num_speakers"),
                    min_speakers=1,
                    max_speakers=10,
                    apply_preprocessing=settings.get("preprocessing", True)
                )
            )
            
            # ✅ CRITICAL FIX: Normalize speaker IDs to be consecutive (0, 1, 2, ...)
            # This fixes the issue where diarization creates SPEAKER_00, SPEAKER_01, SPEAKER_03
            # by renaming them to SPEAKER_00, SPEAKER_01, SPEAKER_02
            results = normalize_speaker_ids(results)

            output_dir = OUTPUT_DIR / session_id
            output_dir.mkdir(exist_ok=True)
            
            session["progress"] = 90
            session["message"] = "Saving results..."
            
            await self.save_results_to_files(results, output_dir, session_id)
            
            session["status"] = "completed"
            session["progress"] = 100
            session["message"] = "Processing completed successfully"
            session["results"] = results
            session["output_dir"] = str(output_dir)
            
            print(f"Audio processing completed for session {session_id}")
            
            # CRITICAL NEW FEATURE: Save transcript to database
            if user_id and user_email and audio_file_path:
                print(f"Saving transcript to database...")
                print(f"   Session ID: {session_id}")
                print(f"   User ID: {user_id}")
                print(f"   Filename: {filename}")
                print(f"   Audio file path: {audio_file_path}")
                print(f"   File size: {file_size}")
                
                await self.save_transcript_to_database(
                    session_id=session_id,
                    user_id=user_id,
                    user_email=user_email,
                    filename=filename or file_path.name,
                    file_path=audio_file_path,
                    file_size=file_size,
                    results=results,
                    settings=settings
                )
            else:
                print(f"⚠️  Skipping database save - missing required data:")
                print(f"   user_id: {user_id}")
                print(f"   user_email: {user_email}")
                print(f"   audio_file_path: {audio_file_path}")
            
            # Notify queue manager of completion
            if self.queue_manager:
                await self.queue_manager.complete_processing(session_id)
            
            # Send completion email notification
            try:
                from services.notification_service import send_completion_notification
                await send_completion_notification(session_id, session, results)
                print(f"Completion email sent for session {session_id}")
            except Exception as e:
                logger.error(f"Failed to send completion email for session {session_id}: {e}")
                print(f"Email notification failed for session {session_id}: {e}")
                # Don't fail the entire process if email fails
            
            # DON'T clean up uploaded file - we need it for permanent storage!
            # The file is now in audios/{user_id}/ and should stay there
            # if file_path.exists():
            #     file_path.unlink()
                
        except Exception as e:
            logger.error(f"Processing error for session {session_id}: {e}")
            print(f"Processing failed for session {session_id}: {e}")
            
            # Update session status
            if session_id in processing_sessions:
                processing_sessions[session_id].update({
                    "status": "failed",
                    "progress": 0,
                    "message": f"Processing failed: {str(e)}",
                    "error": str(e)
                })
            
            # Notify queue manager of failure
            if self.queue_manager:
                await self.queue_manager.fail_processing(session_id, str(e))
            
            # Clean up file on error
            try:
                if file_path.exists():
                    file_path.unlink()
            except:
                pass
    
    async def save_results_to_files(self, results: Dict, output_dir: Path, session_id: str):
        """Save processing results to files"""
        try:
            import json
            
            json_file = output_dir / f"{session_id}_results.json"
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False, default=str)
            
            if "segments" in results:
                txt_file = output_dir / f"{session_id}_transcript.txt"
                with open(txt_file, 'w', encoding='utf-8') as f:
                    for segment in results["segments"]:
                        start_time = segment.get("start", 0)
                        end_time = segment.get("end", 0)
                        speaker = segment.get("speaker", "Unknown")
                        text = segment.get("text", "")
                        
                        start_min, start_sec = divmod(start_time, 60)
                        end_min, end_sec = divmod(end_time, 60)
                        
                        f.write(f"[{int(start_min):02d}:{int(start_sec):02d} - {int(end_min):02d}:{int(end_sec):02d}] ")
                        f.write(f"{speaker}: {text}\n")
            
            logger.info(f"Results saved for session {session_id}")
            
        except Exception as e:
            logger.error(f"Error saving results for session {session_id}: {e}")
            raise
    
    async def save_transcript_to_database(
        self,
        session_id: str,
        user_id: int,
        user_email: str,
        filename: str,
        file_path: str,
        file_size: int,
        results: Dict,
        settings: Dict
    ):
        """
        Save completed transcript to database for permanent storage
        
        This is a critical new feature that enables transcript history
        """
        try:
            from services.transcript_service import TranscriptService
            from database.models import db_manager
            
            # Validate required fields
            if not file_path:
                logger.error(f"Cannot save transcript: file_path is None")
                print(f"❌ Cannot save transcript: file_path is required")
                return
            
            # Extract data from results
            segments = results.get("segments", [])
            metadata = results.get("metadata", {})
            speaker_stats = results.get("speaker_stats", {})
            
            # Calculate derived fields
            num_speakers = len(speaker_stats) if speaker_stats else None
            language = settings.get("language") or metadata.get("language")
            duration_seconds = metadata.get("duration") or metadata.get("total_duration")
            
            print(f"Preparing to save transcript:")
            print(f"   - Segments: {len(segments)}")
            print(f"   - Speakers: {num_speakers}")
            print(f"   - Language: {language}")
            print(f"   - Duration: {duration_seconds}s")
            
            # Create transcript service
            transcript_service = TranscriptService(db_manager)
            
            # Save to database
            # Note: 'metadata' parameter is renamed to 'processing_metadata' in database to avoid SQLAlchemy conflict
            transcript = transcript_service.create_transcript(
                session_id=session_id,
                user_id=user_id,
                user_email=user_email,
                filename=filename,
                audio_file_path=file_path,
                audio_file_size=file_size,
                segments=segments,
                metadata=metadata,  # Will be mapped to 'processing_metadata' in service
                speaker_stats=speaker_stats,
                processing_settings=settings,
                num_speakers=num_speakers,
                language=language,
                duration_seconds=duration_seconds
            )
            
            if transcript:
                logger.info(f"✅ Transcript saved to database: {session_id}")
                print(f"✅ Transcript saved to database: {session_id} (ID: {transcript.id})")
            else:
                logger.error(f"❌ Failed to save transcript to database: {session_id}")
                print(f"❌ Failed to save transcript to database: {session_id}")
            
        except Exception as e:
            # Don't fail the entire processing if database save fails
            # The transcript is still in the filesystem
            logger.error(f"Error saving transcript to database for {session_id}: {e}")
            print(f"⚠️  Database save failed for {session_id}: {e}")
            print(f"   Transcript is still available in filesystem")
            import traceback
            traceback.print_exc()
    
    def get_processing_status(self, session_id: str) -> Optional[Dict]:
        """Get processing status from sessions dict"""
        return processing_sessions.get(session_id)
    
    def get_results(self, session_id: str) -> Optional[Dict]:
        """Get results from sessions dict"""
        return processing_sessions.get(session_id)