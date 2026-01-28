# api/llm_routes.py - LLM Processing Routes (UPDATED WITH AUTO TRANSCRIPT REFERENCE)

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import logging
from services.llm_service import LLMService
from config.settings import DEFAULT_MODEL, MAX_CHUNK_SIZE, LLM_PROMPTS
from auth.middleware import get_current_user
from auth.models import User
import core.dependencies as deps

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["llm"])

class LLMProcessRequest(BaseModel):
    transcript: Optional[str] = None  # Optional now - can use session_id instead
    session_id: Optional[str] = None  # NEW: Load transcript from database by session_id
    prompt_key: str
    custom_prompt: Optional[str] = None

def get_prompts_from_database():
    """Get prompts from database or fallback to hardcoded ones"""
    if not deps.db_manager:
        return LLM_PROMPTS
    
    try:
        from database.models import AnalysisPrompt
        session = deps.db_manager.get_session()
        try:
            prompts = session.query(AnalysisPrompt).filter(AnalysisPrompt.is_active == True).all()
            
            db_prompts = {}
            for prompt in prompts:
                db_prompts[prompt.key] = {
                    "name": prompt.title,
                    "description": prompt.description,
                    "prompt": prompt.prompt_template,
                    "max_tokens": prompt.max_tokens,
                    "usage_count": prompt.usage_count
                }
            
            return db_prompts if db_prompts else LLM_PROMPTS
            
        finally:
            session.close()
    except Exception as e:
        logger.error(f"Database error when fetching prompts: {e}")
        return LLM_PROMPTS

@router.get("/llm-prompts")
async def get_llm_prompts():
    """Get available LLM prompts (from database or fallback)"""
    prompts = get_prompts_from_database()
    
    return {
        "predefined_prompts": prompts,
        "model_info": {
            "current_model": DEFAULT_MODEL,
            "max_chunk_size": MAX_CHUNK_SIZE
        },
        "source": "database" if deps.db_manager and prompts != LLM_PROMPTS else "fallback"
    }

