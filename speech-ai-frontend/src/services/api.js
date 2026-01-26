// src/services/api.js - Enhanced API service with automatic logout on 401/403
import axios from 'axios';

// Get backend URL from environment or default
const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8888';

// Create axios instance with default config
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 3000000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth token management
const getStoredAccessToken = () => {
  try {
    return localStorage.getItem('access_token');
  } catch (error) {
    console.warn('Failed to get stored token:', error);
    return null;
  }
};

const setStoredAccessToken = (token) => {
  try {
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  } catch (error) {
    console.warn('Failed to store token:', error);
  }
};

// ✅ NEW: Helper to clear all auth data
const clearAuthData = () => {
  try {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
  } catch (error) {
    console.warn('Failed to clear auth data:', error);
  }
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ ENHANCED: Response interceptor for error handling with automatic logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error handling
    if (error.code === 'ECONNABORTED') {
      error.isTimeout = true;
      error.userMessage = 'Request timed out. Please try again.';
    } else if (error.code === 'ERR_NETWORK') {
      error.isNetworkError = true;
      error.userMessage = 'Network error. Please check your connection.';
    } else if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // ✅ CRITICAL: Unauthorized - Token expired or invalid
          error.userMessage = 'Session expired. Please log in again.';
          
          console.error('🔒 401 Unauthorized - Clearing auth and redirecting to login');
          
          // Clear all auth data
          clearAuthData();
          
          // Redirect to login page
          // Use setTimeout to avoid interrupting the current request chain
          setTimeout(() => {
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }, 100);
          
          break;
          
        case 403:
          // ✅ CRITICAL: Forbidden - User doesn't have permission
          error.userMessage = 'Access denied. Insufficient permissions.';
          
          console.error('🔒 403 Forbidden - User lacks permission');
          
          // Check if this is a token issue vs permission issue
          // If the endpoint is /auth/me or similar, it's likely a token issue
          if (error.config?.url?.includes('/auth/')) {
            console.error('🔒 Auth endpoint returned 403 - Clearing session');
            clearAuthData();
            
            setTimeout(() => {
              if (window.location.pathname !== '/login') {
                window.location.href = '/login';
              }
            }, 100);
          }
          
          break;
          
        case 404:
          error.userMessage = 'Resource not found.';
          break;
          
        case 422:
          error.userMessage = data?.detail || 'Invalid data provided.';
          break;
          
        case 429:
          error.userMessage = 'Too many requests. Please try again later.';
          break;
          
        case 503:
          error.userMessage = 'Service temporarily unavailable.';
          break;
          
        default:
          error.userMessage = data?.detail || data?.message || 'An error occurred.';
      }
    } else {
      error.userMessage = 'An unexpected error occurred.';
    }
    
    return Promise.reject(error);
  }
);

