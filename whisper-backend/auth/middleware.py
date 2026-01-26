# auth/middleware.py - Authentication and Authorization Middleware

from fastapi import Request, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any
import time
import re
from sqlalchemy.orm import Session

from .service import (
    TokenService, PermissionService, AuthenticationError, 
    AuthorizationError, get_auth_services
)
from .models import User
from .config import auth_settings, SECURITY_HEADERS
from database.models import DatabaseManager



# Security scheme
security = HTTPBearer(auto_error=False)


class AuthMiddleware:
    """Authentication and authorization middleware"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.services = get_auth_services(db_manager)
    
    async def __call__(self, request: Request, call_next):
        """Process request through authentication middleware"""
        start_time = time.time()
        
        try:
            # Add security headers
            response = await call_next(request)
            self._add_security_headers(response)
            
            # Log successful requests
            processing_time = int((time.time() - start_time) * 1000)
            if hasattr(request.state, "user"):
                self.services["audit_service"].log_action(
                    user_id=request.state.user.id,
                    action=f"{request.method}_{request.url.path}",
                    success=True,
                    client_info=self._get_client_info(request),
                    details=f"Processing time: {processing_time}ms"
                )
            
            return response
            
        except Exception as e:
            # Log failed requests
            processing_time = int((time.time() - start_time) * 1000)
            user_id = getattr(request.state, "user", None)
            user_id = user_id.id if user_id else None
            
            self.services["audit_service"].log_action(
                user_id=user_id,
                action=f"{request.method}_{request.url.path}",
                success=False,
                error_message=str(e),
                client_info=self._get_client_info(request),
                details=f"Processing time: {processing_time}ms"
            )
            
            # Return error response
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"}
            )
    
    def _add_security_headers(self, response):
        """Add security headers to response"""
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value
    
    def _get_client_info(self, request: Request) -> Dict[str, Any]:
        """Extract client information from request"""
        return {
            "ip_address": self._get_client_ip(request),
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "endpoint": str(request.url.path),
        }
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address considering proxies"""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    """Dependency to get current authenticated user"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Import db_manager directly (fixes the dependency issue)
        from database.models import db_manager
        
        # Import TokenService
        from .service import TokenService, AuthenticationError, get_auth_services
        
        # Verify JWT token
        payload = TokenService.verify_token(credentials.credentials, "access")
        user_id = int(payload["sub"])
        jti = payload["jti"]
        
        # Check if token is revoked
        db = db_manager.get_session()
        try:
            if TokenService.is_token_revoked(db, jti):
                raise AuthenticationError("Token has been revoked")
        finally:
            db.close()
        
        # Get user from database
        services = get_auth_services(db_manager)
        user = services["user_service"].get_user_by_id(user_id)
        
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")
        
        return user
        
    except Exception as e:
        print(f"🔍 Authentication error: {e}")  # Debug logging
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )
def require_auth(
    user: User = Depends(get_current_user)
) -> User:
    """Dependency to require authentication"""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(
    user: User = Depends(require_auth)
) -> User:
    """Dependency to require admin privileges"""
    if not user.is_admin():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return user


def require_permission(required_permission: str):
    """Dependency factory to require specific permission"""
    def permission_dependency(user: User = Depends(require_auth)) -> User:
        if not user.has_permission(required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{required_permission}' required"
            )
        return user
    
    return permission_dependency


class RateLimitMiddleware:
    """Rate limiting middleware"""
    
    def __init__(self):
        self.requests = {}  # In production, use Redis or similar
    
    async def __call__(self, request: Request, call_next):
        """Apply rate limiting"""
        client_ip = self._get_client_ip(request)
        current_time = time.time()
        
        # Clean old entries
        self._cleanup_old_requests(current_time)
        
        # Check rate limit
        if client_ip not in self.requests:
            self.requests[client_ip] = []
        
        client_requests = self.requests[client_ip]
        recent_requests = [
            req_time for req_time in client_requests 
            if current_time - req_time < auth_settings.RATE_LIMIT_WINDOW
        ]
        
        if len(recent_requests) >= auth_settings.RATE_LIMIT_REQUESTS:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded",
                    "retry_after": auth_settings.RATE_LIMIT_WINDOW
                },
                headers={
                    "Retry-After": str(auth_settings.RATE_LIMIT_WINDOW),
                    "X-RateLimit-Limit": str(auth_settings.RATE_LIMIT_REQUESTS),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(current_time + auth_settings.RATE_LIMIT_WINDOW))
                }
            )
        
        # Add current request
        recent_requests.append(current_time)
        self.requests[client_ip] = recent_requests
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        remaining = auth_settings.RATE_LIMIT_REQUESTS - len(recent_requests)
        response.headers["X-RateLimit-Limit"] = str(auth_settings.RATE_LIMIT_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(current_time + auth_settings.RATE_LIMIT_WINDOW))
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address"""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _cleanup_old_requests(self, current_time: float):
        """Clean up old request records"""
        cutoff_time = current_time - auth_settings.RATE_LIMIT_WINDOW
        
        for client_ip in list(self.requests.keys()):
            self.requests[client_ip] = [
                req_time for req_time in self.requests[client_ip]
                if req_time > cutoff_time
            ]
            
            # Remove empty entries
            if not self.requests[client_ip]:
                del self.requests[client_ip]


