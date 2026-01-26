// src/stores/appStore.js - Enhanced Zustand store with transcript history support
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { backendApi } from '../services/api';

const useAppStore = create(
  persist(
    (set, get) => ({
      // ============================================
      // EXISTING STATE - Audio Processing
      // ============================================
      selectedFile: null,
      isProcessing: false,
      currentSession: null,
      currentSessionId: null,
      results: null,
      processingStatus: null,
      expandedTranscript: false,
      language: '',
      speakers: '',
      
      // Queue management
      currentQueueSession: null,
      
      // Structures and parameters
      structures: [
        { name: 'Speaker Diarization', enabled: true },
        { name: 'Timestamps', enabled: true },
        { name: 'Paragraph Segmentation', enabled: false },
      ],
      parameters: [
        { name: 'Word-Level Timestamps', enabled: false },
        { name: 'Confidence Scores', enabled: false },
        { name: 'Language Detection', enabled: true },
      ],

      // ============================================
      // EXISTING STATE - Analysis
      // ============================================
      analysisResults: {},
      analysisProgress: {},
      customPrompt: '',
      
      // User favorites for prompts
      userFavorites: [],
      showFavoritesOnly: false,

      // ============================================
      // EXISTING STATE - Chat
      // ============================================
      chatMessages: [],
      selectedChatSession: null,
      contextType: 'none',
      isLoading: false,

      // ============================================
      // ✅ NEW STATE - Transcript History
      // ============================================
      transcriptHistory: [],
      selectedTranscriptId: null,
      selectedTranscript: null,
      transcriptStats: null,
      isLoadingHistory: false,
      isSidebarOpen: true,
      historySearchQuery: '',
      historySortBy: 'date', // 'date', 'duration', 'filename'

      // ✅ NEW STATE - Multi-file upload
      uploadQueue: [], // Array of { file, sessionId, status, progress }
      isUploadingMultiple: false,

      // ============================================
      // EXISTING ACTIONS - Audio Processing
      // ============================================
      setSelectedFile: (file) => set({ selectedFile: file }),
      setIsProcessing: (processing) => set({ isProcessing: processing }),
      setCurrentSession: (session) => set({ currentSession: session }),
      setCurrentSessionId: (id) => set({ currentSessionId: id }),
      setResults: (results) => set({ results }),
      setProcessingStatus: (status) => set({ processingStatus: status }),
      setExpandedTranscript: (expanded) => set({ expandedTranscript: expanded }),
      setLanguage: (language) => set({ language }),
      setSpeakers: (speakers) => set({ speakers }),
      
      // Queue session management
      setCurrentQueueSession: (queueSession) => set({ currentQueueSession: queueSession }),
      clearQueueSession: () => set({ currentQueueSession: null }),
      
      updateStructures: (structures) => set({ structures }),
      updateParameters: (parameters) => set({ parameters }),
      
      // Clear processing state
      clearProcessing: () => set({
        selectedFile: null,
        isProcessing: false,
        currentSession: null,
        processingStatus: null,
      }),

      // ============================================
      // EXISTING ACTIONS - Analysis
      // ============================================
      setAnalysisResults: (results) => set({ analysisResults: results }),
      setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
      setCustomPrompt: (prompt) => set({ customPrompt: prompt }),
      
      clearAnalysisResults: () => set({ 
        analysisResults: {}, 
        analysisProgress: {} 
      }),
      
      updateAnalysisResult: (promptKey, result) => set((state) => ({
        analysisResults: {
          ...state.analysisResults,
          [promptKey]: result
        }
      })),
      
      updateAnalysisProgress: (promptKey, progress) => set((state) => ({
        analysisProgress: {
          ...state.analysisProgress,
          [promptKey]: progress
        }
      })),
      
      // User favorites
      setShowFavoritesOnly: (show) => set({ showFavoritesOnly: show }),
      
      loadUserFavorites: async () => {
        try {
          const response = await backendApi.prompts.getUserFavorites();
          if (response?.data?.favorites) {
            set({ userFavorites: response.data.favorites });
          }
        } catch (error) {
          console.error('Failed to load user favorites:', error);
        }
      },
      
      toggleFavorite: async (promptKey) => {
        try {
          await backendApi.prompts.toggleFavorite(promptKey);
          
          // Update local state
          const currentFavorites = get().userFavorites;
          if (currentFavorites.includes(promptKey)) {
            set({ userFavorites: currentFavorites.filter(key => key !== promptKey) });
          } else {
            set({ userFavorites: [...currentFavorites, promptKey] });
          }
        } catch (error) {
          console.error('Failed to toggle favorite:', error);
        }
      },

      // ============================================
      // EXISTING ACTIONS - Chat
      // ============================================
      setChatMessages: (messages) => set({ chatMessages: messages }),
      addChatMessage: (message) => set((state) => ({
        chatMessages: [...state.chatMessages, message]
      })),
      clearChatMessages: () => set({ chatMessages: [] }),
      setSelectedChatSession: (session) => set({ selectedChatSession: session }),
      setContextType: (type) => set({ contextType: type }),
      setChatLoading: (loading) => set({ isLoading: loading }),

      // ============================================
      // ✅ NEW ACTIONS - Transcript History
      // ============================================
      
      /**
       * Load all transcripts for the current user
       * @param {Object} filters - Optional filters { limit, offset, search }
       */
      loadTranscriptHistory: async (filters = {}) => {
        set({ isLoadingHistory: true });
        try {
          console.log('📚 Loading transcript history...');
          const response = await backendApi.transcripts.getAll(filters);
          const transcripts = response.data || [];
          
          set({ 
            transcriptHistory: transcripts,
            isLoadingHistory: false 
          });
          
          console.log(`✅ Loaded ${transcripts.length} transcripts`);
          return transcripts;
        } catch (error) {
          console.error('❌ Failed to load transcript history:', error);
          set({ 
            transcriptHistory: [],
            isLoadingHistory: false 
          });
          throw error;
        }
      },
      
      /**
       * Select and load a specific transcript
       * @param {String} sessionId - The session ID of the transcript to load
       */
      selectTranscript: async (sessionId) => {
        if (!sessionId) {
          set({ 
            selectedTranscriptId: null, 
            selectedTranscript: null,
            results: null,
            currentSessionId: null
          });
          return;
        }
        
        try {
          console.log(`📄 Loading transcript: ${sessionId}`);
          set({ selectedTranscriptId: sessionId });
          
          const response = await backendApi.transcripts.getById(sessionId);
          const transcript = response.data;
          
          // Transform transcript data to match expected results format
          const transformedResults = {
            results: {
              segments: transcript.segments || [],
              metadata: transcript.metadata || {},
              speaker_stats: transcript.speaker_stats || {}
            }
          };
          
          set({ 
            selectedTranscript: transcript,
            selectedTranscriptId: sessionId,
            // Update results for backward compatibility with existing components
            results: transformedResults,
            currentSessionId: sessionId
          });
          
          console.log('✅ Transcript loaded successfully');
          return transcript;
        } catch (error) {
          console.error('❌ Failed to load transcript:', error);
          set({ 
            selectedTranscriptId: null, 
            selectedTranscript: null 
          });
          throw error;
        }
      },
      
      /**
       * Add a newly completed transcript to the history
       * @param {Object} transcript - The transcript object to add
       */
      addToTranscriptHistory: (transcript) => {
        set((state) => ({
          transcriptHistory: [transcript, ...state.transcriptHistory]
        }));
        console.log('✅ Added new transcript to history');
      },
      
      /**
       * Remove a transcript from history (after deletion)
       * @param {String} sessionId - The session ID to remove
       */
      removeFromHistory: (sessionId) => {
        set((state) => ({
          transcriptHistory: state.transcriptHistory.filter(
            t => t.session_id !== sessionId
          )
        }));
        
        // If the removed transcript was selected, clear selection
        const currentSelectedId = get().selectedTranscriptId;
        if (currentSelectedId === sessionId) {
          set({ 
            selectedTranscriptId: null, 
            selectedTranscript: null,
            results: null,
            currentSessionId: null
          });
        }
        
        console.log('✅ Removed transcript from history');
      },
      
      /**
       * Refresh the transcript history from the server
       */
      refreshHistory: async () => {
        console.log('🔄 Refreshing transcript history...');
        const filters = {
          search: get().historySearchQuery
        };
        return get().loadTranscriptHistory(filters);
      },
      
      /**
       * Search transcripts
       * @param {String} query - Search query string
       */
      searchTranscripts: async (query) => {
        set({ historySearchQuery: query, isLoadingHistory: true });
        try {
          if (!query || query.trim() === '') {
            // If empty query, load all transcripts
            return get().loadTranscriptHistory();
          }
          
          console.log(`🔍 Searching transcripts: "${query}"`);
          const response = await backendApi.transcripts.search(query);
          const transcripts = response.data || [];
          
          set({ 
            transcriptHistory: transcripts,
            isLoadingHistory: false 
          });
          
          console.log(`✅ Found ${transcripts.length} transcripts`);
          return transcripts;
        } catch (error) {
          console.error('❌ Search failed:', error);
          set({ isLoadingHistory: false });
          throw error;
        }
      },
      
      /**
       * Delete a transcript
       * @param {String} sessionId - Session ID to delete
       * @param {Boolean} hardDelete - If true, permanently delete
       */
      deleteTranscript: async (sessionId, hardDelete = false) => {
        try {
          console.log(`🗑️ Deleting transcript: ${sessionId}`);
          await backendApi.transcripts.delete(sessionId, hardDelete);
          
          // Remove from local state
          get().removeFromHistory(sessionId);
          
          console.log('✅ Transcript deleted successfully');
          return true;
        } catch (error) {
          console.error('❌ Failed to delete transcript:', error);
          throw error;
        }
      },
      
      /**
       * Load transcript statistics
       */
      loadTranscriptStats: async () => {
        try {
          console.log('📊 Loading transcript statistics...');
          const response = await backendApi.transcripts.getStats();
          const stats = response.data;
          
          set({ transcriptStats: stats });
          
          console.log('✅ Statistics loaded:', stats);
          return stats;
        } catch (error) {
          console.error('❌ Failed to load statistics:', error);
          throw error;
        }
      },
      
      /**
       * Toggle sidebar visibility
       */
      toggleSidebar: () => set((state) => ({ 
        isSidebarOpen: !state.isSidebarOpen 
      })),
      
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      
      /**
       * Set sort order for transcript history
       * @param {String} sortBy - Sort field: 'date', 'duration', 'filename'
       */
      setSortBy: (sortBy) => {
        set({ historySortBy: sortBy });
        
        // Re-sort the current history
        const history = get().transcriptHistory;
        const sorted = [...history].sort((a, b) => {
          switch (sortBy) {
            case 'date':
              return new Date(b.created_at) - new Date(a.created_at);
            case 'duration':
              return (b.duration_seconds || 0) - (a.duration_seconds || 0);
            case 'filename':
              return a.filename.localeCompare(b.filename);
            default:
              return 0;
          }
        });
        
        set({ transcriptHistory: sorted });
      },

      // ============================================
      // ✅ NEW ACTIONS - Multi-file Upload
      // ============================================
      
      /**
       * Add files to upload queue
       * @param {Array} files - Array of File objects to upload
       */
      addToUploadQueue: (files) => {
        const newItems = files.map(file => ({
          file,
          sessionId: null,
          status: 'pending', // 'pending', 'uploading', 'processing', 'completed', 'failed'
          progress: 0,
          error: null,
          filename: file.name
        }));
        
        set((state) => ({
          uploadQueue: [...state.uploadQueue, ...newItems]
        }));
        
        console.log(`✅ Added ${files.length} files to upload queue`);
      },
      
      /**
       * Update upload queue item status
       * @param {Number} index - Index of the item in queue
       * @param {Object} updates - Updates to apply
       */
      updateUploadQueueItem: (index, updates) => {
        set((state) => {
          const newQueue = [...state.uploadQueue];
          newQueue[index] = { ...newQueue[index], ...updates };
          return { uploadQueue: newQueue };
        });
      },
      
      /**
       * Remove item from upload queue
       * @param {Number} index - Index to remove
       */
      removeFromUploadQueue: (index) => {
        set((state) => ({
          uploadQueue: state.uploadQueue.filter((_, i) => i !== index)
        }));
      },
      
      /**
       * Clear completed uploads from queue
       */
      clearCompletedUploads: () => {
        set((state) => ({
          uploadQueue: state.uploadQueue.filter(
            item => item.status !== 'completed'
          )
        }));
      },
      
      /**
       * Clear all uploads from queue
       */
      clearUploadQueue: () => {
        set({ uploadQueue: [], isUploadingMultiple: false });
      },
      
      setIsUploadingMultiple: (uploading) => {
        set({ isUploadingMultiple: uploading });
      },

      // ============================================
      // UTILITY ACTIONS
      // ============================================
      
      /**
       * Reset all state (for logout)
       */
      resetStore: () => set({
        selectedFile: null,
        isProcessing: false,
        currentSession: null,
        currentSessionId: null,
        results: null,
        processingStatus: null,
        expandedTranscript: false,
        analysisResults: {},
        analysisProgress: {},
        customPrompt: '',
        chatMessages: [],
        selectedChatSession: null,
        contextType: 'none',
        isLoading: false,
        transcriptHistory: [],
        selectedTranscriptId: null,
        selectedTranscript: null,
        transcriptStats: null,
        isLoadingHistory: false,
        uploadQueue: [],
        isUploadingMultiple: false,
        currentQueueSession: null,
        userFavorites: [],
        showFavoritesOnly: false,
      }),
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        // Only persist specific state (not loading states or temporary data)
        language: state.language,
        speakers: state.speakers,
        structures: state.structures,
        parameters: state.parameters,
        currentSessionId: state.currentSessionId,
        selectedTranscriptId: state.selectedTranscriptId,
        isSidebarOpen: state.isSidebarOpen,
        historySortBy: state.historySortBy,
        userFavorites: state.userFavorites,
      }),
    }
  )
);

export default useAppStore;