// Main API object with all methods
const backendApi = {
  // Audio processing endpoints
  uploadAudio: async (formData) => {
    try {
      return await api.post('/api/upload-audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch (error) {
      console.error('Failed to upload audio:', error);
      throw error;
    }
  },

  getResults: async (sessionId) => {
    try {
      return await api.get(`/api/results/${sessionId}`);
    } catch (error) {
      console.error(`Failed to get results for session ${sessionId}:`, error);
      throw error;
    }
  },

  getProcessingStatus: async (sessionId) => {
    try {
      return await api.get(`/api/processing-status/${sessionId}`);
    } catch (error) {
      console.error(`Failed to get status for session ${sessionId}:`, error);
      throw error;
    }
  },

  getQueueStatus: async () => {
    try {
      return await api.get('/api/queue/status');
    } catch (error) {
      console.error('Failed to get queue status:', error);
      throw error;
    }
  },

  // Get audio file URL for playback
  getAudioUrl: (sessionId) => {
    const token = getStoredAccessToken();
    return `${BASE_URL}/api/audio/${sessionId}${token ? `?token=${token}` : ''}`;
  },

  // Authentication endpoints
  auth: {
    getConfig: async () => {
      try {
        return await api.get('/auth/config');
      } catch (error) {
        console.error('Failed to get auth config:', error);
        throw error;
      }
    },
    
    login: async (credentials) => {
      try {
        const response = await api.post('/auth/login', credentials);
        
        if (response.data?.access_token) {
          setStoredAccessToken(response.data.access_token);
        }
        
        return response;
      } catch (error) {
        console.error('Login failed:', error);
        throw error;
      }
    },
    
    logout: async () => {
      try {
        setStoredAccessToken(null);
        return await api.post('/auth/logout');
      } catch (error) {
        console.error('Logout failed:', error);
        return { data: { message: 'Logged out locally' } };
      }
    },
  
    getCurrentUser: async () => {
      try {
        console.log('📡 Fetching current user from /auth/me...');
        const response = await api.get('/auth/me');
        console.log('✅ Current user data received:', response.data);
        return response;
      } catch (error) {
        console.error('❌ Failed to get current user:', error);
        throw error;
      }
    },
  
    getSessions: async () => {
      try {
        console.log('📡 Fetching user sessions...');
        return {
          data: {
            sessions: []
          }
        };
      } catch (error) {
        console.error('Failed to get sessions:', error);
        throw error;
      }
    },
  
    updateProfile: async (profileData) => {
      try {
        console.log('📡 Updating profile...', profileData);
        const response = await api.put('/auth/me', profileData);
        return response;
      } catch (error) {
        console.error('Failed to update profile:', error);
        throw error;
      }
    },
  
    revokeSession: async (sessionId) => {
      try {
        console.log('📡 Revoking session:', sessionId);
        return {
          data: { message: 'Session management not implemented' }
        };
      } catch (error) {
        console.error('Failed to revoke session:', error);
        throw error;
      }
    }
  },

  // Transcript history management endpoints
  transcripts: {
    // Get all transcripts with pagination and filters
    getAll: async (filters = {}) => {
      try {
        const params = {
          limit: filters.limit || 50,
          offset: filters.offset || 0,
        };
        
        if (filters.search) {
          params.search = filters.search;
        }
        
        console.log('📡 Fetching transcripts with filters:', params);
        return await api.get('/api/transcriptions/', { params });
      } catch (error) {
        console.error('Failed to get transcripts:', error);
        throw error;
      }
    },
    
    // Get specific transcript by session ID
    getById: async (sessionId) => {
      try {
        console.log(`📡 Fetching transcript: ${sessionId}`);
        return await api.get(`/api/transcriptions/${sessionId}`);
      } catch (error) {
        console.error(`Failed to get transcript ${sessionId}:`, error);
        throw error;
      }
    },
    
    // Update/edit transcript
    update: async (sessionId, editData) => {
      try {
        console.log(`💾 Updating transcript: ${sessionId}`, {
          segmentCount: editData.segments?.length || 0,
          speakerMappings: Object.keys(editData.speaker_mappings || {}).length
        });
        
        return await api.put(`/api/transcriptions/${sessionId}`, editData);
      } catch (error) {
        console.error(`Failed to update transcript ${sessionId}:`, error);
        throw error;
      }
    },
    
    // Rename audio file
    rename: async (sessionId, newFilename) => {
      try {
        console.log(`✏️ Renaming audio: ${sessionId} -> ${newFilename}`);
        return await api.patch(`/api/transcriptions/${sessionId}/rename`, {
          new_filename: newFilename
        });
      } catch (error) {
        console.error(`Failed to rename audio ${sessionId}:`, error);
        throw error;
      }
    },
    
    // Delete transcript (soft delete by default)
    delete: async (sessionId, hardDelete = false) => {
      try {
        console.log(`🗑️ Deleting transcript: ${sessionId} (hard: ${hardDelete})`);
        return await api.delete(`/api/transcriptions/${sessionId}`, {
          params: { hard_delete: hardDelete }
        });
      } catch (error) {
        console.error(`Failed to delete transcript ${sessionId}:`, error);
        throw error;
      }
    },
    
    // Search transcripts
    search: async (query, limit = 50) => {
      try {
        console.log(`🔍 Searching transcripts: "${query}"`);
        return await api.get('/api/transcriptions/search', {
          params: { q: query, limit }
        });
      } catch (error) {
        console.error('Failed to search transcripts:', error);
        throw error;
      }
    },
    
    // Get user statistics
    getStats: async () => {
      try {
        console.log('📊 Fetching transcript statistics...');
        return await api.get('/api/transcriptions/stats/overview');
      } catch (error) {
        console.error('Failed to get transcript stats:', error);
        throw error;
      }
    },
    
    // Restore deleted transcript
    restore: async (sessionId) => {
      try {
        console.log(`♻️ Restoring transcript: ${sessionId}`);
        return await api.post(`/api/transcriptions/${sessionId}/restore`);
      } catch (error) {
        console.error(`Failed to restore transcript ${sessionId}:`, error);
        throw error;
      }
    }
  },

  // Analysis results management
  analysis: {
    getResults: async (sessionId, promptKey = null) => {
      try {
        const url = promptKey 
          ? `/api/analysis/${sessionId}/${promptKey}`
          : `/api/analysis/${sessionId}`;
        return await api.get(url);
      } catch (error) {
        console.error('Failed to get analysis results:', error);
        throw error;
      }
    },
    
    saveResult: async (resultData) => {
      try {
        return await api.post('/api/analysis/save', resultData);
      } catch (error) {
        console.error('Failed to save analysis result:', error);
        throw error;
      }
    },
    
    export: async (sessionId, format = 'json') => {
      try {
        return await api.get(`/api/analysis/${sessionId}/export`, {
          params: { format },
          responseType: format === 'pdf' ? 'blob' : 'json'
        });
      } catch (error) {
        console.error('Failed to export analysis:', error);
        throw error;
      }
    }
  },

  // Prompt management
  prompts: {
    getAll: async () => {
      try {
        return await api.get('/api/prompts/');
      } catch (error) {
        console.error('Failed to get prompts:', error);
        throw error;
      }
    },
    
    // Get public prompts (alias for getAll for backward compatibility)
    getPublic: async () => {
      try {
        return await api.get('/api/prompts/');
      } catch (error) {
        console.error('Failed to get public prompts:', error);
        throw error;
      }
    },
    
    getById: async (promptKey) => {
      try {
        return await api.get(`/api/prompts/${promptKey}`);
      } catch (error) {
        console.error(`Failed to get prompt ${promptKey}:`, error);
        return null;
      }
    },
    
    create: async (promptData) => {
      try {
        return await api.post('/api/prompts/', promptData);
      } catch (error) {
        console.error('Failed to create prompt:', error);
        throw error;
      }
    },
    
    update: async (promptKey, promptData) => {
      try {
        return await api.put(`/api/prompts/${promptKey}`, promptData);
      } catch (error) {
        console.error(`Failed to update prompt ${promptKey}:`, error);
        throw error;
      }
    },
    
    delete: async (promptKey) => {
      try {
        return await api.delete(`/api/prompts/${promptKey}`);
      } catch (error) {
        console.error(`Failed to delete prompt ${promptKey}:`, error);
        throw error;
      }
    },
    
    toggleFavorite: async (promptKey) => {
      try {
        return await api.post(`/api/prompts/${promptKey}/favorite`);
      } catch (error) {
        console.error(`Failed to toggle favorite for ${promptKey}:`, error);
        return null;
      }
    },
    
    getUserFavorites: async () => {
      try {
        return await api.get('/api/prompts/favorites');
      } catch (error) {
        console.error('Failed to get user favorites:', error);
        return null;
      }
    },
    
    getAnalytics: async () => {
      try {
        return await api.get('/api/prompts/analytics/usage');
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        return {
          data: {
            overview: {
              total_prompts: 0,
              active_prompts: 0,
              total_usage: 0,
              average_usage: 0
            },
            categories: {},
            top_prompts: []
          }
        };
      }
    }
  },

  // LLM processing
  llm: {
    getModels: async () => {
      try {
        return await api.get('/api/llm/models');
      } catch (error) {
        console.error('Failed to get LLM models:', error);
        throw error;
      }
    },
    
    getTemplates: async () => {
      try {
        return await api.get('/llm/templates');
      } catch (error) {
        console.error('Failed to get processing templates:', error);
        throw error;
      }
    },
    
    processText: async (processingData) => {
      try {
        return await api.post('/llm/process', processingData);
      } catch (error) {
        console.error('Failed to process text:', error);
        throw error;
      }
    }
  },

  // Health check
  health: async () => {
    try {
      return await api.get('/health');
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  healthCheck: async () => {
    try {
      return await api.get('/health');
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  // Utility methods for direct API access
  get: (url, config) => api.get(url, config),
  post: (url, data, config) => api.post(url, data, config),
  put: (url, data, config) => api.put(url, data, config),
  delete: (url, config) => api.delete(url, config),
  patch: (url, data, config) => api.patch(url, data, config),
};

// Set auth token helper
backendApi.setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setStoredAccessToken(token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    setStoredAccessToken(null);
  }
};

// Initialize with stored token if available
const storedToken = getStoredAccessToken();
if (storedToken) {
  backendApi.setAuthToken(storedToken);
}

// ✅ NEW: Make backendApi globally accessible for auth context
if (typeof window !== 'undefined') {
  window.backendApi = backendApi;
}

export default backendApi;
export { backendApi };