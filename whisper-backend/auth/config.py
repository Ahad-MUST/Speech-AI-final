# auth/config.py - Final Fixed Authentication Configuration

import os
from typing import List, Optional
from datetime import timedelta

class AuthSettings:
    """Authentication and authorization configuration - simplified without Pydantic"""
    
    def __init__(self):
        # Authentik OIDC Configuration
        self.AUTHENTIK_ISSUER_URL = os.getenv("AUTHENTIK_ISSUER_URL", "")
        self.AUTHENTIK_CLIENT_ID = os.getenv("AUTHENTIK_CLIENT_ID", "")
        self.AUTHENTIK_CLIENT_SECRET = os.getenv("AUTHENTIK_CLIENT_SECRET", "")
        self.AUTHENTIK_REDIRECT_URI = os.getenv("AUTHENTIK_REDIRECT_URI", "http://localhost:3000/auth/callback")
        self.AUTHENTIK_SCOPE = os.getenv("AUTHENTIK_SCOPE", "openid profile email groups")    
    
        self.JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-super-secret-jwt-key-change-in-production")
     
        self.JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
        self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
        self.JWT_REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))
        
        # Security Settings - Fixed CORS parsing
        cors_env = os.getenv("CORS_ORIGINS", "")
        if cors_env:
            self.CORS_ORIGINS = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
        else:
            self.CORS_ORIGINS = [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]
        
        # Session Management
        self.SESSION_EXPIRE_MINUTES = int(os.getenv("SESSION_EXPIRE_MINUTES", "480"))
        self.MAX_SESSIONS_PER_USER = int(os.getenv("MAX_SESSIONS_PER_USER", "5"))
        
        # Rate Limiting
        self.RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
        self.RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
        
        # Admin Configuration
        self.DEFAULT_ADMIN_EMAIL = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com")
        self.REQUIRE_EMAIL_VERIFICATION = os.getenv("REQUIRE_EMAIL_VERIFICATION", "false").lower() == "true"
        
        # Audit and Logging
        self.ENABLE_AUDIT_LOGGING = os.getenv("ENABLE_AUDIT_LOGGING", "true").lower() == "true"
        self.AUDIT_LOG_RETENTION_DAYS = int(os.getenv("AUDIT_LOG_RETENTION_DAYS", "90"))
        
        # Token Cleanup
        self.TOKEN_CLEANUP_INTERVAL_HOURS = int(os.getenv("TOKEN_CLEANUP_INTERVAL_HOURS", "24"))
        
        # Validation warnings
        self._validate_settings()
    
    def _validate_settings(self):
        """Validate configuration and show warnings"""
        if not self.AUTHENTIK_ISSUER_URL:
            print("⚠️ Warning: AUTHENTIK_ISSUER_URL is not set")
        elif not self.AUTHENTIK_ISSUER_URL.startswith(('http://', 'https://')):
            print("⚠️ Warning: AUTHENTIK_ISSUER_URL should start with http:// or https://")
        else:
            self.AUTHENTIK_ISSUER_URL = self.AUTHENTIK_ISSUER_URL.rstrip('/')
        
        if not self.AUTHENTIK_CLIENT_ID:
            print("⚠️ Warning: AUTHENTIK_CLIENT_ID is not set")
        
        if not self.AUTHENTIK_CLIENT_SECRET:
            print("⚠️ Warning: AUTHENTIK_CLIENT_SECRET is not set")
        
        if len(self.JWT_SECRET_KEY) < 32:
            print("⚠️ Warning: JWT_SECRET_KEY should be at least 32 characters long")
    
    @property
    def access_token_expire_timedelta(self) -> timedelta:
        return timedelta(minutes=self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    @property
    def refresh_token_expire_timedelta(self) -> timedelta:
        return timedelta(days=self.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    
    @property
    def session_expire_timedelta(self) -> timedelta:
        return timedelta(minutes=self.SESSION_EXPIRE_MINUTES)
    
    @property
    def authentik_discovery_url(self) -> str:
        return f"{self.AUTHENTIK_ISSUER_URL}/.well-known/openid_configuration"
    
    @property
    def authentik_userinfo_url(self) -> str:
        # ✅ FIXED: Use full base URL with port
        return "http://localhost:9000/application/o/userinfo/"

    @property
    def authentik_token_url(self) -> str:
        # ✅ FIXED: Use full base URL with port
        return "http://localhost:9000/application/o/token/"

    @property
    def authentik_authorize_url(self) -> str:
        # ✅ FIXED: Use full base URL with port
        return "http://localhost:9000/application/o/authorize/"

# Global configuration instance
auth_settings = AuthSettings()

# OIDC Configuration for frontend
OIDC_CONFIG = {
    "authority": auth_settings.AUTHENTIK_ISSUER_URL,
    "client_id": auth_settings.AUTHENTIK_CLIENT_ID,
    "redirect_uri": auth_settings.AUTHENTIK_REDIRECT_URI,
    "response_type": "code",
    "scope": auth_settings.AUTHENTIK_SCOPE,
    "post_logout_redirect_uri": auth_settings.AUTHENTIK_REDIRECT_URI.replace("/auth/callback", "/"),
    "automaticSilentRenew": True,
    "silent_redirect_uri": auth_settings.AUTHENTIK_REDIRECT_URI.replace("/auth/callback", "/auth/silent-callback"),
    "accessTokenExpiringNotificationTime": 300,  # 5 minutes before expiry
    "filterProtocolClaims": True,
    "loadUserInfo": True,
}

# Role-based permissions mapping
ROLE_PERMISSIONS = {
    "superadmin": [
        "admin:*",
        "user:*", 
        "system:*",
        "audit:read",
        "users:manage",
        "sessions:manage"
    ],
    "admin": [
        "admin:read",
        "admin:write", 
        "admin:prompts",
        "admin:analytics",
        "user:*",
        "prompts:create",
        "prompts:update",
        "prompts:delete"
    ],
    "user": [
        "user:read",
        "user:write", 
        "user:upload",
        "user:analyze",
        "user:export",
        "prompts:read",
        "sessions:own"
    ]
}

# Protected endpoints configuration
PROTECTED_ENDPOINTS = {
    # Admin-only endpoints
    "admin": [
        "/api/admin/*",
        "/api/prompts/create",
        "/api/prompts/update/*",
        "/api/prompts/delete/*",
        "/api/users/*",
        "/api/audit/*"
    ],
    
    # User endpoints (require authentication)
    "user": [
        "/api/upload-audio",
        "/api/process-llm",
        "/api/download/*",
        "/api/sessions/*",
        "/api/prompts/*"
    ],
    
    # Public endpoints (no authentication required)
    "public": [
        "/",
        "/health",
        "/docs",
        "/openapi.json",
        "/static/*",
        "/auth/*"
    ]
}

# Security headers configuration
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' ws: wss:; "
        "frame-ancestors 'none';"
    )
}