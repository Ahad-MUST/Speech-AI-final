# api/prompt_routes.py - Complete API routes for prompt management (FIXED)

from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from pydantic import BaseModel, validator
from datetime import datetime
import logging

from database.models import UserFavoritePrompt
from auth.middleware import get_current_user, require_auth
from auth.models import User

# Import database components
try:
    from database.models import AnalysisPrompt, AnalysisResult, db_manager
    DATABASE_AVAILABLE = True
    print("Database models imported successfully")
except ImportError as e:
    print(f"Database not available: {e}")
    DATABASE_AVAILABLE = False
    db_manager = None

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/prompts", tags=["prompts"])

# Default prompts for fallback
DEFAULT_PROMPTS = [
    {
        "id": 1,
        "key": "summary",
        "title": "Conversation Summary",
        "description": "Generate a comprehensive summary of the entire conversation",
        "prompt_template": "Analyze this transcript and provide a comprehensive summary: {transcript}",
        "icon": "FileText",
        "emoji": "📋",
        "category": "general",
        "gradient_from": "cyan-500",
        "gradient_to": "cyan-600",
        "is_active": True,
        "is_system": True,
        "max_tokens": 2000,
        "estimated_time": 30.0,
        "usage_count": 0,
        "created_at": datetime.now().isoformat(),
        "created_by": "system"
    },
    {
        "id": 2,
        "key": "action_items",
        "title": "Action Items & Tasks",
        "description": "Extract actionable tasks and commitments from the conversation",
        "prompt_template": "Extract all action items and tasks from this transcript: {transcript}",
        "icon": "CheckSquare",
        "emoji": "✅",
        "category": "productivity",
        "gradient_from": "green-500",
        "gradient_to": "green-600",
        "is_active": True,
        "is_system": True,
        "max_tokens": 1500,
        "estimated_time": 25.0,
        "usage_count": 0,
        "created_at": datetime.now().isoformat(),
        "created_by": "system"
    },
    {
        "id": 3,
        "key": "sentiment_analysis",
        "title": "Sentiment Analysis",
        "description": "Analyze the emotional tone and sentiment of the conversation",
        "prompt_template": "Analyze the sentiment and emotional tone of this transcript: {transcript}",
        "icon": "Heart",
        "emoji": "💭",
        "category": "analysis",
        "gradient_from": "purple-500",
        "gradient_to": "purple-600",
        "is_active": True,
        "is_system": True,
        "max_tokens": 1800,
        "estimated_time": 35.0,
        "usage_count": 0,
        "created_at": datetime.now().isoformat(),
        "created_by": "system"
    },
    {
        "id": 4,
        "key": "meeting_notes",
        "title": "Meeting Notes",
        "description": "Convert conversation into structured meeting notes",
        "prompt_template": "Convert this transcript into professional meeting notes: {transcript}",
        "icon": "Calendar",
        "emoji": "📝",
        "category": "meeting",
        "gradient_from": "blue-500",
        "gradient_to": "blue-600",
        "is_active": True,
        "is_system": True,
        "max_tokens": 2500,
        "estimated_time": 40.0,
        "usage_count": 0,
        "created_at": datetime.now().isoformat(),
        "created_by": "system"
    }
]

# Pydantic models for request/response
class PromptCreate(BaseModel):
    key: str
    title: str
    description: str = ""
    prompt_template: str
    icon: str = "Brain"
    emoji: str = "🤖"
    category: str = "general"
    gradient_from: str = "cyan-500"
    gradient_to: str = "cyan-600"
    max_tokens: int = 2000
    estimated_time: float = 30.0

    @validator('key')
    def validate_key(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Key cannot be empty')
        return v.strip().lower().replace(' ', '_').replace('-', '_')
    
    @validator('prompt_template')
    def validate_prompt_template(cls, v):
        if '{transcript}' not in v:
            raise ValueError('Prompt template must contain {transcript} placeholder')
        return v

    @validator('max_tokens')
    def validate_max_tokens(cls, v):
        if v < 100 or v > 8000:
            raise ValueError('Max tokens must be between 100 and 8000')
        return v

class PromptUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    prompt_template: Optional[str] = None
    icon: Optional[str] = None
    emoji: Optional[str] = None
    category: Optional[str] = None
    gradient_from: Optional[str] = None
    gradient_to: Optional[str] = None
    max_tokens: Optional[int] = None
    estimated_time: Optional[float] = None
    is_active: Optional[bool] = None

    @validator('prompt_template')
    def validate_prompt_template(cls, v):
        if v is not None and '{transcript}' not in v:
            raise ValueError('Prompt template must contain {transcript} placeholder')
        return v

# Dependency to get database session
def get_db():
    if not DATABASE_AVAILABLE or not db_manager:
        raise HTTPException(
            status_code=503, 
            detail="Database not available. Please check database connection."
        )
    
    db = db_manager.get_session()
    try:
        yield db
    finally:
        db.close()

# Optional auth dependency
async def get_current_user_optional(request: Request):
    """Try to get current user but don't fail if not authenticated"""
    try:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer",
                credentials=auth_header.replace('Bearer ', '')
            )
            return await get_current_user(credentials)
    except:
        pass
    return None

