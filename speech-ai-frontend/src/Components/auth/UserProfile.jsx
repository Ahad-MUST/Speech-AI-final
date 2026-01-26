// src/components/auth/UserProfile.jsx - CLEANED VERSION

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  X,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { backendApi } from '../../services/api';

const UserProfile = ({ isOpen, onClose }) => {
  const { user } = useAuth(); // Only need user object from context
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  // Load user data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUserData();
    }
  }, [isOpen]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading user profile data...');
      
      const response = await backendApi.auth.getCurrentUser();
      console.log('✅ User data loaded:', response.data);
      setUserInfo(response.data);
      
    } catch (error) {
      console.error('Failed to load user data:', error);
      console.warn('Using fallback user data from auth context');
      
      // Simple fallback - just use null, getDisplayData handles fallbacks
      setUserInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleString();
  };

  // Simplified display data with single fallback chain
  const getDisplayData = () => {
    // Priority: API data -> context data -> defaults
    const apiUser = userInfo?.user || {};
    const contextUser = user || {};
    const permissions = userInfo?.permissions || {};
    const sessionInfo = userInfo?.session_info || {};

    return {
      username: apiUser.username || contextUser.username || 'Unknown',
      email: apiUser.email || contextUser.email || 'Not provided',
      fullName: apiUser.full_name || contextUser.name || apiUser.username || contextUser.username || 'Not provided',
      firstName: apiUser.first_name || contextUser.first_name || '',
      lastName: apiUser.last_name || contextUser.last_name || '',
      role: permissions.role || apiUser.role || contextUser.role || 'user',
      groups: apiUser.groups || contextUser.groups || [],
      isVerified: apiUser.is_verified ?? contextUser.is_verified ?? false,
      isActive: apiUser.is_active !== false,
      // lastLogin: sessionInfo.last_login || null,
      // loginCount: sessionInfo.login_count || null,
      isAdmin: permissions.is_admin || (permissions.role === 'admin') || (apiUser.role === 'admin') || (contextUser.role === 'admin') || false
    };
  };

  const displayData = getDisplayData();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative min-h-screen flex items-center justify-center p-4"
        >
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">User Profile</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              
              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <span className="ml-3 text-gray-600">Loading profile...</span>
                </div>
              )}

              {/* Error Notice - Only show if API failed but we have context data */}
              {!loading && !userInfo && user && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                    <p className="text-sm text-yellow-700">
                      Could not load latest profile data. Showing cached information.
                    </p>
                  </div>
                </div>
              )}

              {/* Profile Content */}
              {!loading && (
                <div className="space-y-6">
                  
                  {/* User Header */}
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <User className="w-10 h-10 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">{displayData.fullName}</h3>
                    <p className="text-gray-600">{displayData.email}</p>
                    <div className="flex items-center justify-center mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        displayData.isAdmin 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {displayData.isAdmin && <Shield className="w-3 h-3 mr-1" />}
                        {displayData.role.charAt(0).toUpperCase() + displayData.role.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Account Information */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2">
                      Account Information
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-4">
                      
                      {/* Username */}
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm font-medium text-gray-500">Username</span>
                        <span className="text-sm text-gray-900">{displayData.username}</span>
                      </div>

                      {/* Email */}
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm font-medium text-gray-500">Email</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-900">{displayData.email}</span>
                          {displayData.isVerified && (
                            <CheckCircle className="w-4 h-4 text-green-500" title="Verified" />
                          )}
                        </div>
                      </div>

                      {/* Full Name */}
                      {displayData.fullName !== displayData.username && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm font-medium text-gray-500">Full Name</span>
                          <span className="text-sm text-gray-900">{displayData.fullName}</span>
                        </div>
                      )}

                      {/* Role */}
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm font-medium text-gray-500">Role</span>
                        <span className="text-sm text-gray-900 capitalize">{displayData.role}</span>
                      </div>

                      {/* Groups */}
                      {displayData.groups.length > 0 && (
                        <div className="flex justify-between items-start py-2">
                          <span className="text-sm font-medium text-gray-500">Groups</span>
                          <div className="flex flex-wrap gap-1 max-w-48">
                            {displayData.groups.map((group, index) => (
                              <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                                {group}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Account Status */}
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm font-medium text-gray-500">Status</span>
                        <span className={`text-sm ${displayData.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {displayData.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Last Login */}
                      {displayData.lastLogin && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm font-medium text-gray-500">Last Login</span>
                          <span className="text-sm text-gray-900">{formatDateTime(displayData.lastLogin)}</span>
                        </div>
                      )}

                      {/* Login Count */}
                      {displayData.loginCount && (
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm font-medium text-gray-500">Total Logins</span>
                          <span className="text-sm text-gray-900">{displayData.loginCount}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SSO Notice */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="text-blue-800 font-medium mb-1">Profile Management</p>
                        <p className="text-blue-700">
                          Contact your administrator to update profile information. 
                          User data is managed through the Administration
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default UserProfile;