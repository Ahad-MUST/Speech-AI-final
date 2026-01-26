import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, XCircle, Loader2, Eye, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { backendApi } from '../../services/api';
import useAppStore from '../../stores/appStore';

const QueueStatusDisplay = () => {
  const navigate = useNavigate();
  
  // Get queue session from store
  const currentQueueSession = useAppStore((state) => state.currentQueueSession);
  const clearQueueSession = useAppStore((state) => state.clearQueueSession);
  
  const [localStatus, setLocalStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  // Calculate estimated wait time (simple calculation)
  const getEstimatedWaitTime = (position) => {
    if (position <= 1) return "Starting soon";
    const avgProcessingTime = 12; // seconds per file
    const totalWaitSeconds = (position - 1) * avgProcessingTime;
    const minutes = Math.ceil(totalWaitSeconds / 60);
    return `~${minutes} min wait`;
  };

  // Poll for status updates
  useEffect(() => {
    if (!currentQueueSession?.sessionId) return;
  
    let intervalId = null;
  
    const pollStatus = async () => {
      try {
        const response = await backendApi.get(`/api/processing-status/${currentQueueSession.sessionId}`);
        const status = response.data;
        setLocalStatus(status);
  
        // Update the store with new status
        if (status.status !== currentQueueSession.status || status.queue_position !== currentQueueSession.queuePosition) {
          useAppStore.getState().setCurrentQueueSession({
            ...currentQueueSession,
            status: status.status,
            queuePosition: status.queue_position || 0,
            progress: status.progress || 0,
            message: status.message
          });
        }
  
        // Stop polling if completed or failed
        if (status.status === 'completed' || status.status === 'failed') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          return;
        }
  
      } catch (error) {
        console.error('Error polling status:', error);
      }
    };
  
    // Start polling
    pollStatus(); // Initial call
    intervalId = setInterval(pollStatus, 3000); // Poll every 3 seconds
  
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentQueueSession?.sessionId]);

  // MOVED: Check after all hooks are defined
  if (!currentQueueSession) return null;

  const status = localStatus || currentQueueSession;
  const { fileName, queuePosition } = currentQueueSession;

  // Handle dismiss
  const handleDismiss = () => {
    clearQueueSession();
  };

  // Handle view results
  const handleViewResults = () => {
    navigate(`/results?session=${currentQueueSession.sessionId}`);
  };

  // Render different states
  const renderContent = () => {
    switch (status.status) {
      case 'queued':
        return (
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <Clock className="w-8 h-8 text-psycon-teal animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Your Position in Queue: #{queuePosition}</h3>
              <p className="text-sm text-gray-600">{fileName}</p>
              <p className="text-xs text-psycon-teal">{getEstimatedWaitTime(queuePosition)}</p>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );

      case 'processing':
        return (
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <Loader2 className="w-8 h-8 text-psycon-teal animate-spin" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Processing your audio...</h3>
              <p className="text-sm text-gray-600">{fileName}</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-gradient-to-r from-psycon-teal to-psycon-mint h-2 rounded-full transition-all duration-300"
                  style={{ width: `${status.progress || 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{status.message}</p>
            </div>
          </div>
        );

      case 'completed':
        return (
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Processing Complete!</h3>
              <p className="text-sm text-gray-600">{fileName}</p>
              <p className="text-xs text-green-600">Your transcript is ready</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleViewResults}
                className="flex items-center space-x-1 px-3 py-1 bg-psycon-teal text-white rounded-lg hover:bg-psycon-teal/90 transition-colors text-sm"
              >
                <Eye className="w-4 h-4" />
                <span>View Results</span>
              </button>
              <button
                onClick={handleDismiss}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'failed':
        return (
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Processing Failed</h3>
              <p className="text-sm text-gray-600">{fileName}</p>
              <p className="text-xs text-red-600">{status.message || 'Please try uploading again'}</p>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mb-6"
      >
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-psycon-mint/30 p-4">
          {renderContent()}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default QueueStatusDisplay;