# auth/service.py - Authentication Service Layer

import jwt
import requests
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .models import User, UserSession, AuditLog, RevokedToken
from .config import auth_settings, ROLE_PERMISSIONS
from database.models import DatabaseManager


class AuthenticationError(Exception):
    """Custom authentication exception"""
    pass


class AuthorizationError(Exception):
    """Custom authorization exception"""
    pass


class TokenService:
    """JWT token management service"""
    
    @staticmethod
    def create_access_token(user_id: int, user_data: Dict[str, Any]) -> str:
        """Create JWT access token"""
        now = datetime.utcnow()
        payload = {
            "sub": str(user_id),
            "iat": now,
            "exp": now + auth_settings.access_token_expire_timedelta,
            "type": "access",
            "jti": str(uuid.uuid4()),
            "user": {
                "id": user_id,
                "username": user_data.get("username"),
                "email": user_data.get("email"),
                "role": user_data.get("role", "user"),
                "full_name": user_data.get("full_name"),
            }
        }
        
        return jwt.encode(
            payload, 
            auth_settings.JWT_SECRET_KEY, 
            algorithm=auth_settings.JWT_ALGORITHM
        )
    
    @staticmethod
    def create_refresh_token(user_id: int) -> str:
        """Create JWT refresh token"""
        now = datetime.utcnow()
        payload = {
            "sub": str(user_id),
            "iat": now,
            "exp": now + auth_settings.refresh_token_expire_timedelta,
            "type": "refresh",
            "jti": str(uuid.uuid4()),
        }
        
        return jwt.encode(
            payload, 
            auth_settings.JWT_SECRET_KEY, 
            algorithm=auth_settings.JWT_ALGORITHM
        )
    
    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Dict[str, Any]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(
                token, 
                auth_settings.JWT_SECRET_KEY, 
                algorithms=[auth_settings.JWT_ALGORITHM]
            )
            
            if payload.get("type") != token_type:
                raise AuthenticationError(f"Invalid token type. Expected {token_type}")
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired")
        except jwt.InvalidTokenError:
            raise AuthenticationError("Invalid token")
    
    @staticmethod
    def is_token_revoked(db: Session, jti: str) -> bool:
        """Check if token is revoked"""
        return db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None
    
    @staticmethod
    def revoke_token(db: Session, jti: str, user_id: int, token_type: str, reason: str = "logout"):
        """Revoke a token"""
        revoked_token = RevokedToken(
            jti=jti,
            token_type=token_type,
            user_id=user_id,
            expires_at=datetime.utcnow() + auth_settings.refresh_token_expire_timedelta,
            reason=reason
        )
        db.add(revoked_token)
        db.commit()