@router.post("/llm-process")
async def process_with_llm(
    request: LLMProcessRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Process transcript with LLM using specified prompt
    
    NEW: Can now accept either:
    - transcript: Direct transcript text (original behavior)
    - session_id: Load transcript from database by session_id
    """
    try:
        transcript = request.transcript
        session_id = request.session_id
        prompt_key = request.prompt_key
        custom_prompt = request.custom_prompt
        
        # Variable to store detected language
        transcript_language = None
        
        # NEW: Load transcript from database if session_id provided
        if session_id and not transcript:
            try:
                from services.transcript_service import TranscriptService
                
                transcript_service = TranscriptService(deps.db_manager)
                transcript_record = transcript_service.get_transcript_by_session(
                    session_id=session_id,
                    user_id=current_user.id
                )
                
                if not transcript_record:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Transcript with session ID '{session_id}' not found or access denied"
                    )
                
                # Extract language from transcript record
                transcript_language = transcript_record.language
                logger.info(f"🌍 Language detected from transcript record: {transcript_language if transcript_language else 'NONE - No language stored in database'}")
                
                # Extract transcript text from segments
                transcript_dict = transcript_record.to_dict(include_segments=True, include_metadata=False)
                segments = transcript_dict.get("segments", [])
                
                # Build transcript text from segments
                transcript_lines = []
                for segment in segments:
                    speaker = segment.get("speaker", "Unknown")
                    text = segment.get("text", "")
                    transcript_lines.append(f"{speaker}: {text}")
                
                transcript = "\n".join(transcript_lines)
                
                logger.info(f"Loaded transcript from database: {session_id} (Language: {transcript_language or 'not detected'})")
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error loading transcript from database: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to load transcript: {str(e)}"
                )
        
        # Validate we have a transcript now
        if not transcript or not transcript.strip():
            raise HTTPException(
                status_code=400,
                detail="Either transcript text or session_id is required"
            )
        
        if not prompt_key or not prompt_key.strip():
            raise HTTPException(status_code=400, detail="Prompt key is required")
        
        # Get the prompt template first
        prompt_template = ""
        prompt_title = ""
        
        # âœ… FIXED: Auto-append transcript reference for custom prompts
        if prompt_key == "custom_analysis":
            if not custom_prompt or not custom_prompt.strip():
                raise HTTPException(status_code=400, detail="Custom prompt is required for custom analysis")
            
            # Check if user already included {transcript} placeholder
            if "{transcript}" not in custom_prompt:
                # User didn't include it, so we auto-append it
                logger.info("Auto-appending transcript reference to custom prompt")
                prompt_template = f"{custom_prompt.strip()}\n\nPerform this analysis on the following transcript:\n{{transcript}}"
            else:
                # User already included {transcript}, use as-is
                logger.info("Using custom prompt as-is (contains {transcript} placeholder)")
                prompt_template = custom_prompt
            
            prompt_title = "Custom Analysis"
            
        else:
            # Get predefined prompt from database or fallback
            if deps.db_manager:
                try:
                    from database.models import AnalysisPrompt
                    db = deps.db_manager.get_session()
                    try:
                        prompt = db.query(AnalysisPrompt).filter(
                            AnalysisPrompt.key == prompt_key,
                            AnalysisPrompt.is_active == True
                        ).first()
                        
                        if not prompt:
                            raise HTTPException(status_code=404, detail=f"Prompt '{prompt_key}' not found or inactive")
                        
                        prompt_template = prompt.prompt_template
                        prompt_title = prompt.title
                        
                    finally:
                        db.close()
                        
                except Exception as e:
                    logger.error(f"Database error: {e}")
                    # Fallback to hardcoded prompts
                    prompts = get_prompts_from_database()
                    if prompt_key not in prompts:
                        raise HTTPException(status_code=404, detail=f"Prompt '{prompt_key}' not found")
                    
                    prompt_template = prompts[prompt_key]["prompt"]
                    prompt_title = prompts[prompt_key]["name"]
            else:
                # Use fallback prompts
                prompts = get_prompts_from_database()
                if prompt_key not in prompts:
                    raise HTTPException(status_code=404, detail=f"Prompt '{prompt_key}' not found")
                
                prompt_template = prompts[prompt_key]["prompt"]
                prompt_title = prompts[prompt_key]["name"]
        
        # Check Ollama status
        ollama_status = await LLMService.check_ollama_status()
        if not ollama_status["available"]:
            raise HTTPException(status_code=503, detail="LLM service not available")
        
        if not ollama_status["model_available"]:
            raise HTTPException(status_code=503, detail=f"Model {DEFAULT_MODEL} not available")
        
        # Log language status before processing
        logger.info(f"📝 Starting LLM processing - Language parameter: {transcript_language if transcript_language else 'NOT SET (will use LLM default)'}")
        
        # Check if transcript needs chunking
        # Optimized for Qwen2.5:7B (32K context window)
        MAX_TRANSCRIPT_SIZE = 25000  # Increased from 6000 to utilize Qwen's capacity better
        
        if len(transcript) <= MAX_TRANSCRIPT_SIZE:
            # Process normally (existing logic)
            logger.info(f"Processing with LLM: {prompt_key} (length: {len(transcript)} chars)")
            logger.info(f"⚠️  Non-chunked processing - Language parameter NOT passed (transcript too small for chunking)")
            
            final_prompt = prompt_template.replace("{transcript}", transcript)
            if "{former_chunk}" in final_prompt:
                final_prompt = final_prompt.replace("{former_chunk}", "")
            
            llm_response = await LLMService._process_single_chunk(final_prompt, DEFAULT_MODEL)
            
        else:
            # Process with enhanced chunking and final synthesis
            logger.info(f"Processing with enhanced chunking: {prompt_key} (length: {len(transcript)} chars)")
            logger.info(f"✅ Chunked processing - Passing language parameter: '{transcript_language}' to LLM service")
            llm_response = await LLMService._process_with_enhanced_chunking(transcript, prompt_template, DEFAULT_MODEL, prompt_title, transcript_language)
        
        # Store result in database
        # NEW: Use session_id if provided, otherwise generate one
        result_session_id = session_id if session_id else f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        if deps.db_manager and prompt_key != "custom_analysis":
            try:
                from database.models import AnalysisResult
                db = deps.db_manager.get_session()
                try:
                    analysis_result = AnalysisResult(
                        session_id=result_session_id,
                        prompt_key=prompt_key,
                        prompt_title=prompt_title,
                        response_text=llm_response,
                        model_used=DEFAULT_MODEL,
                        processing_time=0,
                        transcript_length=len(transcript),
                        tokens_used=0
                    )
                    
                    db.add(analysis_result)
                    db.commit()
                    
                    logger.info(f"Stored analysis result for session {result_session_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to store analysis result: {e}")
                    db.rollback()
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Database error storing result: {e}")
        
        logger.info(f"LLM processing completed for {prompt_key}")
        
        return {
            "result": llm_response,
            "model": DEFAULT_MODEL,
            "prompt_key": prompt_key,
            "prompt_title": prompt_title,
            "session_id": result_session_id,
            "processing_time": 0,
            "tokens_used": 0,
            "success": True,
            "chunked": len(transcript) > MAX_TRANSCRIPT_SIZE,
            "loaded_from_database": bool(session_id and not request.transcript)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LLM processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@router.post("/chat")
async def chat_with_llm(data: dict):
    """Chat with LLM"""
    try:
        message = data.get("message", "")
        model = data.get("model", DEFAULT_MODEL)
        
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{LLMService.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model,
                    "prompt": message,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "top_k": 40
                    }
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "response": result.get("response", ""),
                    "model": model,
                    "success": True
                }
            else:
                raise HTTPException(status_code=500, detail="Chat failed")
    
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/llm/models")
async def get_llm_models():
    """Get available LLM models"""
    try:
        import httpx
        from config.settings import OLLAMA_BASE_URL
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
            if response.status_code == 200:
                models_data = response.json()
                models = []
                for model in models_data.get("models", []):
                    models.append({
                        "name": model.get("name"),
                        "size": model.get("size", 0),
                        "modified_at": model.get("modified_at"),
                        "details": model.get("details", {})
                    })
                
                return {
                    "models": models,
                    "default_model": DEFAULT_MODEL,
                    "ollama_url": OLLAMA_BASE_URL,
                    "status": "connected"
                }
            else:
                raise HTTPException(status_code=503, detail="Ollama service unavailable")
    
    except Exception as e:
        logger.error(f"Failed to get models: {e}")
        raise HTTPException(status_code=503, detail=f"LLM service unavailable: {str(e)}")

@router.get("/llm/status")
async def get_llm_status():
    """Get LLM service status"""
    status = await LLMService.check_ollama_status()
    return status