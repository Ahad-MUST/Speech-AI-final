// src/components/auth/ProtectedRoute.jsx - Fixed Protected Route Component

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, Shield, Lock } from 'lucide-react';

// Single LoadingSpinner component definition
const LoadingSpinner = ({ size = 'medium' }) => {
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  return (
    <div className="flex justify-center items-center">
      <div
        className={`${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`}
      />
    </div>
  );
};

const ProtectedRoute = ({ 
  children, 
  requireAdmin = false, 
  requiredPermission = null,
  fallbackPath = '/login' 
}) => {
  const { 
    isAuthenticated, 
    isLoading, 
    isAdmin, 
    hasPermission, 
    user 
  } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-lg text-gray-600">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">
            Administrator privileges are required to access this page.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>Current Role:</strong> {user?.profile?.role || 'User'}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Required Role:</strong> Administrator
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check specific permission requirement
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Lock className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Insufficient Permissions
          </h1>
          <p className="text-gray-600 mb-6">
            You don't have the required permissions to access this resource.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>Required Permission:</strong> {requiredPermission}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Your Role:</strong> {user?.profile?.role || 'User'}
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // All checks passed - render the protected content
  return children;
};

// Higher-order component for admin routes
export const AdminRoute = ({ children, ...props }) => (
  <ProtectedRoute requireAdmin={true} {...props}>
    {children}
  </ProtectedRoute>
);

// Higher-order component for permission-based routes
export const PermissionRoute = ({ permission, children, ...props }) => (
  <ProtectedRoute requiredPermission={permission} {...props}>
    {children}
  </ProtectedRoute>
);

export default ProtectedRoute;