class AuthentikService:
    """Authentik OIDC integration service"""
    
    @staticmethod
    def exchange_code_for_token(code: str, redirect_uri: str) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        token_data = {
            "grant_type": "authorization_code",
            "client_id": auth_settings.AUTHENTIK_CLIENT_ID,
            "client_secret": auth_settings.AUTHENTIK_CLIENT_SECRET,
            "code": code,
            "redirect_uri": redirect_uri,
        }
        
        try:
            response = requests.post(
                auth_settings.authentik_token_url,
                data=token_data,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
            
        except requests.RequestException as e:
            raise AuthenticationError(f"Failed to exchange code for token: {str(e)}")
    
    @staticmethod
    def get_user_info(access_token: str) -> Dict[str, Any]:
        """Get user information from Authentik"""
        headers = {"Authorization": f"Bearer {access_token}"}
        
        try:
            response = requests.get(
                auth_settings.authentik_userinfo_url,
                headers=headers,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
            
        except requests.RequestException as e:
            raise AuthenticationError(f"Failed to get user info: {str(e)}")
    
    @staticmethod
    def verify_authentik_token(access_token: str) -> Dict[str, Any]:
        """Verify Authentik access token and get user info"""
        try:
            # Decode JWT token from Authentik (without verification for user info)
            # In production, you should verify the signature using Authentik's public key
            decoded = jwt.decode(access_token, options={"verify_signature": False})
            
            # Get additional user info from userinfo endpoint
            user_info = AuthentikService.get_user_info(access_token)
            
            return {
                "authentik_user_id": decoded.get("sub"),
                "username": user_info.get("preferred_username") or user_info.get("username"),
                "email": user_info.get("email"),
                "full_name": user_info.get("name"),
                "first_name": user_info.get("given_name"),
                "last_name": user_info.get("family_name"),
                "groups": user_info.get("groups", []),
                "avatar_url": user_info.get("picture"),
                "is_verified": user_info.get("email_verified", False)
            }
            
        except Exception as e:
            raise AuthenticationError(f"Failed to verify Authentik token: {str(e)}")


class UserService:
    """User management service"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def get_or_create_user(self, user_data: Dict[str, Any]) -> User:
        """Get existing user or create new one from Authentik data"""
        db = self.db_manager.get_session()
        try:
            # Try to find existing user by Authentik ID or email
            user = db.query(User).filter(
                or_(
                    User.authentik_user_id == user_data["authentik_user_id"],
                    User.email == user_data["email"]
                )
            ).first()
            
            if user:
                # Update existing user with latest info
                user.username = user_data["username"]
                user.email = user_data["email"]
                user.full_name = user_data.get("full_name")
                user.first_name = user_data.get("first_name")
                user.last_name = user_data.get("last_name")
                user.avatar_url = user_data.get("avatar_url")
                user.is_verified = user_data.get("is_verified", False)
                user.authentik_user_id = user_data["authentik_user_id"]
                user.updated_at = datetime.utcnow()
                
                # Update role based on Authentik groups
                user.role = self._determine_user_role(user_data.get("groups", []))
                
            else:
                # Create new user
                user = User(
                    authentik_user_id=user_data["authentik_user_id"],
                    username=user_data["username"],
                    email=user_data["email"],
                    full_name=user_data.get("full_name"),
                    first_name=user_data.get("first_name"),
                    last_name=user_data.get("last_name"),
                    avatar_url=user_data.get("avatar_url"),
                    role=self._determine_user_role(user_data.get("groups", [])),
                    is_verified=user_data.get("is_verified", False),
                    is_active=True
                )
                db.add(user)
            
            db.commit()
            db.refresh(user)
            return user
            
        except Exception as e:
            db.rollback()
            raise AuthenticationError(f"Failed to create/update user: {str(e)}")
        finally:
            db.close()
    
    def _determine_user_role(self, groups: List[str]) -> str:
        """Determine user role based on Authentik groups"""
        # Convert groups to lowercase for case-insensitive comparison
        groups_lower = [group.lower() for group in groups]
        
        # Check for admin roles first
        if any(group in groups_lower for group in ["superadmin", "super-admin", "superadmins"]):
            return "superadmin"
        elif any(group in groups_lower for group in ["admin", "admins", "administrators"]):
            return "admin"
        else:
            return "user"
    
    def update_login_info(self, user_id: int):
        """Update user login information"""
        db = self.db_manager.get_session()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.last_login = datetime.utcnow()
                user.login_count += 1
                user.update_activity()
                db.commit()
        finally:
            db.close()
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        db = self.db_manager.get_session()
        try:
            return db.query(User).filter(User.id == user_id).first()
        finally:
            db.close()
    
    def get_active_users(self, limit: int = 100) -> List[User]:
        """Get list of active users"""
        db = self.db_manager.get_session()
        try:
            return db.query(User).filter(User.is_active == True).limit(limit).all()
        finally:
            db.close()


class SessionService:
    """User session management service"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def create_session(self, user_id: int, client_info: Dict[str, Any], 
                      access_token_jti: str, refresh_token_jti: str) -> UserSession:
        """Create new user session"""
        db = self.db_manager.get_session()
        try:
            # Check if user has too many active sessions
            active_sessions = db.query(UserSession).filter(
                and_(
                    UserSession.user_id == user_id,
                    UserSession.is_active == True
                )
            ).count()
            
            if active_sessions >= auth_settings.MAX_SESSIONS_PER_USER:
                # Revoke oldest session
                oldest_session = db.query(UserSession).filter(
                    and_(
                        UserSession.user_id == user_id,
                        UserSession.is_active == True
                    )
                ).order_by(UserSession.last_activity.asc()).first()
                
                if oldest_session:
                    oldest_session.revoke()
            
            # Create new session
            session = UserSession(
                session_id=str(uuid.uuid4()),
                user_id=user_id,
                access_token_jti=access_token_jti,
                refresh_token_jti=refresh_token_jti,
                ip_address=client_info.get("ip_address"),
                user_agent=client_info.get("user_agent"),
                device_type=client_info.get("device_type"),
                browser=client_info.get("browser"),
                os=client_info.get("os"),
                expires_at=datetime.utcnow() + auth_settings.session_expire_timedelta
            )
            
            db.add(session)
            db.commit()
            db.refresh(session)
            return session
            
        except Exception as e:
            db.rollback()
            raise AuthenticationError(f"Failed to create session: {str(e)}")
        finally:
            db.close()
    
    def get_session_by_jti(self, jti: str) -> Optional[UserSession]:
        """Get session by JWT ID"""
        db = self.db_manager.get_session()
        try:
            return db.query(UserSession).filter(
                or_(
                    UserSession.access_token_jti == jti,
                    UserSession.refresh_token_jti == jti
                )
            ).first()
        finally:
            db.close()
    
    def update_session_activity(self, session_id: str):
        """Update session last activity"""
        db = self.db_manager.get_session()
        try:
            session = db.query(UserSession).filter(
                UserSession.session_id == session_id
            ).first()
            if session:
                session.last_activity = datetime.utcnow()
                db.commit()
        finally:
            db.close()
    
    def revoke_session(self, session_id: str):
        """Revoke user session"""
        db = self.db_manager.get_session()
        try:
            session = db.query(UserSession).filter(
                UserSession.session_id == session_id
            ).first()
            if session:
                session.revoke()
                db.commit()
        finally:
            db.close()
    
    def revoke_all_user_sessions(self, user_id: int):
        """Revoke all sessions for a user"""
        db = self.db_manager.get_session()
        try:
            sessions = db.query(UserSession).filter(
                and_(
                    UserSession.user_id == user_id,
                    UserSession.is_active == True
                )
            ).all()
            
            for session in sessions:
                session.revoke()
            
            db.commit()
        finally:
            db.close()


class AuditService:
    """Audit logging service"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def log_action(self, user_id: Optional[int], action: str, 
                   resource: Optional[str] = None, resource_id: Optional[str] = None,
                   success: bool = True, error_message: Optional[str] = None,
                   details: Optional[str] = None, client_info: Optional[Dict[str, Any]] = None):
        """Log user action for audit trail"""
        if not auth_settings.ENABLE_AUDIT_LOGGING:
            return
        
        db = self.db_manager.get_session()
        try:
            audit_log = AuditLog(
                user_id=user_id,
                action=action,
                resource=resource,
                resource_id=resource_id,
                success=success,
                error_message=error_message,
                details=details,
                ip_address=client_info.get("ip_address") if client_info else None,
                user_agent=client_info.get("user_agent") if client_info else None,
                method=client_info.get("method") if client_info else None,
                endpoint=client_info.get("endpoint") if client_info else None,
            )
            
            db.add(audit_log)
            db.commit()
            
        except Exception as e:
            # Audit logging should not break the application
            print(f"Failed to log audit action: {e}")
        finally:
            db.close()
    
    def get_user_audit_logs(self, user_id: int, limit: int = 100) -> List[AuditLog]:
        """Get audit logs for a specific user"""
        db = self.db_manager.get_session()
        try:
            return db.query(AuditLog).filter(
                AuditLog.user_id == user_id
            ).order_by(AuditLog.timestamp.desc()).limit(limit).all()
        finally:
            db.close()


class PermissionService:
    """Permission and authorization service"""
    
    @staticmethod
    def check_permission(user_role: str, required_permission: str) -> bool:
        """Check if user role has required permission"""
        role_permissions = ROLE_PERMISSIONS.get(user_role, [])
        
        # Check for exact match
        if required_permission in role_permissions:
            return True
        
        # Check for wildcard permissions
        for permission in role_permissions:
            if permission.endswith("*"):
                if required_permission.startswith(permission[:-1]):
                    return True
        
        return False
    
    @staticmethod
    def check_endpoint_access(user_role: str, endpoint: str, method: str = "GET") -> bool:
        """Check if user can access specific endpoint"""
        from .config import PROTECTED_ENDPOINTS
        
        # Check public endpoints first
        for pattern in PROTECTED_ENDPOINTS["public"]:
            if endpoint.startswith(pattern.replace("*", "")):
                return True
        
        # Check admin endpoints
        for pattern in PROTECTED_ENDPOINTS["admin"]:
            if endpoint.startswith(pattern.replace("*", "")):
                return user_role in ["admin", "superadmin"]
        
        # Check user endpoints
        for pattern in PROTECTED_ENDPOINTS["user"]:
            if endpoint.startswith(pattern.replace("*", "")):
                return user_role in ["user", "admin", "superadmin"]
        
        # Default to requiring authentication
        return user_role in ["user", "admin", "superadmin"]


# Service instances
def get_auth_services(db_manager: DatabaseManager):
    """Get authentication service instances"""
    return {
        "user_service": UserService(db_manager),
        "session_service": SessionService(db_manager),
        "audit_service": AuditService(db_manager),
        "token_service": TokenService(),
        "authentik_service": AuthentikService(),
        "permission_service": PermissionService(),
    }