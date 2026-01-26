// Fix your AuthCallback.jsx component to prevent double processing

import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleLoginCallback, isAuthenticated, isLoading } = useAuth();
  const hasProcessed = useRef(false); // Prevent double processing
  
  useEffect(() => {
    // Prevent double execution in StrictMode
    if (hasProcessed.current) {
      console.log('🔄 AuthCallback: Already processed, skipping...');
      return;
    }

    const processCallback = async () => {
      try {
        // Mark as processing to prevent double execution
        hasProcessed.current = true;
        
        console.log('🔄 AuthCallback: Starting callback processing');
        
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        console.log('📋 URL params:', {
          hasCode: !!code,
          error,
          errorDescription,
          fullUrl: window.location.href
        });

        // Handle OAuth errors
        if (error) {
          throw new Error(`OAuth Error: ${error} - ${errorDescription || 'Unknown error'}`);
        }

        // Must have authorization code
        if (!code) {
          throw new Error('No authorization code received from OAuth provider');
        }

        console.log('🔄 Processing authentication callback...');
        
        // Process the callback
        const result = await handleLoginCallback();
        
        console.log('✅ Authentication successful');
        
        // Navigate to the return URL
        const returnUrl = result?.returnUrl || '/';
        navigate(returnUrl, { replace: true });
        
      } catch (error) {
        console.error('❌ Auth callback error:', error);
        
        // Clear URL parameters and show error
        navigate('/login', { replace: true });
        
        toast.error(
          error.message || 'Authentication failed. Please try again.',
          { duration: 5000 }
        );
      }
    };

    // Check if already authenticated
    if (isAuthenticated) {
      console.log('✅ Already authenticated, redirecting home');
      navigate('/', { replace: true });
      return;
    }

    // Don't process if already loading
    if (isLoading) {
      console.log('⏳ Auth already in progress, waiting...');
      return;
    }

    // Process the callback
    processCallback();
  }, [searchParams, handleLoginCallback, navigate, isAuthenticated, isLoading]);

  // Show loading screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Completing Sign In...
        </h2>
        <p className="text-gray-600">
          Please wait while we verify your authentication.
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;