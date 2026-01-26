// Enhanced Header.jsx with Fixed API Integration and Logout
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Settings, 
  LogOut, 
  Shield, 
  Bell, 
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBackend } from '../../contexts/BackendContext';
import { backendApi } from '../../services/api';
import { HamburgerMenu } from './Sidebar';
import UserProfile from '../auth/UserProfile';
import toast from 'react-hot-toast';

const Header = () => {
  const location = useLocation();
  const { 
    isAuthenticated, 
    user,
    logout: authLogout,
    accessToken 
  } = useAuth();
  
  const { 
    isConnected, 
    isLLMAvailable, 
    systemInfo 
  } = useBackend();

  // Local state for profile data from /auth/profile endpoint
  const [profileData, setProfileData] = useState({ 
    name: null, 
    email: null 
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Fetch user profile data from /auth/profile endpoint
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!isAuthenticated || !accessToken) {
        setProfileData({ name: null, email: null });
        return;
      }

      setIsLoadingProfile(true);
      try {
        const response = await backendApi.get('/auth/profile', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.data) {
          setProfileData({
            name: response.data.name,
            email: response.data.email
          });
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        
        // Fallback to user data from auth context if profile endpoint fails
        if (user) {
          setProfileData({
            name: user.full_name || user.username || null,
            email: user.email || null
          });
        }
        
        toast.error('Failed to load user profile');
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [isAuthenticated, accessToken, user]);

  const getRoleBadgeColor = (userRole) => {
    switch (userRole) {
      case 'superadmin':
        return 'bg-psycon-purple/10 text-psycon-purple border-psycon-purple/20';
      case 'admin':
        return 'bg-psycon-mint/10 text-psycon-mint border-psycon-mint/20';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Enhanced logout function with proper API calls
  const handleLogout = async () => {
    setShowUserMenu(false);
    
    try {
      // Show loading toast
      const loadingToast = toast.loading('Logging out...');
      
      // Call backend logout endpoint if available
      if (accessToken) {
        try {
          await backendApi.post('/auth/logout', {
            all_sessions: false // Only logout current session
          }, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (backendError) {
          // If backend logout fails, continue with frontend logout
          console.warn('Backend logout failed, continuing with frontend logout:', backendError);
        }
      }

      // Clear local profile data
      setProfileData({ name: null, email: null });
      
      // Call auth context logout (this should clear tokens and redirect)
      await authLogout();
      
      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success('Logged out successfully');
      
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Logout failed. Please try again.');
    }
  };

  // Get page title based on current route
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Audio Upload & Analysis';
      case '/results':
        return 'Processing Results';
      case '/analysis':
        return 'AI Analysis & Insights';
      case '/admin':
        return 'Admin Panel';
      case '/settings':
        return 'Application Settings';
      case '/login':
        return 'Sign In';
      default:
        return 'Speech Diarization Platform';
    }
  };

  // Status indicator component
  const StatusIndicator = ({ isConnected, label, color }) => (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${color} ${isConnected ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-gray-600 hidden sm:inline">{label}</span>
    </div>
  );

  // Get display name with fallback logic
  const getDisplayName = () => {
    if (isLoadingProfile) return 'Loading...';
    return profileData.name || profileData.email || user?.username || user?.email || 'User';
  };

  // Get user email for display
  const getUserEmail = () => {
    return profileData.email || user?.email || '';
  };

  // Get user role from context
  const getUserRole = () => {
    return user?.role || 'user';
  };
  

  // Check if user is admin
  const isAdmin = () => {
    const role = getUserRole();
    return role === 'admin' || role === 'superadmin';
  };

  return (
    <>
      <header className="bg-white border-b border-gray-300 shadow-sm sticky top-0 py-1 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Left Side - Logo & Mobile Menu */}
            <div className="flex items-center">
              {/* Mobile Hamburger Menu - Only visible on mobile */}
              <div className="lg:hidden mr-4">
                <HamburgerMenu />
              </div>
              
              {/* Logo */}
              <Link to="/" className="flex items-center">
                <img 
                  src="/Logo.png" 
                  alt="PsyConTech" 
                  className="h-16 w-auto"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </Link>
              
              <Link to="/" className="flex items-center ml-2">
                <img 
                  src="/Text.png" 
                  alt="PsyConTech" 
                  className="h-14 w-auto"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </Link>

            {/* <Link to="/" className="flex items-center ml-2">
              <span className="text-2xl p-1 font-bold text-psycon-purple-400">
                Company 
              </span>
              <span className="text-2xl font-bold text-psycon-yellow-400">
                Name
              </span>

            </Link> */}


            </div>
  
            {/* Center - Page Title */}
            <div className="hidden md:block">
              <h1 className="text-lg font-semibold text-psycon-purple-600">
                {getPageTitle()}
              </h1>
            </div>
  
            {/* Right Side - Status Indicators & User Menu */}
            <div className="flex items-center space-x-4">
              
              {/* System Status Indicators */}
              <div className="hidden sm:flex items-center space-x-3 text-sm">
                <StatusIndicator 
                  isConnected={isConnected} 
                  label="Backend" 
                  color={isConnected ? 'bg-green-400' : 'bg-red-400'}
                />
                <StatusIndicator 
                  isConnected={isLLMAvailable} 
                  label="LLM" 
                  color={isLLMAvailable ? 'bg-green-400' : 'bg-gray-400'}
                />
              </div>
  
              {/* User Menu */}
              <div className="flex items-center space-x-3">
                {isAuthenticated ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-psycon-light-teal/10 transition-colors focus:outline-none focus:ring-2 focus:ring-psycon-mint"
                      disabled={isLoadingProfile}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-psycon-mint to-psycon-purple rounded-full flex items-center justify-center">
                        {user?.avatar_url ? (
                          <img 
                            src={user.avatar_url} 
                            alt="Avatar" 
                            className="w-8 h-8 rounded-full"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="hidden sm:block text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {getDisplayName()}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">
                          {getUserRole()}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
  
                    {/* User Dropdown Menu */}
                    {showUserMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowUserMenu(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20"
                        >
                          <div className="p-4 border-b border-gray-100">
                            <div className="text-sm font-medium text-gray-900">
                              {getDisplayName()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {getUserEmail()}
                            </div>
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 border ${getRoleBadgeColor(getUserRole())}`}>
                              {getUserRole() === 'superadmin' && (
                                <>
                                  <Shield className="w-3 h-3 mr-1" />
                                  Super Admin
                                </>
                              )}
                              {getUserRole() === 'admin' && (
                                <>
                                  <Shield className="w-3 h-3 mr-1" />
                                  Admin
                                </>
                              )}
                              {getUserRole() === 'user' && (
                                <>
                                  <User className="w-3 h-3 mr-1" />
                                  User
                                </>
                              )}
                            </div>
                          </div>
  
                          <div className="py-2">
                            <button
                              onClick={() => {
                                setShowUserProfile(true);
                                setShowUserMenu(false);
                              }}
                              className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-psycon-light-teal/10 transition-colors"
                            >
                              <User className="w-4 h-4" />
                              <span>Profile Details</span>
                            </button>
  
                            {/* <Link
                              to="/settings"
                              className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-psycon-light-teal/10 transition-colors"
                              onClick={() => setShowUserMenu(false)}
                            >
                              <Settings className="w-4 h-4" />
                              <span>Settings</span>
                            </Link> */}
  
                            {isAdmin() && (
                              <Link
                                to="/admin"
                                className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-psycon-light-teal/10 transition-colors"
                                onClick={() => setShowUserMenu(false)}
                              >
                                <Shield className="w-4 h-4" />
                                <span>Admin Panel</span>
                              </Link>
                            )}
  
                            <div className="border-t border-gray-100 my-1"></div>
  
                            <button
                              onClick={handleLogout}
                              className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>Sign Out</span>
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="inline-flex items-center px-4 py-2 border border-psycon-mint text-sm font-medium rounded-lg text-psycon-mint bg-white hover:bg-psycon-light-teal/10 transition-colors"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
  
      {/* User Profile Modal */}
      {showUserProfile && (
        <UserProfile 
          isOpen={showUserProfile}
          onClose={() => setShowUserProfile(false)}
        />
      )}
    </>
  );
};

export default Header;