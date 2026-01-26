# services/notification_service.py - Email Notification Service

import logging
from pathlib import Path
from typing import Dict
from services.email_service import email_service
from services.pdf_service import PDFGenerator

logger = logging.getLogger(__name__)

async def send_completion_notification(session_id: str, session: Dict, results: Dict):
    """Send email notification with PDF attachment"""
    try:
        # Get user email from session or queue
        user_email = None
        
        # Try to get email from queue manager first
        from services.queue_service import AudioQueueManager
        from database.models import db_manager
        
        if db_manager:
            try:
                queue_manager = AudioQueueManager(db_manager, max_concurrent=1)
                queue_status = await queue_manager.get_queue_status(session_id)
                if queue_status:
                    user_email = queue_status.get("user_email")
            except Exception as e:
                logger.error(f"Error getting email from queue: {e}")
        
        if not user_email:
            logger.warning(f"No email found for session {session_id}, skipping notification")
            return
        
        filename = session.get("filename", "audio_file")
        
        # Generate PDF
        pdf_gen = PDFGenerator()
        output_dir = Path(session.get("output_dir", f"outputs/{session_id}"))
        pdf_path = output_dir / f"{session_id}_transcript.pdf"
        
        # Create PDF from results
        segments = results.get("segments", [])
        metadata = results.get("metadata", {})
        
        pdf_success = pdf_gen.generate_transcript_pdf(
            segments=segments,
            metadata=metadata,
            output_path=pdf_path,
            filename=filename
        )
        
        # Send email with or without PDF
        if pdf_success and pdf_path.exists():
            email_success = await email_service.send_completion_email(
                to_email=user_email,
                session_id=session_id,
                filename=filename,
                pdf_path=pdf_path
            )
        else:
            logger.warning(f"PDF generation failed for {session_id}, sending text-only email")
            email_success = await email_service.send_text_only_email(
                to_email=user_email,
                session_id=session_id,
                filename=filename
            )
        
        if email_success:
            logger.info(f"Completion notification sent for session {session_id}")
        else:
            logger.error(f"Failed to send notification for session {session_id}")
            
    except Exception as e:
        logger.error(f"Error in send_completion_notification: {e}")