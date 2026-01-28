# services/llm_service.py - LLM Processing Service

import logging
import httpx
from typing import Dict, Any, List, Optional
from collections import Counter
from config.settings import OLLAMA_BASE_URL, DEFAULT_MODEL

logger = logging.getLogger(__name__)

class LLMService:
    """Service for handling LLM operations"""
    
    @staticmethod
    async def check_ollama_status():
        """Check if Ollama is running and available"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
                if response.status_code == 200:
                    models_data = response.json()
                    models = [model['name'] for model in models_data.get('models', [])]
                    return {
                        "available": True,
                        "models": models,
                        "default": DEFAULT_MODEL,
                        "url": OLLAMA_BASE_URL,
                        "status": "connected",
                        "current_model": DEFAULT_MODEL,
                        "available_models": models,
                        "model_available": DEFAULT_MODEL in models
                    }
        except Exception as e:
            logger.error(f"Ollama connection error: {e}")
        
        return {
            "available": False,
            "models": [],
            "default": DEFAULT_MODEL,
            "url": OLLAMA_BASE_URL,
            "error": "Ollama service not running",
            "status": "disconnected",
            "current_model": None,
            "available_models": [],
            "model_available": False
        }
    
    @staticmethod
    async def process_with_ollama(prompt: str, model: str = DEFAULT_MODEL) -> Dict[str, Any]:
        """Process text with Ollama LLM"""
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                payload = {
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "top_k": 40
                    }
                }
                
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json=payload,
                    timeout=300.0
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    from fastapi import HTTPException
                    raise HTTPException(status_code=response.status_code, detail="LLM processing failed")
                    
        except ImportError:
            try:
                import requests
                payload = {
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "top_k": 40
                    }
                }
                
                response = requests.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json=payload,
                    timeout=300.0
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    from fastapi import HTTPException
                    raise HTTPException(status_code=response.status_code, detail="LLM processing failed")
            except Exception as e:
                from fastapi import HTTPException
                raise HTTPException(status_code=503, detail=f"LLM service unavailable: {str(e)}")
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=503, detail=f"LLM service unavailable: {str(e)}")
    
    @staticmethod
    async def _process_single_chunk(prompt: str, model: str) -> str:
        """Process a single chunk with Ollama"""
        async with httpx.AsyncClient() as client:
            ollama_payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_predict": 4000
                }
            }
            
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=ollama_payload,
                timeout=300.0
            )
            
            if response.status_code != 200:
                logger.error(f"Ollama error: {response.status_code} - {response.text}")
                from fastapi import HTTPException
                raise HTTPException(status_code=503, detail="LLM processing failed")
            
            result = response.json()
            
            if "response" not in result:
                logger.error(f"Invalid Ollama response: {result}")
                from fastapi import HTTPException
                raise HTTPException(status_code=503, detail="Invalid LLM response")
            
            llm_response = result["response"].strip()
            
            if not llm_response:
                from fastapi import HTTPException
                raise HTTPException(status_code=503, detail="LLM returned empty response")
            
            return llm_response
    
    @staticmethod
    def _split_transcript_into_chunks(transcript: str, max_size: int = 12000) -> list:
        """
        Split transcript into chunks with sentence boundaries.
        
        - Default chunk size: 12,000 chars (~3,000 tokens)
        - Increased from 4,000 chars for better context understanding
        - Still only uses ~9% of token capacity
        """
        
        if len(transcript) <= max_size:
            return [transcript]
        
        chunks = []
        current_chunk = ""
        
        # Split by sentences to maintain context
        sentences = transcript.split('. ')
        
        for sentence in sentences:
            # Check if adding this sentence would exceed max_size
            if len(current_chunk) + len(sentence) + 2 > max_size and current_chunk:
                # Save current chunk and start new one
                chunks.append(current_chunk.strip())
                current_chunk = sentence + '. '
            else:
                current_chunk += sentence + '. '
        
        # Add final chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
    @staticmethod
    def _build_enhanced_chunk_prompt(chunk: str, prompt_template: str, previous_context: str, chunk_num: int, total_chunks: int, language: Optional[str] = None) -> str:
        """Build enhanced prompt for a chunk with clear chunking instructions"""
        
        # Build language instruction if language is provided
        language_instruction = ""
        if language:
            language_instruction = f"LANGUAGE: Provide your entire analysis in {language}.\n\n"
            logger.info(f"🌍 Chunk {chunk_num}/{total_chunks}: Adding language instruction for '{language}'")
        else:
            logger.info(f"⚠️  Chunk {chunk_num}/{total_chunks}: NO language parameter - LLM will decide language")
        
        # Start with chunking context instruction
        chunking_instruction = f"""
