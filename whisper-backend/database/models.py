# database/models.py - Database Models for Analysis Prompts (FIXED - metadata renamed to processing_metadata)

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, create_engine, ForeignKey, UniqueConstraint, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

Base = declarative_base()


class UserFavoritePrompt(Base):
    """Model for tracking user favorite analysis prompts"""
    __tablename__ = "user_favorite_prompts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt_id = Column(Integer, ForeignKey("analysis_prompts.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="favorite_prompts")
    prompt = relationship("AnalysisPrompt", backref="favorited_by")
    
    # Ensure a user can only favorite a prompt once
    __table_args__ = (
        UniqueConstraint('user_id', 'prompt_id', name='unique_user_prompt_favorite'),
    )
    
    def __repr__(self):
        return f"<UserFavoritePrompt(user_id={self.user_id}, prompt_id={self.prompt_id})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "prompt_id": self.prompt_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class AnalysisPrompt(Base):
    """Model for storing analysis prompts"""
    __tablename__ = "analysis_prompts"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, index=True)  # unique identifier (e.g., 'summary', 'sentiment')
    title = Column(String(200), nullable=False)  # Display title
    description = Column(Text)  # Brief description
    prompt_template = Column(Text, nullable=False)  # The actual prompt with {transcript} placeholder
    icon = Column(String(50), default="Brain")  # Lucide icon name
    emoji = Column(String(10), default="🤖")  # Emoji for UI
    category = Column(String(50), default="general")  # Category (general, meeting, content, etc.)
    gradient_from = Column(String(50), default="blue-500")  # Tailwind gradient start
    gradient_to = Column(String(50), default="blue-600")  # Tailwind gradient end
    
    # Metadata
    is_active = Column(Boolean, default=True)  # Can be toggled on/off
    is_system = Column(Boolean, default=False)  # System prompts can't be deleted
    max_tokens = Column(Integer, default=2000)  # Max response tokens
    estimated_time = Column(Float, default=30.0)  # Estimated processing time in seconds
    usage_count = Column(Integer, default=0)  # Track how often it's used
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100), default="system")  # username or 'system'
    
    def __repr__(self):
        return f"<AnalysisPrompt(key='{self.key}', title='{self.title}')>"
    
    def get_favorite_count(self, db_session):
        """Get count of users who favorited this prompt"""
        return db_session.query(UserFavoritePrompt).filter(
            UserFavoritePrompt.prompt_id == self.id
        ).count()
    
    def to_dict(self, include_favorite_count=False, user_id=None, db_session=None):
        """Convert to dictionary for API responses"""
        result = {
            "id": self.id,
            "key": self.key,
            "title": self.title,
            "description": self.description,
            "prompt_template": self.prompt_template,
            "icon": self.icon,
            "emoji": self.emoji,
            "category": self.category,
            "gradient_from": self.gradient_from,
            "gradient_to": self.gradient_to,
            "is_active": self.is_active,
            "is_system": self.is_system,
            "max_tokens": self.max_tokens,
            "estimated_time": self.estimated_time,
            "usage_count": self.usage_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by
        }
        
        # Add favorite count if requested
        if include_favorite_count and db_session:
            result["favorite_count"] = self.get_favorite_count(db_session)
        
        # Add user-specific favorite status if user_id provided
        if user_id and db_session:
            is_favorited = db_session.query(UserFavoritePrompt).filter(
                UserFavoritePrompt.user_id == user_id,
                UserFavoritePrompt.prompt_id == self.id
            ).first() is not None
            result["is_favorited"] = is_favorited
            
        return result


