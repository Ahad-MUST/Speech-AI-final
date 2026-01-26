// BackendContext.jsx - Fixed Backend Context Provider - FIXED activeSessions data structure
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { backendApi } from '../services/api';
import toast from 'react-hot-toast';

// Create context
const BackendContext = createContext();

// Backend provider component
export const BackendProvider = ({ children }) => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState(null);
  const [lastHealthCheck, setLastHealthCheck] = useState(null);
  const [isLLMAvailable, setIsLLMAvailable] = useState(false);
  
  // ✅ CRITICAL FIX: Session management - Use Map instead of array to fix .has() error
  const [activeSessions, setActiveSessions] = useState(new Map());
  
  // Navigation callback
  const navigationCallback = useRef(null);
  const healthCheckInterval = useRef(null);

  // Health check function
  const performHealthCheck = async () => {
    try {
      const response = await backendApi.health();
      const healthData = response.data;
      
      setIsConnected(true);
      setSystemInfo(healthData);
      setLastHealthCheck(new Date());
      setIsLLMAvailable(healthData.llm?.available || false);
      
      console.log('✅ Backend connection established');
      return healthData;
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
      setIsConnected(false);
      setSystemInfo(null);
      setIsLLMAvailable(false);
      throw error;
    }
  };

  // Initialize connection on mount
  useEffect(() => {
    const initializeConnection = async () => {
      setIsLoading(true);
      try {
        await performHealthCheck();
        toast.success('Connected to backend server');
      } catch (error) {
        console.error('Failed to connect to backend:', error);
        if (error.isNetworkError) {
          toast.error('Backend server not reachable. Please start the server on port 8888.');
        } else {
          toast.error('Failed to connect to backend server');
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeConnection();
  }, []);

  // Set up periodic health checks
  useEffect(() => {
    if (isConnected && !healthCheckInterval.current) {
      healthCheckInterval.current = setInterval(async () => {
        try {
          await performHealthCheck();
        } catch (error) {
          // Error handling is done in performHealthCheck
        }
      }, 30000); // Check every 30 seconds
    }

    return () => {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current);
        healthCheckInterval.current = null;
      }
    };
  }, [isConnected]);

  // ✅ FIXED: Session management with Map data structure
  const addSession = (sessionData) => {
    setActiveSessions(prev => {
      const newMap = new Map(prev);
      newMap.set(sessionData.id, sessionData);
      return newMap;
    });
    toast.success('New processing session started');
  };

  const updateSession = (sessionId, updates) => {
    setActiveSessions(prev => {
      const newMap = new Map(prev);
      const existingSession = newMap.get(sessionId);
      if (existingSession) {
        newMap.set(sessionId, { ...existingSession, ...updates });
      } else {
        // Create new session if it doesn't exist
        newMap.set(sessionId, { id: sessionId, ...updates });
      }
      return newMap;
    });
  };

  const removeSession = (sessionId) => {
    setActiveSessions(prev => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
  };

  const getProcessingSessions = () => {
    return Array.from(activeSessions.values()).filter(session => session.status === 'processing');
  };

  // ✅ ADDED: Helper function to get session data
  const getSession = (sessionId) => {
    return activeSessions.get(sessionId);
  };

  // ✅ ADDED: Helper function to check if session exists
  const hasSession = (sessionId) => {
    return activeSessions.has(sessionId);
  };

  // Navigation callback registration
  const registerNavigationCallback = (callback) => {
    navigationCallback.current = callback;
  };

  const navigateToResults = (sessionId) => {
    if (navigationCallback.current) {
      navigationCallback.current(`/results?session=${sessionId}`);
    }
  };

  // Manual refresh
  const refreshConnection = async () => {
    setIsLoading(true);
    try {
      await performHealthCheck();
      toast.success('Connection refreshed');
    } catch (error) {
      toast.error('Failed to refresh connection');
    } finally {
      setIsLoading(false);
    }
  };

  // API methods with error handling
  const uploadAudio = async (formData, onProgress) => {
    try {
      // Check if the method exists in our API service
      if (typeof backendApi.uploadAudio === 'function') {
        const response = await backendApi.uploadAudio(formData, onProgress);
        return response.data;
      } else {
        // Fallback to direct API call
        const response = await backendApi.post('/api/upload-audio', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: onProgress
        });
        return response.data;
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.userMessage || 'Upload failed');
      throw error;
    }
  };

  const processWithLLM = async (requestData) => {
    try {
      // Check if the method exists in our API service
      if (typeof backendApi.llm?.processText === 'function') {
        const response = await backendApi.llm.processText(requestData);
        return response.data;
      } else if (typeof backendApi.processWithLLM === 'function') {
        const response = await backendApi.processWithLLM(requestData);
        return response.data;
      } else {
        // Fallback to direct API call
        const response = await backendApi.post('/api/process-llm', requestData);
        return response.data;
      }
    } catch (error) {
      console.error('LLM processing failed:', error);
      toast.error(error.userMessage || 'LLM processing failed');
      throw error;
    }
  };

  // ✅ FIXED: Processing status function with correct endpoint
  const getProcessingStatus = async (sessionId) => {
    try {
      // ✅ Use the correct endpoint that matches the backend API
      const response = await backendApi.get(`/api/processing-status/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Status check failed:', error);
      // Don't show toast for status checks as they happen frequently
      throw error;
    }
  };

  const downloadFile = async (sessionId, filename) => {
    try {
      // Check if the method exists in our API service
      if (typeof backendApi.downloadFile === 'function') {
        const response = await backendApi.downloadFile(sessionId, filename);
        return response;
      } else {
        // Fallback to direct API call
        const response = await backendApi.get(`/api/download/${sessionId}/${filename}`, {
          responseType: 'blob'
        });
        return response;
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(error.userMessage || 'Download failed');
      throw error;
    }
  };

  // Get transcripts
  const getTranscripts = async (filters = {}) => {
    try {
      if (typeof backendApi.transcripts?.getAll === 'function') {
        const response = await backendApi.transcripts.getAll(filters);
        return response.data;
      } else {
        // Fallback to direct API call
        const response = await backendApi.get('/api/transcripts', { params: filters });
        return response.data;
      }
    } catch (error) {
      console.error('Failed to get transcripts:', error);
      toast.error(error.userMessage || 'Failed to get transcripts');
      throw error;
    }
  };

  // Get LLM models
  const getLLMModels = async () => {
    try {
      if (typeof backendApi.llm?.getModels === 'function') {
        const response = await backendApi.llm.getModels();
        return response.data;
      } else {
        // Fallback to direct API call
        const response = await backendApi.get('/api/llm/models');
        return response.data;
      }
    } catch (error) {
      console.error('Failed to get LLM models:', error);
      toast.error(error.userMessage || 'Failed to get LLM models');
      throw error;
    }
  };

  // Get processing templates
  const getProcessingTemplates = async () => {
    try {
      if (typeof backendApi.llm?.getTemplates === 'function') {
        const response = await backendApi.llm.getTemplates();
        return response.data;
      } else {
        // Fallback to direct API call
        const response = await backendApi.get('/api/llm/templates');
        return response.data;
      }
    } catch (error) {
      console.error('Failed to get processing templates:', error);
      toast.error(error.userMessage || 'Failed to get processing templates');
      throw error;
    }
  };

  // Context value
  const contextValue = {
    // Connection state
    isConnected,
    isLoading,
    systemInfo,
    lastHealthCheck,
    isLLMAvailable,
    
    // Session management - ✅ FIXED: Provide both Map and helper functions
    activeSessions,
    addSession,
    updateSession,
    removeSession,
    getProcessingSessions,
    getSession,
    hasSession,
    
    // Navigation
    registerNavigationCallback,
    navigateToResults,
    
    // API methods
    uploadAudio,
    processWithLLM,
    getProcessingStatus,
    downloadFile,
    getTranscripts,
    getLLMModels,
    getProcessingTemplates,
    
    // Utility methods
    refreshConnection,
    performHealthCheck,
    
    // Backend API access for components that need it
    api: backendApi
  };

  return (
    <BackendContext.Provider value={contextValue}>
      {children}
    </BackendContext.Provider>
  );
};

export const useBackend = () => {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error('useBackend must be used within a BackendProvider');
  }
  return context;
};

export default BackendContext;