def create_auth_middleware(db_manager: DatabaseManager):
    """Factory function to create auth middleware with database manager"""
    return AuthMiddleware(db_manager)


def is_public_endpoint(path: str) -> bool:
    """Check if endpoint is public (doesn't require authentication)"""
    from .config import PROTECTED_ENDPOINTS
    
    # Normalize path
    path = path.rstrip("/")
    
    # Check public endpoints
    for pattern in PROTECTED_ENDPOINTS["public"]:
        pattern = pattern.rstrip("/").replace("*", ".*")
        if re.match(f"^{pattern}$", path):
            return True
    
    return False


def is_admin_endpoint(path: str) -> bool:
    """Check if endpoint requires admin privileges"""
    from .config import PROTECTED_ENDPOINTS
    
    # Normalize path
    path = path.rstrip("/")
    
    # Check admin endpoints
    for pattern in PROTECTED_ENDPOINTS["admin"]:
        pattern = pattern.rstrip("/").replace("*", ".*")
        if re.match(f"^{pattern}$", path):
            return True
    
    return False


# Session management utilities
def create_session_info(user: User, access_token: str, refresh_token: str) -> Dict[str, Any]:
    """Create session information for response"""
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": auth_settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user.to_dict(),
        "permissions": user.role,
        "session_expires_at": (
            user.last_activity + auth_settings.session_expire_timedelta
        ).isoformat() if user.last_activity else None
    }


def parse_user_agent(user_agent: str) -> Dict[str, str]:
    """Parse user agent string to extract device info"""
    # Simple user agent parsing - in production, use a proper library
    device_type = "desktop"
    browser = "unknown"
    os = "unknown"
    
    if user_agent:
        user_agent_lower = user_agent.lower()
        
        # Device type detection
        if any(mobile in user_agent_lower for mobile in ["mobile", "android", "iphone", "ipad"]):
            device_type = "mobile"
        elif "tablet" in user_agent_lower:
            device_type = "tablet"
        
        # Browser detection
        if "chrome" in user_agent_lower:
            browser = "Chrome"
        elif "firefox" in user_agent_lower:
            browser = "Firefox"
        elif "safari" in user_agent_lower:
            browser = "Safari"
        elif "edge" in user_agent_lower:
            browser = "Edge"
        
        # OS detection
        if "windows" in user_agent_lower:
            os = "Windows"
        elif "mac" in user_agent_lower:
            os = "macOS"
        elif "linux" in user_agent_lower:
            os = "Linux"
        elif "android" in user_agent_lower:
            os = "Android"
        elif "ios" in user_agent_lower:
            os = "iOS"
    
    return {
        "device_type": device_type,
        "browser": browser,
        "os": os
    }