class AnalysisResult(Base):
    """Model for storing analysis results (UPDATED WITH FOREIGN KEY)"""
    __tablename__ = "analysis_results"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), ForeignKey("transcript_history.session_id", ondelete="CASCADE"), index=True)
    prompt_key = Column(String(50), index=True)
    prompt_title = Column(String(200))
    response_text = Column(Text)
    model_used = Column(String(50))
    processing_time = Column(Float)
    transcript_length = Column(Integer)
    tokens_used = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to transcript
    transcript = relationship("TranscriptHistory", back_populates="analysis_results")
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "prompt_key": self.prompt_key,
            "prompt_title": self.prompt_title,
            "response_text": self.response_text,
            "model_used": self.model_used,
            "processing_time": self.processing_time,
            "transcript_length": self.transcript_length,
            "tokens_used": self.tokens_used,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class TranscriptHistory(Base):
    """Model for permanently storing completed transcriptions (NEW)"""
    __tablename__ = "transcript_history"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Session identification
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    
    # User information
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_email = Column(String(255), nullable=False)
    
    # File information
    filename = Column(String(500), nullable=False)
    audio_file_path = Column(String(1000), nullable=False)
    audio_file_size = Column(Integer, nullable=False)
    
    # Transcript content (JSON stored as Text)
    segments = Column(Text, nullable=False)  # JSON array of transcript segments
    processing_metadata = Column(Text, nullable=True)  # RENAMED from 'metadata' to avoid SQLAlchemy conflict
    speaker_stats = Column(Text, nullable=True)  # JSON speaker statistics
    processing_settings = Column(Text, nullable=True)  # JSON processing settings used
    
    # Quick access fields (denormalized for fast queries)
    num_speakers = Column(Integer, nullable=True)
    language = Column(String(50), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Soft delete
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    
    # Relationships
    user = relationship("User", backref="transcriptions")
    analysis_results = relationship("AnalysisResult", back_populates="transcript", cascade="all, delete-orphan")
    
    # Composite index for optimal query performance
    __table_args__ = (
        Index('idx_user_created_deleted', 'user_id', 'created_at', 'is_deleted'),
    )
    
    def __repr__(self):
        return f"<TranscriptHistory(session_id='{self.session_id}', filename='{self.filename}', user_id={self.user_id})>"
    
    def to_dict(self, include_segments=True, include_metadata=True):
        """Convert to dictionary for API responses"""
        import json
        
        result = {
            "id": self.id,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "user_email": self.user_email,
            "filename": self.filename,
            "audio_file_path": self.audio_file_path,
            "audio_file_size": self.audio_file_size,
            "num_speakers": self.num_speakers,
            "language": self.language,
            "duration_seconds": self.duration_seconds,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "is_deleted": self.is_deleted
        }
        
        # Optionally include large JSON fields
        if include_segments and self.segments:
            try:
                result["segments"] = json.loads(self.segments)
            except:
                result["segments"] = []
        
        if include_metadata:
            if self.processing_metadata:  # RENAMED field
                try:
                    result["metadata"] = json.loads(self.processing_metadata)
                except:
                    result["metadata"] = {}
            
            if self.speaker_stats:
                try:
                    result["speaker_stats"] = json.loads(self.speaker_stats)
                except:
                    result["speaker_stats"] = {}
            
            if self.processing_settings:
                try:
                    result["processing_settings"] = json.loads(self.processing_settings)
                except:
                    result["processing_settings"] = {}
        
        return result


class AudioQueue(Base):
    """Model for managing audio processing queue"""
    __tablename__ = "audio_queue"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, nullable=False)
    user_email = Column(String(255), nullable=False)
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer, default=0)
    status = Column(String(20), default="QUEUED", index=True)  # QUEUED, PROCESSING, COMPLETED, FAILED
    queue_position = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_processing_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    processing_settings = Column(Text, nullable=True)  # JSON string
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "user_email": self.user_email,
            "filename": self.filename,
            "status": self.status,
            "queue_position": self.queue_position,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_processing_at": self.started_processing_at.isoformat() if self.started_processing_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message
        }
    

    
