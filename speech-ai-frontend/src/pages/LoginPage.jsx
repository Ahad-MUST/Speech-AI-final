// src/pages/LoginPage.jsx - Login Page with Authentik SSO


import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Shield, 
  LogIn, 
  Users, 
  Lock, 
  ArrowRight, 
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const { 
    isAuthenticated, 
    isLoading, 
    login, 
    authConfig 
  } = useAuth();
  const location = useLocation();
  const [loginLoading, setLoginLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState('checking'); // checking, available, unavailable

  // Check authentication system availability
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        if (authConfig) {
          setAuthStatus('available');
        } else {
          setAuthStatus('unavailable');
        }
      } catch (error) {
        console.error('Auth status check failed:', error);
        setAuthStatus('unavailable');
      }
    };

    if (!isLoading) {
      checkAuthStatus();
    }
  }, [authConfig, isLoading]);

  // Redirect if already authenticated
  if (isAuthenticated) {
    const from = location.state?.from || '/';
    return <Navigate to={from} replace />;
  }

  // Handle login button click
  const handleLogin = async () => {
    if (authStatus !== 'available') {
      toast.error('Authentication system is not available');
      return;
    }

    try {
      setLoginLoading(true);
      await login();
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Show loading state
  if (isLoading || authStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">
            Initializing authentication...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 px-4">
      <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-8">
        
        {/* Left Panel - Welcome & Features */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex flex-col justify-center space-y-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to Speech Diarization Platform
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Advanced AI-powered speech analysis with secure authentication
            </p>
          </div>

          <div className="space-y-6">
            <FeatureItem
              icon={<Shield className="w-6 h-6" />}
              title="Secure Authentication"
              description="Enterprise-grade security with Authentik SSO integration"
            />
            <FeatureItem
              icon={<Users className="w-6 h-6" />}
              title="Role-Based Access"
              description="Granular permissions for users, admins, and super administrators"
            />
            <FeatureItem
              icon={<Lock className="w-6 h-6" />}
              title="Privacy Focused"
              description="Local processing ensures your data never leaves your infrastructure"
            />
          </div>
        </motion.div>

        {/* Right Panel - Login Form */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center justify-center"
        >
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-8">
            
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Sign In
              </h2>
              <p className="text-gray-600 mt-2">
                Continue with your organization account
              </p>
            </div>

            {/* Auth Status */}
            {authStatus === 'available' ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  <p className="text-sm text-green-700">
                    Authentication system is ready
                  </p>
                </div>
                {authConfig?.oidc_config?.authority && (
                  <p className="text-xs text-green-600 mt-1">
                    Provider: {new URL(authConfig.oidc_config.authority).hostname}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700">
                    Authentication system unavailable
                  </p>
                </div>
                <p className="text-xs text-red-600 mt-1">
                  Please contact your administrator
                </p>
              </div>
            )}

            {/* Login Button */}
            <button
              onClick={handleLogin}
              disabled={loginLoading || authStatus !== 'available'}
              className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                authStatus === 'available' && !loginLoading
                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Redirecting...</span>
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  <span>Sign in with SSO</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Additional Info */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-center text-sm text-gray-500">
                By signing in, you agree to our security policies and data protection measures.
              </p>
            </div>

            {/* Help Text */}
            <div className="mt-6 text-center">
              <details className="group">
                <summary className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                  Need help signing in?
                </summary>
                <div className="mt-3 text-sm text-gray-600 space-y-2">
                  <p>• Contact your system administrator for account access</p>
                  <p>• Ensure you're connected to the organization network</p>
                  <p>• Clear your browser cache if experiencing issues</p>
                </div>
              </details>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Feature item component
const FeatureItem = ({ icon, title, description }) => (
  <motion.div
    whileHover={{ x: 5 }}
    className="flex items-start space-x-4 p-4 rounded-lg bg-white/50 backdrop-blur-sm"
  >
    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
      {icon}
    </div>
    <div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  </motion.div>
);

export default LoginPage;