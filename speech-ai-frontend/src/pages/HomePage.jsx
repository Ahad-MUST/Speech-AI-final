// src/pages/HomePage.jsx - UPDATED with Clear Button instead of Upload New Audio
import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../contexts/BackendContext';
import { backendApi } from '../services/api';
import useAppStore from '../stores/appStore';
import toast from 'react-hot-toast';
import { Upload, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

// Import all the extracted components
import PageHeader from '../Components/home/PageHeader';
import ProcessingBanner from '../Components/home/ProcessingBanner';
import AudioUploader from '../Components/home/AudioUploader';
import AudioVisualizationSection from '../Components/home/AudioVisualizationSection';


const HomePage = () => {
  const navigate = useNavigate();
  const { 
    isConnected, 
    addSession, 
    registerNavigationCallback, 
    getProcessingSessions 
  } = useBackend();
  
  // Zustand store state - EXISTING
  const selectedFile = useAppStore((state) => state.selectedFile);
  const setSelectedFile = useAppStore((state) => state.setSelectedFile);
  const isProcessing = useAppStore((state) => state.isProcessing);
  const setIsProcessing = useAppStore((state) => state.setIsProcessing);
  const currentSession = useAppStore((state) => state.currentSession);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const speakers = useAppStore((state) => state.speakers);
  const setSpeakers = useAppStore((state) => state.setSpeakers);
  const structures = useAppStore((state) => state.structures);
  const parameters = useAppStore((state) => state.parameters);
  
  // Processing state for display - EXISTING
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const processingStatus = useAppStore((state) => state.processingStatus);
  const setProcessingStatus = useAppStore((state) => state.setProcessingStatus);

  // ✅ Multi-file upload state
  const uploadQueue = useAppStore((state) => state.uploadQueue);
  const addToUploadQueue = useAppStore((state) => state.addToUploadQueue);
  const updateUploadQueueItem = useAppStore((state) => state.updateUploadQueueItem);
  const clearUploadQueue = useAppStore((state) => state.clearUploadQueue);
  const isUploadingMultiple = useAppStore((state) => state.isUploadingMultiple);
  const setIsUploadingMultiple = useAppStore((state) => state.setIsUploadingMultiple);
  const addToTranscriptHistory = useAppStore((state) => state.addToTranscriptHistory);

  const processingSessions = getProcessingSessions();

  // EXISTING: Handle single file upload
  const handleFileUpload = useCallback((file) => {
    setSelectedFile(file);
  }, [setSelectedFile]);

  // ✅ NEW: Handle clear/reset everything
  const handleClearFile = useCallback(() => {
    console.log('🗑️ Clearing selected file and resetting state...');
    
    // Clear selected file
    setSelectedFile(null);
    
    // Reset processing state
    setIsProcessing(false);
    setCurrentSession(null);
    useAppStore.getState().setCurrentSessionId(null);
    setProcessingStatus(null);
    
    // Clear queue session
    const { clearQueueSession } = useAppStore.getState();
    clearQueueSession();
    
    // Optional: Reset language and speakers to defaults
    // setLanguage('');
    // setSpeakers('');
    
    toast.success('Cleared! Ready for new upload');
  }, [setSelectedFile, setIsProcessing, setCurrentSession, setProcessingStatus]);

  // ✅ Handle multiple file selection
  const handleMultipleFiles = useCallback(async (files) => {
    const fileArray = Array.from(files);
    
    if (fileArray.length === 0) {
      return;
    }
    
    // If single file, use existing single file logic
    if (fileArray.length === 1) {
      handleFileUpload(fileArray[0]);
      return;
    }
    
    // Multi-file logic
    console.log(`📁 Uploading ${fileArray.length} files...`);
    
    // Add files to queue
    addToUploadQueue(fileArray);
    setIsUploadingMultiple(true);
    
    const enabledStructures = structures.filter(s => s.enabled).map(s => s.name);
    const enabledParameters = parameters.filter(p => p.enabled).map(p => p.name);
    
    // Upload each file sequentially
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      console.log(`📤 Processing file ${i + 1}/${fileArray.length}: ${file.name}`);
      
      try {
        updateUploadQueueItem(i, { status: 'uploading', progress: 10 });
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('language', language);
        formData.append('apply_preprocessing', 'true');
        formData.append('num_speakers', speakers);
        formData.append('structures', JSON.stringify(enabledStructures));
        formData.append('parameters', JSON.stringify(enabledParameters));
        
        const response = await backendApi.uploadAudio(formData);
        const uploadResult = response.data;
        const sessionId = uploadResult.session_id;
        
        updateUploadQueueItem(i, { 
          status: 'processing',
          sessionId: sessionId,
          progress: 100
        });
        
        console.log(`✅ File ${i + 1} uploaded successfully: ${sessionId}`);
        
        // Add to transcript history when complete (will happen via backend)
        // The backend will automatically save to database after processing
        
      } catch (error) {
        console.error(`❌ File ${i + 1} failed:`, error);
        updateUploadQueueItem(i, { 
          status: 'failed',
          error: error.message || 'Upload failed',
          progress: 0
        });
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    setIsUploadingMultiple(false);
    toast.success(`${fileArray.length} files uploaded! Check transcript history.`, { duration: 4000 });
    
    // Navigate to results page to see the sidebar with all transcripts
    navigate('/results');
    
  }, [
    language, 
    speakers, 
    structures, 
    parameters, 
    addToUploadQueue, 
    updateUploadQueueItem, 
    setIsUploadingMultiple, 
    navigate,
    handleFileUpload,
    addToTranscriptHistory
  ]);

  // EXISTING: Handle start processing (single file)
  const handleStartProcessing = useCallback(async () => {
    if (!selectedFile || !isConnected) {
      toast.error('Please select a file and ensure backend is connected');
      return;
    }
  
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('language', language);
      formData.append('apply_preprocessing', 'true');
      formData.append('num_speakers', speakers);
      
      const enabledStructures = structures.filter(s => s.enabled).map(s => s.name);
      const enabledParameters = parameters.filter(p => p.enabled).map(p => p.name);
      
      formData.append('structures', JSON.stringify(enabledStructures));
      formData.append('parameters', JSON.stringify(enabledParameters));
  
      setIsProcessing(true);
      toast.loading('Starting transcription...', { id: 'upload' });
  
      // Wait for backend response first, then navigate
      const response = await backendApi.uploadAudio(formData);
      const uploadResult = response.data;
      const realSessionId = uploadResult.session_id;
  
      // Set up processing status with real session ID
      setCurrentSession(realSessionId);
      useAppStore.getState().setCurrentSessionId(realSessionId);
  
      // Initialize queue session with real session ID
      const { setCurrentQueueSession } = useAppStore.getState();
      setCurrentQueueSession({
        sessionId: realSessionId,
        fileName: selectedFile.name,
        status: uploadResult.status,
        queuePosition: uploadResult.queue_position || 0,
        message: uploadResult.message || 'Processing started'
      });
      
      // Initialize processing status with real session ID
      setProcessingStatus({ 
        status: uploadResult.status || 'processing', 
        progress: 10, 
        message: uploadResult.message || 'Processing started...',
        sessionId: realSessionId,
        fileInfo: {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type
        }
      });
  
      // Add session to backend context
      addSession(realSessionId, {
        status: uploadResult.status || 'processing',
        progress: 10,
        structures: enabledStructures,
        parameters: enabledParameters,
        filename: selectedFile.name,
        startTime: new Date()
      });
  
      // Register navigation callback
      registerNavigationCallback(realSessionId, (completedSessionId) => {
        console.log('Processing completed for session:', completedSessionId);
      });
  
      // Navigate AFTER getting real session ID
      navigate('/results', {
        state: {
          sessionId: realSessionId,
          structures: enabledStructures,
          parameters: enabledParameters,
          fromUpload: true,
          fileInfo: {
            name: selectedFile.name,
            size: selectedFile.size,
            type: selectedFile.type
          }
        }
      });
  
      toast.success('Upload successful! Processing in progress...', { 
        id: 'upload',
        duration: 3000 
      });
  
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.userMessage || 'Upload failed', { id: 'upload' });
      
      setProcessingStatus({
        status: 'failed',
        message: error.userMessage || 'Upload failed'
      });
  
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, isConnected, language, speakers, structures, parameters, addSession, registerNavigationCallback, navigate, setIsProcessing, setCurrentSession, setProcessingStatus]);

  // EXISTING: Handle view session
  const handleViewSession = useCallback((sessionId) => {
    const sessionData = processingSessions.find(s => s.sessionId === sessionId);
    if (sessionData) {
      navigate('/results', { 
        state: { 
          sessionId,
          structures: sessionData.structures,
          parameters: sessionData.parameters 
        } 
      });
    }
  }, [processingSessions, navigate]);

  // Determine if processing is possible
  const canProcess = selectedFile && !isProcessing && !isUploadingMultiple;

  return (
    <div className="min-h-screen bg-gradient-to-br from-psycon-light-teal/20 via-white to-psycon-lavender/30 overflow-auto">
      <div className="p-6 max-w-5xl mx-auto">
        
        {/* Page Header with Title */}
        <PageHeader />
  
        {/* Processing Banner - Shows active sessions */}
        <ProcessingBanner 
          processingSessions={processingSessions}
          onViewSession={handleViewSession}
        />

        {/* ✅ NEW: Multi-Upload Queue Display */}
        {uploadQueue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-psycon-mint/30 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-psycon-mint" />
                Upload Queue ({uploadQueue.length} files)
              </h3>
              <button
                onClick={clearUploadQueue}
                disabled={isUploadingMultiple}
                className="text-sm text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                Clear All
              </button>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <AnimatePresence>
                {uploadQueue.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`p-3 rounded-lg border ${
                      item.status === 'completed' ? 'bg-green-50 border-green-200' :
                      item.status === 'failed' ? 'bg-red-50 border-red-200' :
                      item.status === 'uploading' ? 'bg-blue-50 border-blue-200' :
                      item.status === 'processing' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                        {item.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                        {(item.status === 'uploading' || item.status === 'processing') && (
                          <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.filename}
                          </p>
                          <p className="text-xs text-gray-600">
                            {item.status === 'pending' && 'Waiting...'}
                            {item.status === 'uploading' && 'Uploading...'}
                            {item.status === 'processing' && 'Processing...'}
                            {item.status === 'completed' && 'Completed'}
                            {item.status === 'failed' && `Failed: ${item.error || 'Unknown error'}`}
                          </p>
                        </div>
                      </div>
                      
                      {item.progress > 0 && item.progress < 100 && (
                        <div className="ml-3 flex-shrink-0">
                          <span className="text-xs font-medium text-gray-600">{item.progress}%</span>
                        </div>
                      )}
                    </div>
                    
                    {item.status === 'uploading' && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
  
        {/* Main Content */}
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Audio Uploader Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-psycon-mint/30 p-6 text-gray-800"
          >
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Audio Upload</h2>
              <p className="text-gray-600">Upload one or multiple audio files to begin analysis</p>
            </div>
            {/* ✅ UPDATED: Pass clear handler and remove upload new button */}
            <AudioUploader 
              onFileUpload={handleFileUpload}
              onMultipleFiles={handleMultipleFiles}
              onClearFile={handleClearFile}
              selectedFile={selectedFile}
              isProcessing={isProcessing || isUploadingMultiple}
              currentSessionId={currentSessionId}
              processingStatus={processingStatus}
            />
          </motion.div>
          
          {/* Processing Settings Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-psycon-purple/30 p-6 text-gray-800"
          >
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Processing Settings</h2>
              <p className="text-gray-600">Configure language and speaker detection</p>
            </div>
            <AudioVisualizationSection 
              isProcessing={isProcessing || isUploadingMultiple}
              language={language}
              setLanguage={setLanguage}
              speakers={speakers}
              setSpeakers={setSpeakers}
              handleStartProcessing={handleStartProcessing}
              canProcess={canProcess}
            />
          </motion.div>
          
        </div>
      </div>
    </div>
  );
};

export default HomePage;