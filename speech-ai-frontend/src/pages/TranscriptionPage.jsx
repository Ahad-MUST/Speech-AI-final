// src/pages/TranscriptionPage.jsx - UPDATED with Robust Audio Playback Integration
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FileAudio } from 'lucide-react';
import { useBackend } from '../contexts/BackendContext';
import { backendApi } from '../services/api';
import useAppStore from '../stores/appStore';
import toast from 'react-hot-toast';

// Import components
import TranscriptionPageHeader from '../Components/transcription/TranscriptionPageHeader';
import ProcessingStatusSection from '../Components/transcription/ProcessingStatusSection';
import TranscriptPanel from '../Components/transcription/TranscriptPanel';
import QueueStatusDisplay from '../Components/transcription/QueueStatusDisplay';
import AudioPlayer from '../Components/transcription/AudioPlayer';
import TranscriptionSidebar from '../Components/TranscriptionSidebar';

// ✅ UTILITY: Comprehensive results structure validation
const validateAndNormalizeResults = (fetchedData) => {
  if (!fetchedData) return null;

  let segments = null;
  let metadata = null;
  let normalizedResults = null;

  // Pattern 1: results.results.segments (expected)
  if (fetchedData.results?.segments) {
    segments = fetchedData.results.segments;
    metadata = fetchedData.results.metadata;
    normalizedResults = {
      results: {
        segments: segments,
        metadata: metadata || {},
        speaker_stats: fetchedData.results.speaker_stats || {}
      }
    };
  }
  // Pattern 2: results.segments (direct)
  else if (fetchedData.segments) {
    segments = fetchedData.segments;
    metadata = fetchedData.metadata;
    normalizedResults = {
      results: {
        segments: segments,
        metadata: metadata || {},
        speaker_stats: fetchedData.speaker_stats || {}
      }
    };
  }
  // Pattern 3: Direct array (segments only)
  else if (Array.isArray(fetchedData)) {
    segments = fetchedData;
    normalizedResults = {
      results: {
        segments: segments,
        metadata: {},
        speaker_stats: {}
      }
    };
  }
  // Pattern 4: Nested in result property
  else if (fetchedData.result?.segments) {
    segments = fetchedData.result.segments;
    metadata = fetchedData.result.metadata;
    normalizedResults = {
      results: {
        segments: segments,
        metadata: metadata || {},
        speaker_stats: fetchedData.result.speaker_stats || {}
      }
    };
  }

  return normalizedResults;
};