# PUBLIC endpoint for Analysis Page
@router.get("/public")
async def get_public_prompts():
    """Get only active prompts for analysis page (public access)"""
    try:
        if not DATABASE_AVAILABLE or not db_manager:
            logger.info("Database not available, returning filtered default prompts")
            public_prompts = [
                {
                    "key": p["key"],
                    "title": p["title"], 
                    "description": p["description"],
                    "category": p["category"],
                    "icon": p["icon"],
                    "emoji": p["emoji"],
                    "estimated_time": p["estimated_time"],
                    "gradient_from": p["gradient_from"],
                    "gradient_to": p["gradient_to"],
                    "max_tokens": p["max_tokens"]
                }
                for p in DEFAULT_PROMPTS if p.get("is_active", True)
            ]
            return public_prompts
            
        db = db_manager.get_session()
        try:
            prompts = db.query(AnalysisPrompt).filter(
                AnalysisPrompt.is_active == True
            ).order_by(AnalysisPrompt.created_at.desc()).all()
            
            if not prompts:
                logger.info("No active prompts found in database, returning default prompts")
                return [
                    {
                        "key": p["key"],
                        "title": p["title"], 
                        "description": p["description"],
                        "category": p["category"],
                        "icon": p["icon"],
                        "emoji": p["emoji"],
                        "estimated_time": p["estimated_time"],
                        "gradient_from": p["gradient_from"],
                        "gradient_to": p["gradient_to"],
                        "max_tokens": p["max_tokens"]
                    }
                    for p in DEFAULT_PROMPTS if p.get("is_active", True)
                ]
            
            result = [
                {
                    "id": p.id, 
                    "key": p.key,
                    "title": p.title,
                    "description": p.description,
                    "category": p.category,
                    "icon": p.icon,
                    "emoji": p.emoji,
                    "estimated_time": p.estimated_time,
                    "gradient_from": p.gradient_from,
                    "gradient_to": p.gradient_to,
                    "max_tokens": p.max_tokens
                }
                for p in prompts
            ]
            
            logger.info(f"Returning {len(result)} active prompts for public access")
            return result
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Failed to get public prompts: {e}")
        return [
            {
                "key": p["key"],
                "title": p["title"], 
                "description": p["description"],
                "category": p["category"],
                "icon": p["icon"],
                "emoji": p["emoji"],
                "estimated_time": p["estimated_time"],
                "gradient_from": p["gradient_from"],
                "gradient_to": p["gradient_to"],
                "max_tokens": p["max_tokens"]
            }
            for p in DEFAULT_PROMPTS if p.get("is_active", True)
        ]