IMPORTANT: You are analyzing CHUNK {chunk_num} of {total_chunks} from a larger transcript. This is part of a sequential analysis.

{language_instruction}INSTRUCTIONS:
- This is NOT the complete transcript, only part {chunk_num} of {total_chunks}
- Focus on analyzing this specific chunk while being aware it's part of a larger document
- Build upon insights from previous chunks when relevant
- Keep your analysis focused and avoid premature conclusions about the overall document
- Note patterns or themes that may connect to other parts

"""
        
        # Add previous context if available
        if previous_context and chunk_num > 1:
            context_section = f"""
PREVIOUS ANALYSIS CONTEXT (from chunk {chunk_num-1}):
{previous_context}

"""
            chunking_instruction += context_section
        
        # Handle different template formats
        if "{transcript}" in prompt_template:
            base_prompt = prompt_template.replace("{transcript}", chunk)
        else:
            base_prompt = f"{prompt_template}\n\nTranscript:\n{chunk}"
        
        # Remove former_chunk placeholder if present
        base_prompt = base_prompt.replace("{former_chunk}", "")
        
        # Combine instruction with prompt
        final_prompt = chunking_instruction + "\nANALYSIS REQUEST:\n" + base_prompt
        
        return final_prompt
    
    @staticmethod
    async def _process_with_enhanced_chunking(transcript: str, prompt_template: str, model: str, prompt_title: str, language: Optional[str] = None) -> str:
        """Process large transcript with enhanced chunking and final synthesis"""
        
        # Split transcript into chunks
        chunks = LLMService._split_transcript_into_chunks(transcript)
        logger.info(f"Split transcript into {len(chunks)} chunks (Language: {language or 'not specified'})")
        
        chunk_responses = []
        previous_context = ""
        
        # Process each chunk with enhanced context awareness
        for i, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {i+1}/{len(chunks)}")
            
            # Build chunk-aware prompt
            chunk_prompt = LLMService._build_enhanced_chunk_prompt(
                chunk, prompt_template, previous_context, i+1, len(chunks), language
            )
            
            # Process chunk
            chunk_response = await LLMService._process_single_chunk(chunk_prompt, model)
            chunk_responses.append(chunk_response)
            
            # Update context for next chunk (keep last 2000 chars)
            previous_context = chunk_response[-2000:] if len(chunk_response) > 2000 else chunk_response
        
        # NEW: Final synthesis step - combine all chunk responses
        logger.info(f"Synthesizing final response from {len(chunk_responses)} chunks")
        final_response = await LLMService._synthesize_final_response(chunk_responses, prompt_template, prompt_title, model, language)
        
        return final_response
    
    @staticmethod
    async def _synthesize_final_response(chunk_responses: list, prompt_template: str, prompt_title: str, model: str, language: Optional[str] = None) -> str:
        """Synthesize all chunk responses into a single enhanced final output"""
        
        if len(chunk_responses) == 1:
            return chunk_responses[0]
        
        # Build language instruction if language is provided
        language_instruction = ""
        if language:
            language_instruction = f"LANGUAGE: Provide your entire synthesis in {language}.\n\n"
            logger.info(f"🌍 Synthesis: Adding language instruction for '{language}'")
        else:
            logger.info(f"⚠️  Synthesis: NO language parameter - LLM will decide language")
        
        # Create synthesis prompt
        synthesis_prompt = f"""
SYNTHESIS TASK: Create a comprehensive, unified analysis from the following chunk analyses.

{language_instruction}ORIGINAL ANALYSIS TYPE: {prompt_title}

You have {len(chunk_responses)} chunk analyses from a large transcript. Your task is to:
1. Synthesize these into ONE cohesive, comprehensive analysis
2. Remove redundancy and contradictions
3. Create a unified narrative that flows logically
4. Ensure all important insights are preserved
5. Organize the content in a clear, structured way

CHUNK ANALYSES TO SYNTHESIZE:

"""
        
        # Add all chunk responses
        for i, response in enumerate(chunk_responses, 1):
            synthesis_prompt += f"\n--- CHUNK {i} ANALYSIS ---\n{response}\n"
        
        synthesis_prompt += f"""

--- END OF CHUNK ANALYSES ---

Now create a single, unified, comprehensive analysis that synthesizes all the above insights into one cohesive response. Focus on creating a flowing narrative rather than listing separate parts.
"""
        
        # Process synthesis
        logger.info("Generating synthesized final response")
        final_response = await LLMService._process_single_chunk(synthesis_prompt, model)
        
        return final_response