// src/contexts/AuthContext.jsx - Updated with Token Expiration Handling

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

// Authentication context
const AuthContext = createContext(null);

// Helper function to decode JWT and check expiration
const decodeToken = (token) => {
  if (!token) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }
    
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

// Check if token is expired
const isTokenExpired = (token) => {
  if (!token) return true;
  
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    console.warn('Token missing expiration claim');
    return true;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const isExpired = decoded.exp < currentTime;
  
  if (isExpired) {
    console.log('Token expired:', {
      exp: new Date(decoded.exp * 1000).toISOString(),
      now: new Date(currentTime * 1000).toISOString()
    });
  }
  
  return isExpired;
};

// Get time until token expires (in seconds)
const getTokenExpirationTime = (token) => {
  if (!token) return 0;
  
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return 0;
  
  const currentTime = Math.floor(Date.now() / 1000);
  return Math.max(0, decoded.exp - currentTime);
};

// Simple auth provider that works directly with Authentik
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [permissions, setPermissions] = useState({});
  
  // ✅ NEW: Refs for token expiration checking
  const tokenCheckInterval = useRef(null);
  const expirationWarningShown = useRef(false);

  const authConfig = {
    authentikUrl: import.meta.env.VITE_AUTHENTIK_BASE_URL,
    appPath: '/application/o/speech-analysis',
    clientId: import.meta.env.VITE_AUTHENTIK_CLIENT_ID,
    clientSecret: 'fhf8On3hqFhDGOAM9RsSqxRIFsalxD6O5TCIhBpmXMJoL0RcAErdYYnSyvnKW2Ozf2SALi62Ks7KSPyHCupSl5g78hynBIUBFSV0EiirglsGdf3Jaw0pk6rljzsmUaST', 
    redirectUri: 'http://localhost:3000/auth/callback',
    authorizeUrl: `${import.meta.env.VITE_AUTHENTIK_BASE_URL}/application/o/authorize/`,
    tokenUrl: `${import.meta.env.VITE_AUTHENTIK_BASE_URL}/application/o/token/`,
    userinfoUrl: `${import.meta.env.VITE_AUTHENTIK_BASE_URL}/application/o/userinfo/`
  };

  // ✅ NEW: Force logout function with reason
  const forceLogout = useCallback(async (reason = 'Session expired') => {
    console.log('🔒 Force logout triggered:', reason);
    
    // Clear all storage
    localStorage.removeItem('auth_user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    
    // Clear state
    setUser(null);
    setIsAuthenticated(false);
    setPermissions({});
    
    // Clear axios header
    if (window.backendApi?.setAuthToken) {
      window.backendApi.setAuthToken(null);
    }
    
    // Stop token checking
    if (tokenCheckInterval.current) {
      clearInterval(tokenCheckInterval.current);
      tokenCheckInterval.current = null;
    }
    
    // Show toast notification
    toast.error(reason, { duration: 5000 });
    
    // Redirect to login
    window.location.replace('/login');
  }, []);

  // ✅ NEW: Check token expiration function
  const checkTokenExpiration = useCallback(() => {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      console.log('ℹ️ No token found during expiration check');
      return;
    }
    
    // Check if token is expired
    if (isTokenExpired(token)) {
      console.log('⚠️ Token is expired, forcing logout');
      forceLogout('Your session has expired. Please login again.');
      return;
    }
    
    // Check if token expires soon (within 5 minutes) and show warning
    const timeUntilExpiration = getTokenExpirationTime(token);
    const fiveMinutes = 5 * 60;
    
    if (timeUntilExpiration <= fiveMinutes && timeUntilExpiration > 0 && !expirationWarningShown.current) {
      const minutes = Math.ceil(timeUntilExpiration / 60);
      console.log(`⏰ Token expires in ${minutes} minute(s)`);
      toast.warning(
        `Your session will expire in ${minutes} minute(s). Please save your work.`,
        { duration: 10000 }
      );
      expirationWarningShown.current = true;
    }
    
    // Reset warning flag if we're back above 5 minutes
    if (timeUntilExpiration > fiveMinutes) {
      expirationWarningShown.current = false;
    }
  }, [forceLogout]);

  // ✅ NEW: Start periodic token expiration checking
  const startTokenExpirationCheck = useCallback(() => {
    // Clear any existing interval
    if (tokenCheckInterval.current) {
      clearInterval(tokenCheckInterval.current);
    }
    
    // Check immediately
    checkTokenExpiration();
    
    // Then check every minute
    tokenCheckInterval.current = setInterval(() => {
      checkTokenExpiration();
    }, 60000); // 60 seconds
    
    console.log('✅ Token expiration checking started (every 60 seconds)');
  }, [checkTokenExpiration]);

  // ✅ NEW: Stop token expiration checking
  const stopTokenExpirationCheck = useCallback(() => {
    if (tokenCheckInterval.current) {
      clearInterval(tokenCheckInterval.current);
      tokenCheckInterval.current = null;
      console.log('🛑 Token expiration checking stopped');
    }
  }, []);

  // Check for existing session on load
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const storedUser = localStorage.getItem('auth_user');
        const storedToken = localStorage.getItem('access_token');
        
        if (storedUser && storedToken) {
          console.log('🔍 Found stored token, checking expiration...');
          
          // ✅ CRITICAL: Check if token is expired FIRST
          if (isTokenExpired(storedToken)) {
            console.warn('⚠️ Stored token is expired, clearing session');
            localStorage.removeItem('auth_user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setUser(null);
            setIsAuthenticated(false);
            setPermissions({});
            setIsLoading(false);
            return;
          }
          
          console.log('🔍 Token valid, validating with backend...');
          
          // Token is valid, now validate with backend
          try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/me`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${storedToken}`,
                'Content-Type': 'application/json'
              }
            });
  
            if (response.ok) {
              // Token is valid
              const userData = JSON.parse(storedUser);
              setUser(userData);
              setIsAuthenticated(true);
              updateUserPermissions(userData);
              
              // ✅ START token expiration checking
              startTokenExpirationCheck();
              
              console.log('✅ Token validated, session restored');
            } else {
              // Token is invalid or expired on backend
              console.warn('⚠️ Token validation failed, clearing session');
              localStorage.removeItem('auth_user');
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              setUser(null);
              setIsAuthenticated(false);
              setPermissions({});
            }
          } catch (validationError) {
            // Network error or backend down - be lenient
            console.error('❌ Token validation error:', validationError);
            
            // For now, trust the local token if backend is unreachable
            // In production, you might want stricter handling
            const userData = JSON.parse(storedUser);
            setUser(userData);
            setIsAuthenticated(true);
            updateUserPermissions(userData);
            
            // ✅ START token expiration checking even if backend is down
            startTokenExpirationCheck();
            
            console.warn('⚠️ Backend unreachable, trusting local token temporarily');
          }
        } else {
          console.log('ℹ️ No stored session found');
        }
      } catch (error) {
        console.error('❌ Session restoration failed:', error);
        // Clear any corrupt data
        localStorage.removeItem('auth_user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        setIsAuthenticated(false);
        setPermissions({});
      } finally {
        setIsLoading(false);
      }
    };
  
    checkExistingSession();
    
    // ✅ CLEANUP: Stop token checking when component unmounts
    return () => {
      stopTokenExpirationCheck();
    };
  }, [startTokenExpirationCheck, stopTokenExpirationCheck]);

  // Update user permissions
  const updateUserPermissions = useCallback((userData) => {
    const role = userData?.role || 'user';
    
    console.log('🔐 Auth Debug:', {
      username: userData?.username,
      backendRole: userData?.role,
      usingRole: role
    });
    
    const newPermissions = {
      role,
      isAdmin: ['admin', 'superadmin'].includes(role),
      isSuperAdmin: role === 'superadmin',
      groups: userData?.groups || [],
      canUpload: true,
      canAnalyze: true,
      canManagePrompts: ['admin', 'superadmin'].includes(role),
      canManageUsers: role === 'superadmin',
    };

    console.log('✅ Permissions set:', { isAdmin: newPermissions.isAdmin, role });
    setPermissions(newPermissions);
  }, []);

  // Determine user role from groups
  const determineUserRole = useCallback((groups) => {
    if (!Array.isArray(groups)) return 'user';
    
    const lowerGroups = groups.map(g => String(g).toLowerCase());
    
    if (lowerGroups.some(g => ['superadmin', 'super-admin'].includes(g))) {
      return 'superadmin';
    }
    if (lowerGroups.some(g => ['admin', 'admins'].includes(g))) {
      return 'admin';
    }
    return 'user';
  }, []);

  // Start login process - redirect to Authentik
  const login = useCallback(async () => {
    try {
      console.log('🔐 Starting login process...');
      console.log('🔧 Auth config:', {
        authentikUrl: authConfig.authentikUrl,
        authorizeUrl: authConfig.authorizeUrl,
        redirectUri: authConfig.redirectUri
      });
      setIsLoading(true);
      
      // Store current location for redirect after login
      const currentPath = window.location.pathname + window.location.search;
      localStorage.setItem('auth_return_url', currentPath);
      
      // Generate state for security
      const state = Math.random().toString(36).substring(7);
      localStorage.setItem('auth_state', state);
      
      // Build authorization URL using environment variables
      const params = new URLSearchParams({
        client_id: authConfig.clientId,
        response_type: 'code',
        scope: import.meta.env.VITE_AUTHENTIK_SCOPE || 'openid profile email groups',
        redirect_uri: authConfig.redirectUri,
        state: state
      });
      
      const authUrl = `${authConfig.authorizeUrl}?${params.toString()}`;
      console.log('🚀 Redirecting to Authentik:', authUrl);
      
      // Redirect to Authentik
      window.location.href = authUrl;
      
    } catch (error) {
      console.error('❌ Login failed:', error);
      toast.error('Login failed. Please try again.');
      setIsLoading(false);
    }
  }, []);

  // Handle callback from Authentik
  const handleLoginCallback = useCallback(async () => {
    try {
      console.log('🔐 Processing login callback...');
      setIsLoading(true);
      
      // Extract parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      
      console.log('📋 Callback params:', { 
        hasCode: !!code, 
        state, 
        hasError: !!error 
      });

      // Check for errors
      if (error) {
        throw new Error(`OAuth Error: ${error}`);
      }
      
      if (!code) {
        throw new Error('No authorization code received');
      }

      // ✅ IMPROVED: Better state verification with fallback
      const storedState = localStorage.getItem('auth_state');
      console.log('🔍 State check:', { received: state, stored: storedState });
      
      if (state && storedState && state !== storedState) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      // If no state in localStorage but state in URL, it might be a page refresh
      // In production, you'd want stricter validation
      if (!storedState && state) {
        console.warn('⚠️ No stored state found, but state in URL. Possible page refresh.');
      }

      // Send code to YOUR backend instead of Authentik directly
      console.log('🔐 Exchanging code via backend...');
      console.log('🔧 Backend URL:', import.meta.env.VITE_BACKEND_URL);
      
      const loginResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: authConfig.redirectUri,
          state: state
        })
      });

      console.log('📡 Backend login response status:', loginResponse.status);

      if (!loginResponse.ok) {
        const errorData = await loginResponse.text();
        let errorMessage;
        
        try {
          const parsedError = JSON.parse(errorData);
          errorMessage = parsedError.detail || `HTTP ${loginResponse.status}`;
        } catch {
          errorMessage = `HTTP ${loginResponse.status}: ${errorData}`;
        }
        
        throw new Error(`Backend login failed: ${errorMessage}`);
      }

      const loginData = await loginResponse.json();
      console.log('✅ Backend login successful');

      // Use user data from YOUR backend response
      const userData = {
        id: loginData.user.id,
        username: loginData.user.username,
        email: loginData.user.email,
        name: loginData.user.full_name,
        first_name: loginData.user.first_name,
        last_name: loginData.user.last_name,
        groups: loginData.user.groups || [],
        avatar_url: loginData.user.avatar_url,
        is_verified: loginData.user.is_verified,
        role: loginData.user.role
      };

      // Store YOUR backend tokens, not Authentik tokens
      localStorage.setItem('auth_user', JSON.stringify(userData));
      localStorage.setItem('access_token', loginData.access_token);
      if (loginData.refresh_token) {
        localStorage.setItem('refresh_token', loginData.refresh_token);
      }

      // Set state
      setUser(userData);
      setIsAuthenticated(true);
      updateUserPermissions(userData);

      // Clean up temporary storage
      localStorage.removeItem('auth_state');

      // ✅ START token expiration checking after successful login
      startTokenExpirationCheck();

      toast.success(`Welcome back, ${userData.name || userData.username}!`);

      // Get return URL
      const returnUrl = localStorage.getItem('auth_return_url') || '/';
      localStorage.removeItem('auth_return_url');

      return { user: userData, returnUrl };

    } catch (error) {
      console.error('❌ Login callback failed:', error);
      
      // Clean up on error - but don't clear if it's just a network error
      const isNetworkError = error.message.includes('fetch') || error.message.includes('Failed to fetch');
      
      if (!isNetworkError) {
        localStorage.removeItem('auth_state');
        localStorage.removeItem('auth_return_url');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        
        setUser(null);
        setIsAuthenticated(false);
        setPermissions({});
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [updateUserPermissions, authConfig.redirectUri, startTokenExpirationCheck]);

  const logout = useCallback(async () => {
    try {
      console.log('🚪 Logging out from Speech App...');
      
      // ✅ STOP token expiration checking
      stopTokenExpirationCheck();
      
      // 1. Get the current access token BEFORE clearing storage
      const currentToken = localStorage.getItem('access_token');
      
      // 2. Call backend logout first (while we still have the token)
      if (currentToken) {
        try {
          await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ all_sessions: false })
          });
          console.log('✅ Backend logout successful');
        } catch (error) {
          console.warn('Backend logout call failed:', error);
          // Continue with logout even if backend call fails
        }
      }
      
      // 3. Clear all local authentication data
      localStorage.removeItem('auth_user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_state');
      localStorage.removeItem('auth_return_url');
      
      // Also clear session storage
      sessionStorage.removeItem('auth_user');
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      
      // 4. Clear app state immediately
      setUser(null);
      setIsAuthenticated(false);
      setPermissions({});
      
      // 5. Clear axios authorization header
      if (window.backendApi?.setAuthToken) {
        window.backendApi.setAuthToken(null);
      }
      
      // 🎯 6. NEW: Redirect to Authentik logout to clear SSO session
      const authentikLogoutUrl = `${authConfig.authentikUrl}/application/o/speech-analysis/end-session/`;
      const postLogoutRedirectUri = encodeURIComponent('http://localhost:3000/login');
      
      console.log('🔐 Redirecting to Authentik logout to clear SSO session...');
      window.location.href = `${authentikLogoutUrl}?post_logout_redirect_uri=${postLogoutRedirectUri}`;
      
    } catch (error) {
      console.error('❌ Logout failed:', error);
      
      // Fallback: Force cleanup and go to login page
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear state
      setUser(null);
      setIsAuthenticated(false);
      setPermissions({});
      
      // Stop checking
      stopTokenExpirationCheck();
      
      // Navigate to login page
      window.location.replace('/login');
    }
  }, [authConfig.authentikUrl, stopTokenExpirationCheck]);

  // Export the simple logout function
  const value = {
    user,
    isLoading,
    isAuthenticated,
    permissions,
    authConfig,
    login,
    logout,
    forceLogout, // ✅ NEW: Expose forceLogout for manual use
    handleLoginCallback,
    checkTokenExpiration, // ✅ NEW: Expose for manual checking if needed
    // Additional convenience properties
    isAdmin: permissions.isAdmin || false,
    isSuperAdmin: permissions.isSuperAdmin || false,
    userRole: permissions.role,
    userGroups: permissions.groups || [],
    userName: user?.name || user?.username,
    userEmail: user?.email
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use authentication context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;