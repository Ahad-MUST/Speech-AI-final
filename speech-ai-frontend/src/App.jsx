// src/App.jsx - UPDATED with URL parameter support for TranscriptionPage
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Import custom editor styles
import './styles/EditorStyles.css';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';
import { BackendProvider } from './contexts/BackendContext';

// Components
import ErrorBoundary from './Components/common/ErrorBoundary';
import Header from './Components/layout/Header';
import { Sidebar } from './Components/layout/Sidebar';

// Auth Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';

// Pages
import HomePage from './pages/HomePage';
import TranscriptionPage from './pages/TranscriptionPage';
import SettingsPage from './pages/SettingsPage';
import AnalysisPage from './pages/AnalysisPage';
import AdminDashboard from './pages/AdminPanel';

const App = () => {
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    // Check token when user returns to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User returned to tab - check token immediately
        const token = localStorage.getItem('access_token');
        if (token) {
          // Basic expiration check
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const isExpired = payload.exp < Math.floor(Date.now() / 1000);
            if (isExpired) {
              console.log('⚠️ Token expired while tab was hidden');
              // Force page reload to trigger AuthContext check
              window.location.reload();
            }
          } catch (e) {
            console.error('Error checking token:', e);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BackendProvider>
          <Router
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route 
                path="/auth/silent-callback" 
                element={<div>Processing authentication...</div>} 
              />

              {/* Protected Routes with Layout Structure */}
              <Route 
                path="/*" 
                element={
                  <ProtectedRoute>
                    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
                      
                      {/* Header - Full Width on Top */}
                      <Header />
                      
                      {/* Content Area Below Header */}
                      <div className="flex flex-1 overflow-hidden">
                        
                        {/* Desktop Sidebar - Only visible on large screens */}
                        {showSidebar && (
                          <div className="hidden lg:flex lg:flex-shrink-0">
                            <div className="flex flex-col w-20 xl:w-24">
                              <Sidebar />
                            </div>
                          </div>
                        )}

                        {/* Main Content */}
                        <main className="flex-1 relative overflow-y-auto focus:outline-none">
                          <Routes>
                            {/* HomePage - Audio Upload with Structure/Parameters */}
                            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                            
                            {/* ✅ UPDATED: ResultPage with optional sessionId parameter */}
                            <Route path="/results/:sessionId?" element={<TranscriptionPage />} />
                            
                            {/* AnalysisPage - AI Analysis page */}
                            <Route path="/analysis" element={<AnalysisPage />} />
                            
                            {/* AdminPage - Prompt Management Dashboard */}
                            <Route 
                              path="/admin" 
                              element={
                                <ProtectedRoute requireAdmin={true}>
                                  <AdminDashboard />
                                </ProtectedRoute>
                              } 
                            />
                            
                            {/* SettingsPage - Application settings */}
                            <Route path="/settings" element={<SettingsPage />} />
                          </Routes>
                        </main>
                        
                      </div>
                    </div>
                  </ProtectedRoute>
                }
              />
            </Routes>

            {/* Toast Notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10B981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#EF4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </Router>
        </BackendProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;