# auth/models.py - User Authentication and Authorization Models

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime, timedelta
from typing import Optional, List
import uuid

from database.models import Base

class User(Base):
    """User model for authentication and authorization"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Authentik user information
    authentik_user_id = Column(String(100), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    
    # User profile information
    full_name = Column(String(255))
    first_name = Column(String(100))
    last_name = Column(String(100))
    avatar_url = Column(String(500))
    
    # Authorization and status
    role = Column(String(50), default="user")  # user, admin, superadmin
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Session and security
    last_login = Column(DateTime)
    last_activity = Column(DateTime)
    login_count = Column(Integer, default=0)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(username='{self.username}', email='{self.email}', role='{self.role}')>"
    
    def to_dict(self, include_sensitive: bool = False):
        """Convert user to dictionary for API responses"""
        user_dict = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "avatar_url": self.avatar_url,
            "role": self.role,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "login_count": self.login_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        
        if include_sensitive:
            user_dict.update({
                "authentik_user_id": self.authentik_user_id,
                "last_activity": self.last_activity.isoformat() if self.last_activity else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            })
        
        return user_dict
    
    def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission"""
        role_permissions = {
            "superadmin": ["admin:*", "user:*", "system:*"],
            "admin": ["admin:read", "admin:write", "admin:prompts", "user:*"],
            "user": ["user:read", "user:write", "user:upload", "user:analyze"]
        }
        
        user_perms = role_permissions.get(self.role, [])
        
        # Check for wildcard permissions
        for perm in user_perms:
            if perm.endswith("*"):
                if permission.startswith(perm[:-1]):
                    return True
            elif perm == permission:
                return True
        
        return False
    
    def is_admin(self) -> bool:
        """Check if user has admin privileges"""
        return self.role in ["admin", "superadmin"]
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = datetime.utcnow()


class UserSession(Base):
    """User session tracking for security and analytics"""
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Session information
    access_token_jti = Column(String(100), index=True)  # JWT ID for token tracking
    refresh_token_jti = Column(String(100), index=True)
    
    # Client information
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(Text)
    device_type = Column(String(50))  # desktop, mobile, tablet
    browser = Column(String(100))
    os = Column(String(100))
    
    # Session lifecycle
    created_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    revoked_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    
    def __repr__(self):
        return f"<UserSession(session_id='{self.session_id}', user_id={self.user_id})>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "device_type": self.device_type,
            "browser": self.browser,
            "os": self.os,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active,
        }
    
    def is_expired(self) -> bool:
        """Check if session is expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at
    
    def revoke(self):
        """Revoke the session"""
        self.is_active = False
        self.revoked_at = datetime.utcnow()


class AuditLog(Base):
    """Audit logging for security and compliance"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Action information
    action = Column(String(100), nullable=False)  # login, logout, upload, analyze, admin_action
    resource = Column(String(100))  # what was accessed/modified
    resource_id = Column(String(100))  # ID of the resource
    
    # Request information
    ip_address = Column(String(45))
    user_agent = Column(Text)
    method = Column(String(10))  # HTTP method
    endpoint = Column(String(200))
    
    # Result and details
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    details = Column(Text)  # JSON serialized additional details
    
    # Timing
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    processing_time = Column(Integer)  # milliseconds
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    
    def __repr__(self):
        return f"<AuditLog(action='{self.action}', user_id={self.user_id}, timestamp='{self.timestamp}')>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action": self.action,
            "resource": self.resource,
            "resource_id": self.resource_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "method": self.method,
            "endpoint": self.endpoint,
            "success": self.success,
            "error_message": self.error_message,
            "details": self.details,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "processing_time": self.processing_time,
        }


class RevokedToken(Base):
    """Store revoked JWT tokens for security"""
    __tablename__ = "revoked_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(100), unique=True, index=True, nullable=False)  # JWT ID
    token_type = Column(String(20), nullable=False)  # access, refresh
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    revoked_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)  # Original expiration time
    reason = Column(String(100))  # logout, security_breach, admin_revoke
    
    def __repr__(self):
        return f"<RevokedToken(jti='{self.jti}', user_id={self.user_id})>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "jti": self.jti,
            "token_type": self.token_type,
            "user_id": self.user_id,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "reason": self.reason,
        }