# Database setup
class DatabaseManager:
    def __init__(self, database_url: str = None):
        if database_url is None:
            # Default to SQLite in the project directory
            database_url = f"sqlite:///{os.path.join(os.getcwd(), 'speech_analysis.db')}"
        
        self.database_url = database_url
        self.engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False} if "sqlite" in database_url else {}
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
    def create_tables(self):
        """Create all tables"""
        try:
            # Import all models to ensure they're registered with Base
            # UserFavoritePrompt is already imported above
            # This ensures the favorites table is created along with others
            
            Base.metadata.create_all(bind=self.engine)
            print("Database tables created successfully")
        except Exception as e:
            print(f"Error creating database tables: {e}")
            raise
        
    def get_session(self):
        """Get database session"""
        return self.SessionLocal()
        
    def init_default_prompts(self):
        """Initialize database with default system prompts"""
        session = self.get_session()
        try:
            # Check if prompts already exist
            existing_count = session.query(AnalysisPrompt).count()
            if existing_count > 0:
                print(f"Database already has {existing_count} prompts")
                return
                
            default_prompts = [
                {
                    "key": "summary",
                    "title": "Conversation Summary",
                    "description": "Generate a comprehensive summary of the entire conversation, highlighting key points and main topics discussed.",
                    "prompt_template": """Analyze this transcript and provide a comprehensive summary:

{transcript}

Please provide:
1. **Main Topics Discussed**: Key themes and subjects
2. **Key Points**: Important information shared
3. **Action Items**: Any tasks, decisions, or next steps mentioned
4. **Participants' Contributions**: Brief overview of what each speaker contributed

Format your response clearly with headers and bullet points.""",
                    "icon": "FileText",
                    "emoji": "📋",
                    "category": "general",
                    "gradient_from": "cyan-500",
                    "gradient_to": "cyan-600",
                    "is_system": True,
                    "estimated_time": 25.0
                },
                {
                    "key": "action_items",
                    "title": "Action Items & Tasks",
                    "description": "Extract action items, tasks, decisions, and follow-up items mentioned in the conversation.",
                    "prompt_template": """Extract all action items and tasks from this transcript:

{transcript}

For each action item, identify:
- **Task Description**: What needs to be done
- **Owner/Responsible Party**: Who should do it (if mentioned)
- **Deadline**: When it should be completed (if mentioned)
- **Priority**: Urgency level (if indicated)
- **Dependencies**: What needs to happen first (if mentioned)

Format clearly with bullet points and be specific.""",
                    "icon": "CheckSquare",
                    "emoji": "✅",
                    "category": "meeting",
                    "gradient_from": "green-500",
                    "gradient_to": "green-600",
                    "is_system": True,
                    "estimated_time": 20.0
                },
                {
                    "key": "sentiment",
                    "title": "Sentiment Analysis",
                    "description": "Analyze the emotional tone and sentiment throughout the conversation.",
                    "prompt_template": """Analyze the sentiment and emotional tone of this transcript:

{transcript}

Provide:
1. **Overall Sentiment**: Positive, negative, neutral, or mixed
2. **Emotional Progression**: How sentiment changed throughout
3. **Key Emotional Moments**: Significant shifts in tone
4. **Speaker Attitudes**: Individual sentiment for each speaker
5. **Underlying Concerns**: Any implicit worries or issues

Be nuanced and specific in your analysis.""",
                    "icon": "Heart",
                    "emoji": "💝",
                    "category": "analysis",
                    "gradient_from": "pink-500",
                    "gradient_to": "pink-600",
                    "is_system": True,
                    "estimated_time": 30.0
                },
                {
                    "key": "questions",
                    "title": "Questions & Answers",
                    "description": "Extract all questions asked and their corresponding answers from the conversation.",
                    "prompt_template": """Extract all questions and answers from this transcript:

{transcript}

Format as:
**Q: [Question asked]**
A: [Answer provided]

Include:
- All direct questions asked by any speaker
- The corresponding answers or responses
- Note if questions were left unanswered
- Identify who asked what (if clear from context)

Focus on substantive questions and answers, not small talk.""",
                    "icon": "HelpCircle",
                    "emoji": "❓",
                    "category": "content",
                    "gradient_from": "purple-500",
                    "gradient_to": "purple-600",
                    "is_system": True,
                    "estimated_time": 25.0
                }
            ]
            
            for prompt_data in default_prompts:
                prompt = AnalysisPrompt(**prompt_data)
                session.add(prompt)
                
            session.commit()
            print(f"Initialized {len(default_prompts)} default prompts")
            
        except Exception as e:
            session.rollback()
            print(f"Error initializing prompts: {e}")
            raise
        finally:
            session.close()

# Initialize database manager (will be imported by main.py)
db_manager = DatabaseManager()