# auth/routes.py - Authentication API Routes - COMPLETE FIXED VERSION

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List
from datetime import datetime

from .service import (
    TokenService, AuthentikService, get_auth_services,
    AuthenticationError, AuthorizationError
)
from .middleware import (
    get_current_user, require_auth, require_admin, 
    create_session_info, parse_user_agent
)
from .models import User, UserSession, AuditLog
from .config import auth_settings, OIDC_CONFIG
from database.models import DatabaseManager


# Pydantic models for API
class LoginRequest(BaseModel):
    code: str
    redirect_uri: str
    state: Optional[str] = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None
    all_sessions: bool = False


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class ChangeRoleRequest(BaseModel):
    user_id: int
    new_role: str


# Create router
def create_auth_router(db_manager: DatabaseManager) -> APIRouter:
    """Create authentication router with database manager dependency"""
    
    router = APIRouter(prefix="/auth", tags=["authentication"])
    services = get_auth_services(db_manager)
    
    @router.get("/config")
    async def get_auth_config():
        """Get OIDC configuration for frontend - FIXED with client_secret"""
        return {
            "oidc_config": {
                "authority": auth_settings.AUTHENTIK_ISSUER_URL,
                "client_id": auth_settings.AUTHENTIK_CLIENT_ID,
                "client_secret": auth_settings.AUTHENTIK_CLIENT_SECRET,  # CRITICAL: Add this
                "redirect_uri": auth_settings.AUTHENTIK_REDIRECT_URI,
                "post_logout_redirect_uri": auth_settings.AUTHENTIK_REDIRECT_URI.replace("/auth/callback", "/"),
                "scope": auth_settings.AUTHENTIK_SCOPE,
                "response_type": "code",
                "client_authentication": "client_secret_post",  # CRITICAL: Add this
            },
            "features": {
                "registration_enabled": True,
                "email_verification_required": getattr(auth_settings, 'REQUIRE_EMAIL_VERIFICATION', False),
                "multi_factor_enabled": False,
                "social_login_enabled": True
            },
            "auth_url": f"{auth_settings.AUTHENTIK_ISSUER_URL}/application/o/authorize/",
            "logout_url": f"{auth_settings.AUTHENTIK_ISSUER_URL}/application/o/logout/"
        }
    
    @router.get("/profile")
    async def get_user_profile(current_user: User = Depends(get_current_user)):
        """Get current user's profile information for display"""
        
        # Smart name logic (as discussed)
        name = None
        if current_user.full_name and current_user.full_name.strip():
            name = current_user.full_name.strip()
        else:
            name_parts = []
            if current_user.first_name and current_user.first_name.strip():
                name_parts.append(current_user.first_name.strip())
            if current_user.last_name and current_user.last_name.strip():
                name_parts.append(current_user.last_name.strip())
            
            if name_parts:
                name = " ".join(name_parts)
        
        return {
            "name": name,
            "email": current_user.email
        }
    @router.post("/login")
    async def login(request: Request, login_data: LoginRequest):
        """Exchange authorization code for JWT tokens"""
        try:
            # Get client information
            client_info = {
                "ip_address": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", ""),
                **parse_user_agent(request.headers.get("user-agent", ""))
            }
            
            # Exchange code for Authentik access token
            token_response = services["authentik_service"].exchange_code_for_token(
                login_data.code, 
                login_data.redirect_uri
            )
            
            # Get user info from Authentik
            authentik_user_data = services["authentik_service"].verify_authentik_token(
                token_response["access_token"]
            )
            
            # Get or create user in local database
            user = services["user_service"].get_or_create_user(authentik_user_data)
            
            # Create JWT tokens
            access_token = services["token_service"].create_access_token(
                user.id, user.to_dict()
            )
            refresh_token = services["token_service"].create_refresh_token(user.id)
            
            # Decode tokens to get JTIs
            access_payload = services["token_service"].verify_token(access_token, "access")
            refresh_payload = services["token_service"].verify_token(refresh_token, "refresh")
            
            # Create user session
            session = services["session_service"].create_session(
                user.id,
                client_info,
                access_payload["jti"],
                refresh_payload["jti"]
            )
            
            # Update user login info
            services["user_service"].update_login_info(user.id)
            
            # Log successful login
            services["audit_service"].log_action(
                user_id=user.id,
                action="login",
                success=True,
                client_info=client_info,
                details=f"Session: {session.session_id}"
            )
            
            return create_session_info(user, access_token, refresh_token)
            
        except AuthenticationError as e:
            # Log failed login attempt
            services["audit_service"].log_action(
                user_id=None,
                action="login_failed",
                success=False,
                error_message=str(e),
                client_info={
                    "ip_address": request.client.host if request.client else "unknown",
                    "user_agent": request.headers.get("user-agent", "")
                }
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e)
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Login failed"
            )
    
    @router.post("/refresh")
    async def refresh_token(refresh_data: TokenRefreshRequest):
        """Refresh access token using refresh token"""
        try:
            # Verify refresh token
            payload = services["token_service"].verify_token(
                refresh_data.refresh_token, 
                "refresh"
            )
            user_id = int(payload["sub"])
            jti = payload["jti"]
            
            # Check if token is revoked
            db = db_manager.get_session()
            try:
                if services["token_service"].is_token_revoked(db, jti):
                    raise AuthenticationError("Refresh token has been revoked")
            finally:
                db.close()
            
            # Get user
            user = services["user_service"].get_user_by_id(user_id)
            if not user or not user.is_active:
                raise AuthenticationError("User not found or inactive")
            
            # Create new access token
            access_token = services["token_service"].create_access_token(
                user.id, user.to_dict()
            )
            
            # Update user activity
            services["user_service"].update_login_info(user.id)
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "expires_in": auth_settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                "user": user.to_dict()
            }
            
        except AuthenticationError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e)
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token refresh failed"
            )
        
    @router.get("/profile")
    async def get_current_user_profile(current_user: User = Depends(get_current_user)):

        """Get current user's profile information for display"""
        
        # Smart name logic (Option A as discussed)
        name = None
        if current_user.full_name and current_user.full_name.strip():
            name = current_user.full_name.strip()
        else:
            # Combine first_name + last_name
            name_parts = []
            if current_user.first_name and current_user.first_name.strip():
                name_parts.append(current_user.first_name.strip())
            if current_user.last_name and current_user.last_name.strip():
                name_parts.append(current_user.last_name.strip())
            
            if name_parts:
                name = " ".join(name_parts)
            # else: name stays None (no fake fallbacks)
        
        return {
            "name": name,
            "email": current_user.email
        }

    @router.post("/logout")
    async def logout(
        request: Request, 
        logout_data: LogoutRequest,
        current_user: User = Depends(get_current_user)
    ):
        """Logout user and revoke tokens"""
        try:
            client_info = {
                "ip_address": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", "")
            }
            
            if logout_data.all_sessions:
                # Revoke all user sessions
                services["session_service"].revoke_all_user_sessions(current_user.id)
                action = "logout_all_sessions"
            else:
                # Revoke current session only
                if logout_data.refresh_token:
                    try:
                        refresh_payload = services["token_service"].verify_token(
                            logout_data.refresh_token, "refresh"
                        )
                        services["token_service"].revoke_token(
                            db_manager.get_session(),
                            refresh_payload["jti"],
                            current_user.id,
                            "refresh",
                            "logout"
                        )
                    except:
                        pass  # Token might already be expired/invalid
                
                action = "logout"
            
            # Log logout
            services["audit_service"].log_action(
                user_id=current_user.id,
                action=action,
                success=True,
                client_info=client_info
            )
            
            return {"message": "Logged out successfully"}
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Logout failed"
            )
    
    @router.get("/me")
    async def get_current_user_info(current_user: User = Depends(require_auth)):
        """Get current user information"""
        return {
            "user": current_user.to_dict(),
            "permissions": {
                "role": current_user.role,
                "is_admin": current_user.is_admin(),
                "permissions": services["permission_service"].check_permission(
                    current_user.role, "admin:read"
                )
            },
            "session_info": {
                "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
                "login_count": current_user.login_count,
                "is_verified": current_user.is_verified
            }
        }
    
    @router.put("/me")
    async def update_profile(
        update_data: UserProfileUpdate,
        current_user: User = Depends(require_auth)
    ):
        """Update current user profile"""
        try:
            db = db_manager.get_session()
            try:
                user = db.query(User).filter(User.id == current_user.id).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                
                # Update fields if provided
                if update_data.full_name is not None:
                    user.full_name = update_data.full_name
                if update_data.first_name is not None:
                    user.first_name = update_data.first_name
                if update_data.last_name is not None:
                    user.last_name = update_data.last_name
                
                user.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(user)
                
                # Log profile update
                services["audit_service"].log_action(
                    user_id=current_user.id,
                    action="profile_update",
                    success=True,
                    details=f"Updated: {', '.join([k for k, v in update_data.dict().items() if v is not None])}"
                )
                
                return {"message": "Profile updated successfully", "user": user.to_dict()}
                
            finally:
                db.close()
                
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Profile update failed"
            )
    
    @router.get("/sessions")
    async def get_user_sessions(current_user: User = Depends(require_auth)):
        """Get current user's active sessions"""
        try:
            db = db_manager.get_session()
            try:
                sessions = db.query(UserSession).filter(
                    UserSession.user_id == current_user.id,
                    UserSession.is_active == True
                ).order_by(UserSession.last_activity.desc()).all()
                
                return {
                    "sessions": [session.to_dict() for session in sessions],
                    "total_active": len(sessions)
                }
                
            finally:
                db.close()
                
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get sessions"
            )
    
    @router.delete("/sessions/{session_id}")
    async def revoke_session(
        session_id: str,
        current_user: User = Depends(require_auth)
    ):
        """Revoke a specific session"""
        try:
            db = db_manager.get_session()
            try:
                session = db.query(UserSession).filter(
                    UserSession.session_id == session_id,
                    UserSession.user_id == current_user.id
                ).first()
                
                if not session:
                    raise HTTPException(status_code=404, detail="Session not found")
                
                session.revoke()
                db.commit()
                
                # Log session revocation
                services["audit_service"].log_action(
                    user_id=current_user.id,
                    action="session_revoke",
                    resource="session",
                    resource_id=session_id,
                    success=True
                )
                
                return {"message": "Session revoked successfully"}
                
            finally:
                db.close()
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to revoke session"
            )
    
    # Admin routes
    @router.get("/admin/users")
    async def get_all_users(
        skip: int = 0,
        limit: int = 100,
        admin_user: User = Depends(require_admin)
    ):
        """Get all users (admin only)"""
        try:
            db = db_manager.get_session()
            try:
                users = db.query(User).offset(skip).limit(limit).all()
                total = db.query(User).count()
                
                return {
                    "users": [user.to_dict(include_sensitive=True) for user in users],
                    "total": total,
                    "skip": skip,
                    "limit": limit
                }
                
            finally:
                db.close()
                
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get users"
            )
    
    @router.put("/admin/users/{user_id}/role")
    async def change_user_role(
        user_id: int,
        role_data: ChangeRoleRequest,
        admin_user: User = Depends(require_admin)
    ):
        """Change user role (admin only)"""
        try:
            if role_data.new_role not in ["user", "admin", "superadmin"]:
                raise HTTPException(status_code=400, detail="Invalid role")
            
            # Only superadmin can create other superadmins
            if role_data.new_role == "superadmin" and admin_user.role != "superadmin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only superadmin can assign superadmin role"
                )
            
            db = db_manager.get_session()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                
                old_role = user.role
                user.role = role_data.new_role
                user.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(user)
                
                # Log role change
                services["audit_service"].log_action(
                    user_id=admin_user.id,
                    action="role_change",
                    resource="user",
                    resource_id=str(user_id),
                    success=True,
                    details=f"Changed role from {old_role} to {role_data.new_role}"
                )
                
                return {
                    "message": "Role updated successfully",
                    "user": user.to_dict(include_sensitive=True)
                }
                
            finally:
                db.close()
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user role"
            )
    
    @router.get("/admin/audit-logs")
    async def get_audit_logs(
        skip: int = 0,
        limit: int = 100,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        admin_user: User = Depends(require_admin)
    ):
        """Get audit logs (admin only)"""
        try:
            db = db_manager.get_session()
            try:
                query = db.query(AuditLog)
                
                if user_id:
                    query = query.filter(AuditLog.user_id == user_id)
                if action:
                    query = query.filter(AuditLog.action.contains(action))
                
                logs = query.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
                total = query.count()
                
                return {
                    "logs": [log.to_dict() for log in logs],
                    "total": total,
                    "skip": skip,
                    "limit": limit
                }
                
            finally:
                db.close()
                
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get audit logs"
            )
        


        
    
    @router.delete("/admin/users/{user_id}")
    async def deactivate_user(
        user_id: int,
        admin_user: User = Depends(require_admin)
    ):
        """Deactivate user (admin only)"""
        try:
            if user_id == admin_user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot deactivate your own account"
                )
            
            db = db_manager.get_session()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                
                user.is_active = False
                user.updated_at = datetime.utcnow()
                db.commit()
                
                # Revoke all user sessions
                services["session_service"].revoke_all_user_sessions(user_id)
                
                # Log user deactivation
                services["audit_service"].log_action(
                    user_id=admin_user.id,
                    action="user_deactivate",
                    resource="user",
                    resource_id=str(user_id),
                    success=True,
                    details=f"Deactivated user: {user.username}"
                )
                
                return {"message": "User deactivated successfully"}
                
            finally:
                db.close()
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to deactivate user"
            )
    
    return router