# utils/helpers.py - Utility Helper Functions

import asyncio
from pathlib import Path
import core.dependencies as deps

async def start_queued_processing(session_id: str, file_path: str):
    """Start processing for a queued item"""
    from services.audio_processing_service import AudioProcessingService
    
    audio_service = AudioProcessingService(
        pipeline=deps.pipeline,
        thread_pool=deps.thread_pool,
        queue_manager=deps.queue_manager
    )
    
    # Start the background processing task
    asyncio.create_task(audio_service.process_audio_background(session_id, Path(file_path)))