# MAIN endpoint - handles both admin and favorites
@router.get("/")
async def get_all_prompts(
    active_only: bool = Query(False, description="Return only active prompts"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: int = Query(0, description="Offset for pagination"),
    favorites_only: bool = Query(False, description="Return only favorite prompts"),
    db: Session = Depends(get_db),
    request: Request = None
):
    """Get all analysis prompts with optional favorite status"""
    try:
        # Try to get current user if authenticated
        current_user = await get_current_user_optional(request) if request else None
        
        query = db.query(AnalysisPrompt)
        
        # If favorites_only and user is authenticated, filter by favorites
        if favorites_only and current_user:
            favorite_prompt_ids = db.query(UserFavoritePrompt.prompt_id).filter(
                UserFavoritePrompt.user_id == current_user.id
            ).subquery()
            query = query.filter(AnalysisPrompt.id.in_(favorite_prompt_ids))
        
        # Apply existing filters
        if active_only:
            query = query.filter(AnalysisPrompt.is_active == True)
        if category and category != 'all':
            query = query.filter(AnalysisPrompt.category == category)
        
        # Apply pagination
        if limit:
            query = query.limit(limit)
        query = query.offset(offset)
        
        # Execute query
        prompts = query.all()
        
        # Convert to dict with favorite status if user is authenticated
        if current_user:
            prompts_data = [
                prompt.to_dict(user_id=current_user.id, db_session=db)
                for prompt in prompts
            ]
        else:
            prompts_data = [prompt.to_dict() for prompt in prompts]
        
        return {
            "prompts": prompts_data,
            "count": len(prompts_data),
            "total": db.query(AnalysisPrompt).count() if not favorites_only else None
        }
        
    except Exception as e:
        logger.error(f"Failed to get prompts: {e}")
        # Fallback to basic response without favorites
        try:
            query = db.query(AnalysisPrompt)
            if active_only:
                query = query.filter(AnalysisPrompt.is_active == True)
            if category and category != 'all':
                query = query.filter(AnalysisPrompt.category == category)
            if limit:
                query = query.limit(limit)
            query = query.offset(offset)
            
            prompts = query.all()
            prompts_data = [prompt.to_dict() for prompt in prompts]
            
            return {
                "prompts": prompts_data,
                "count": len(prompts_data),
                "total": db.query(AnalysisPrompt).count()
            }
        except:
            raise HTTPException(status_code=500, detail=f"Failed to get prompts: {str(e)}")

# Get categories
@router.get("/categories")
async def get_categories():
    """Get available prompt categories"""
    categories = [
        {"value": "all", "label": "All Categories", "color": "gray"},
        {"value": "general", "label": "General", "color": "blue"},
        {"value": "meeting", "label": "Meeting", "color": "green"},
        {"value": "content", "label": "Content", "color": "purple"},
        {"value": "analysis", "label": "Analysis", "color": "yellow"},
        {"value": "productivity", "label": "Productivity", "color": "orange"}
    ]
    return {"categories": categories}

# Get analytics
@router.get("/analytics/usage")
async def get_usage_analytics(db: Session = Depends(get_db)):
    """Get usage analytics for prompts"""
    try:
        prompts = db.query(AnalysisPrompt).all()
        
        total_prompts = len(prompts)
        active_prompts = sum(1 for p in prompts if p.is_active)
        total_usage = sum(p.usage_count for p in prompts)
        average_usage = total_usage / total_prompts if total_prompts > 0 else 0
        
        categories = {}
        for prompt in prompts:
            if prompt.category not in categories:
                categories[prompt.category] = {"count": 0, "usage": 0}
            categories[prompt.category]["count"] += 1
            categories[prompt.category]["usage"] += prompt.usage_count
        
        top_prompts = sorted(prompts, key=lambda p: p.usage_count, reverse=True)[:10]
        
        return {
            "overview": {
                "total_prompts": total_prompts,
                "active_prompts": active_prompts,
                "total_usage": total_usage,
                "average_usage": round(average_usage, 2)
            },
            "categories": categories,
            "top_prompts": [{"key": p.key, "title": p.title, "usage": p.usage_count} for p in top_prompts]
        }
    except Exception as e:
        logger.error(f"Failed to get analytics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")

# Get user favorites
@router.get("/favorites")
async def get_user_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all favorite prompts for the current user"""
    try:
        favorites = db.query(UserFavoritePrompt).filter(
            UserFavoritePrompt.user_id == current_user.id
        ).all()
        
        favorite_prompt_ids = [f.prompt_id for f in favorites]
        
        prompts = db.query(AnalysisPrompt).filter(
            AnalysisPrompt.id.in_(favorite_prompt_ids),
            AnalysisPrompt.is_active == True
        ).all()
        
        prompts_data = [
            {
                **prompt.to_dict(user_id=current_user.id, db_session=db),
                "is_favorited": True
            }
            for prompt in prompts
        ]
        
        return {
            "prompts": prompts_data,
            "count": len(prompts_data)
        }
        
    except Exception as e:
        logger.error(f"Failed to get favorites: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get favorites: {str(e)}")

# Get specific prompt
@router.get("/{key}")
async def get_prompt_by_key(
    key: str,
    db: Session = Depends(get_db),
    request: Request = None
):
    """Get a specific prompt by key with optional favorite status"""
    try:
        prompt = db.query(AnalysisPrompt).filter(AnalysisPrompt.key == key).first()
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        current_user = await get_current_user_optional(request) if request else None
        
        if current_user:
            prompt_data = prompt.to_dict(user_id=current_user.id, db_session=db)
        else:
            prompt_data = prompt.to_dict()
            
        return prompt_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get prompt: {str(e)}")

# Create prompt
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_prompt(prompt: PromptCreate, db: Session = Depends(get_db)):
    """Create a new analysis prompt"""
    try:
        existing = db.query(AnalysisPrompt).filter(AnalysisPrompt.key == prompt.key).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Prompt with key '{prompt.key}' already exists")
        
        db_prompt = AnalysisPrompt(
            key=prompt.key,
            title=prompt.title,
            description=prompt.description,
            prompt_template=prompt.prompt_template,
            icon=prompt.icon,
            emoji=prompt.emoji,
            category=prompt.category,
            gradient_from=prompt.gradient_from,
            gradient_to=prompt.gradient_to,
            max_tokens=prompt.max_tokens,
            estimated_time=prompt.estimated_time,
            is_active=True,
            is_system=False,
            usage_count=0,
            created_by="admin"
        )
        
        db.add(db_prompt)
        db.commit()
        db.refresh(db_prompt)
        
        logger.info(f"Created new prompt: {prompt.key}")
        return db_prompt.to_dict()
        
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Prompt with key '{prompt.key}' already exists")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create prompt: {str(e)}")

# Update prompt
@router.put("/{prompt_id}")
async def update_prompt(prompt_id: int, prompt_update: PromptUpdate, db: Session = Depends(get_db)):
    """Update an existing prompt"""
    try:
        prompt = db.query(AnalysisPrompt).filter(AnalysisPrompt.id == prompt_id).first()
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        if prompt.is_system:
            raise HTTPException(status_code=403, detail="Cannot modify system prompts")
        
        update_data = prompt_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(prompt, field, value)
        
        prompt.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(prompt)
        
        logger.info(f"Updated prompt: {prompt.key}")
        return prompt.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update prompt {prompt_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update prompt: {str(e)}")

# Delete prompt
@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: int, db: Session = Depends(get_db)):
    """Delete a prompt"""
    try:
        prompt = db.query(AnalysisPrompt).filter(AnalysisPrompt.id == prompt_id).first()
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        if prompt.is_system:
            raise HTTPException(status_code=403, detail="Cannot delete system prompts")
        
        db.delete(prompt)
        db.commit()
        
        logger.info(f"Deleted prompt: {prompt.key}")
        return {"message": "Prompt deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete prompt {prompt_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete prompt: {str(e)}")

# Toggle prompt status
@router.post("/{prompt_key}/toggle")
async def toggle_prompt_status(prompt_key: str, db: Session = Depends(get_db)):
    """Toggle a prompt's active status"""
    try:
        prompt = db.query(AnalysisPrompt).filter(AnalysisPrompt.key == prompt_key).first()
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        prompt.is_active = not prompt.is_active
        prompt.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(prompt)
        
        status = "activated" if prompt.is_active else "deactivated"
        logger.info(f"Prompt {prompt_key} {status}")
        return {"message": f"Prompt {status} successfully", "is_active": prompt.is_active}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to toggle prompt {prompt_key}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle prompt: {str(e)}")

# Increment usage
@router.post("/{prompt_key}/increment-usage")
async def increment_usage_count(prompt_key: str, db: Session = Depends(get_db)):
    """Increment the usage count for analytics"""
    try:
        prompt = db.query(AnalysisPrompt).filter(AnalysisPrompt.key == prompt_key).first()
        if prompt:
            prompt.usage_count += 1
            prompt.updated_at = datetime.utcnow()
            db.commit()
            
        return {"message": "Usage count updated"}
        
    except Exception as e:
        logger.error(f"Failed to increment usage for {prompt_key}: {e}")
        return {"message": "Usage count update failed", "error": str(e)}

# Add favorite
@router.post("/{prompt_id}/favorite")
async def add_favorite(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Add a prompt to user's favorites"""
    try:
        prompt = db.query(AnalysisPrompt).filter(AnalysisPrompt.id == prompt_id).first()
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        existing = db.query(UserFavoritePrompt).filter(
            UserFavoritePrompt.user_id == current_user.id,
            UserFavoritePrompt.prompt_id == prompt_id
        ).first()
        
        if existing:
            return {"message": "Prompt already in favorites", "status": "exists"}
        
        favorite = UserFavoritePrompt(
            user_id=current_user.id,
            prompt_id=prompt_id
        )
        db.add(favorite)
        db.commit()
        
        logger.info(f"User {current_user.id} added prompt {prompt_id} to favorites")
        
        return {
            "message": "Prompt added to favorites",
            "status": "added",
            "favorite": favorite.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add favorite: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add favorite: {str(e)}")

# Remove favorite
@router.delete("/{prompt_id}/favorite")
async def remove_favorite(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Remove a prompt from user's favorites"""
    try:
        favorite = db.query(UserFavoritePrompt).filter(
            UserFavoritePrompt.user_id == current_user.id,
            UserFavoritePrompt.prompt_id == prompt_id
        ).first()
        
        if not favorite:
            raise HTTPException(status_code=404, detail="Favorite not found")
        
        db.delete(favorite)
        db.commit()
        
        logger.info(f"User {current_user.id} removed prompt {prompt_id} from favorites")
        
        return {
            "message": "Prompt removed from favorites",
            "status": "removed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to remove favorite: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to remove favorite: {str(e)}")