// ✅ MAIN COMPONENT
const TranscriptionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams();
  const { isConnected, updateSession } = useBackend();
  
  // Refs
  const editorRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const statusPollingRef = useRef(null);
  const initializedRef = useRef(false);
  const hasShownCompletionToast = useRef(false);
  const lastSessionIdRef = useRef(null);
  
  // Track current view state
  const [currentView, setCurrentView] = useState('original');
  
  // ✅ Audio player state - ENHANCED
  const [audioUrl, setAudioUrl] = useState(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(null);
  
  // ✅ Use Zustand store for persistent state
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const setCurrentSessionId = useAppStore((state) => state.setCurrentSessionId);
  const processingStatus = useAppStore((state) => state.processingStatus);
  const setProcessingStatus = useAppStore((state) => state.setProcessingStatus);
  const results = useAppStore((state) => state.results);
  const setResults = useAppStore((state) => state.setResults);
  const expandedTranscript = useAppStore((state) => state.expandedTranscript);
  const setExpandedTranscript = useAppStore((state) => state.setExpandedTranscript);
  const structures = useAppStore((state) => state.structures);
  const parameters = useAppStore((state) => state.parameters);
  
  // ✅ Transcript history state
  const selectTranscript = useAppStore((state) => state.selectTranscript);
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);

  // Handle view changes from TranscriptPanel
  const handleViewChange = useCallback((view) => {
    setCurrentView(view);
  }, []);

  // ✅ CRITICAL: Handle segment click to jump to timestamp
  const handleSegmentClick = useCallback((timestamp) => {
    console.log('🎯 Segment clicked - jumping to timestamp:', timestamp);
    
    if (!audioPlayerRef.current) {
      console.warn('⚠️ Audio player ref not available');
      toast.error('Audio player not ready');
      return;
    }
    
    // Check if audio player is ready
    const isReady = audioPlayerRef.current.isReady?.();
    
    if (!isReady) {
      console.warn('⚠️ Audio player not ready yet');
      toast.error('Audio is still loading, please wait');
      return;
    }
    
    // Seek to timestamp
    const seekSuccess = audioPlayerRef.current.seekTo(timestamp);
    
    if (seekSuccess) {
      // Start playing after seek
      setTimeout(() => {
        audioPlayerRef.current.play();
      }, 100);
      
      // Removed toast notification for successful jump
    } else {
      console.warn('⚠️ Seek operation failed');
      toast.error('Failed to jump to timestamp');
    }
  }, []);

  // ✅ CRITICAL: Load audio URL when session changes
  useEffect(() => {
    // Check if session changed
    if (currentSessionId !== lastSessionIdRef.current) {
      console.log('🔄 Session changed, updating audio:', {
        from: lastSessionIdRef.current,
        to: currentSessionId
      });
      
      // Reset audio state
      setAudioUrl(null);
      setIsAudioReady(false);
      setAudioError(null);
      
      lastSessionIdRef.current = currentSessionId;
    }
    
    // ✅ FIX: Only load audio URL if we have COMPLETED results
    // Don't try to load audio while still processing
    const hasValidResults = results && validateAndNormalizeResults(results);
    const isCompleted = processingStatus?.status === 'completed';
    
    if (currentSessionId && hasValidResults && isCompleted) {
      console.log('🎵 Loading audio URL for session:', currentSessionId);
      const url = backendApi.getAudioUrl(currentSessionId);
      setAudioUrl(url);
    } else {
      // Clear audio URL if not completed
      if (audioUrl && !isCompleted) {
        console.log('⏸️ Clearing audio URL - processing not completed');
        setAudioUrl(null);
        setIsAudioReady(false);
      }
    }
  }, [currentSessionId, results, processingStatus]);

  // ✅ Handle audio loaded
  const handleAudioLoaded = useCallback((duration) => {
    console.log('✅ Audio loaded successfully:', {
      duration,
      sessionId: currentSessionId
    });
    setIsAudioReady(true);
    setAudioError(null);
  }, [currentSessionId]);

  // ✅ Handle audio error
  const handleAudioError = useCallback((error) => {
    console.error('❌ Audio error:', error);
    setAudioError(error);
    setIsAudioReady(false);
  }, []);

  // ✅ Handle URL-based transcript loading
  useEffect(() => {
    if (urlSessionId && !location.state && urlSessionId !== currentSessionId) {
      console.log('📄 Loading transcript from URL:', urlSessionId);
      selectTranscript(urlSessionId).catch(error => {
        console.error('Failed to load transcript from URL:', error);
        toast.error('Failed to load transcript');
      });
    }
  }, [urlSessionId, location.state, currentSessionId, selectTranscript]);

  // ✅ Handle session initialization with refresh detection
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const stateData = location.state;
    
    // Check if we have results already (page refresh case)
    if (currentSessionId && results && !stateData) {
      console.log('🔄 Page refresh detected - session already completed');
      if (processingStatus?.status !== 'completed') {
        setProcessingStatus({
          status: 'completed',
          progress: 100,
          message: 'Processing completed successfully!'
        });
      }
      return;
    }

    // Handle new session from navigation
    if (stateData?.sessionId) {
      console.log('🆕 Receiving new session:', stateData.sessionId);
      
      hasShownCompletionToast.current = false;
      setCurrentSessionId(stateData.sessionId);
      
      const currentStatus = useAppStore.getState().processingStatus;
      if (!currentStatus || currentStatus.status !== 'processing' || 
          currentStatus.sessionId !== stateData.sessionId) {
        setProcessingStatus({ 
          status: 'processing', 
          progress: 5, 
          message: 'Starting audio processing...',
          fileInfo: stateData.fileInfo,
          sessionId: stateData.sessionId
        });
      }
    }
  }, [location.state, setCurrentSessionId, setProcessingStatus, currentSessionId, results, processingStatus]);

  // ✅ Start polling with single session logic
  useEffect(() => {
    const sessionToUse = currentSessionId;
    const hasValidResults = results && validateAndNormalizeResults(results);
    
    if (!sessionToUse || hasValidResults || processingStatus?.status === 'completed') {
      return;
    }

    console.log('🔁 Starting status polling for session:', sessionToUse);

    const pollStatus = async () => {
      try {
        const response = await backendApi.getResults(sessionToUse);
        
        if (response?.data) {
          const fetchedData = response.data;
          const normalizedData = validateAndNormalizeResults(fetchedData);
          
          if (normalizedData) {
            console.log('✅ Valid results found!');
            setResults(normalizedData);
            setProcessingStatus({
              status: 'completed',
              progress: 100,
              message: 'Processing completed successfully!'
            });

            if (statusPollingRef.current) {
              clearInterval(statusPollingRef.current);
              statusPollingRef.current = null;
            }

            if (!hasShownCompletionToast.current) {
              toast.success('Transcription completed!', { duration: 3000 });
              hasShownCompletionToast.current = true;
            }

            updateSession(sessionToUse, {
              status: 'completed',
              progress: 100
            });
          } else {
            setProcessingStatus(prev => ({
              ...prev,
              progress: Math.min((prev?.progress || 0) + 5, 95),
              message: 'Processing audio...'
            }));
          }
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    };

    pollStatus();
    statusPollingRef.current = setInterval(pollStatus, 3000);

    return () => {
      if (statusPollingRef.current) {
        clearInterval(statusPollingRef.current);
        statusPollingRef.current = null;
      }
    };
  }, [currentSessionId, results, processingStatus, setResults, setProcessingStatus, updateSession]);

  // ✅ Handle transcript selection from sidebar
  const handleTranscriptSelect = useCallback((sessionId) => {
    console.log('📄 Transcript selected from sidebar:', sessionId);
    navigate(`/results/${sessionId}`);
  }, [navigate]);

  // Render
  const hasResults = results && validateAndNormalizeResults(results);

  return (
    <div className="flex h-screen bg-gradient-to-br from-psycon-light-teal/20 via-white to-psycon-lavender/30">
      {/* ✅ Transcript History Sidebar */}
      <TranscriptionSidebar 
        onSelectTranscript={handleTranscriptSelect}
      />
      
      {/* ✅ Main Content */}
      <div className={`flex-1 overflow-auto transition-all duration-300 ${isSidebarOpen ? 'ml-0' : 'ml-0'}`}>
        <div className="p-6 max-w-6xl mx-auto">
          
          {/* Queue Status Display */}
          <QueueStatusDisplay />
          
          {/* Page Header */}
          <TranscriptionPageHeader 
            results={results}
            currentView={currentView}
            editorRef={editorRef}
            currentSessionId={currentSessionId}
          />

          {/* Processing Status Section */}
          {(!hasResults || processingStatus?.status === 'processing') && (
            <ProcessingStatusSection 
              processingStatus={processingStatus}
              currentSessionId={currentSessionId}
            />
          )}

          {/* Transcript Panel */}
          {hasResults && (
            <TranscriptPanel
              results={results}
              currentView={currentView}
              onViewChange={handleViewChange}
              editorRef={editorRef}
              onSegmentClick={handleSegmentClick}
            />
          )}

          {/* No Results Message */}
          {!hasResults && processingStatus?.status !== 'processing' && !currentSessionId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-12 text-center"
            >
              <FileAudio className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Transcript Selected</h3>
              <p className="text-gray-500 mb-6">
                Upload an audio file or select a transcript from the sidebar to get started.
              </p>
            </motion.div>
          )}
          
          {/* ✅ Spacer for fixed audio player */}
          {audioUrl && hasResults && <div className="h-24" />}
        </div>
      </div>

      {/* ✅ CRITICAL: Audio Player - Fixed at bottom with proper session tracking */}
      {audioUrl && hasResults && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <AudioPlayer
            ref={audioPlayerRef}
            audioUrl={audioUrl}
            sessionId={currentSessionId}
            onLoadedMetadata={handleAudioLoaded}
            onTimeUpdate={(time) => {
              // Optional: Could update UI to show current segment
            }}
            onError={handleAudioError}
          />
        </div>
      )}
    </div>
  );
};

export default TranscriptionPage;