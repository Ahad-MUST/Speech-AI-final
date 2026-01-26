# core/dependencies.py - Shared Dependencies

from fastapi import Request

# Global references (set during startup)
db_manager = None
pipeline = None
queue_manager = None
thread_pool = None

async def get_current_user_optional(request: Request):
    """Try to get current user but don't fail if not authenticated"""
    try:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
            from auth.middleware import get_current_user
            credentials = HTTPAuthorizationCredentials(
                scheme="Bearer",
                credentials=auth_header.replace('Bearer ', '')
            )
            return await get_current_user(credentials)
    except:
        pass
    return None