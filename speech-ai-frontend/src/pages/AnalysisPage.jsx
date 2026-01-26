// src/pages/AnalysisPage.jsx - Restructured into 3 Main Components
import React, { useState, useEffect, useRef, useCallback } from 'react';
import useAppStore from '../stores/appStore';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast'; 
import { 
  BarChart3, 
  Loader2, 
  RefreshCw, 
  Brain, 
  Clock, 
  Search,
  Filter,
  X,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Zap,
  Sparkles,
  Star,
  FileAudio
} from 'lucide-react';

// Import components
import UnifiedAnalysisCard from '../Components/analysis/UnifiedAnalysisCard';
import TranscriptionSidebar from '../Components/TranscriptionSidebar';
import { useBackend } from '../contexts/BackendContext';
import { backendApi } from '../services/api';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

// ================================
// 1. HEADER COMPONENT
// ================================
const AnalysisPageHeader = ({ isValidSession, currentSessionId, selectedTranscript }) => {
  return (
    <div className="mb-8">
      {/* Audio File Name Display */}
      {selectedTranscript && (
        <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <FileAudio className="w-5 h-5" style={{ color: '#5AE8C7' }} />
            <div>
              <p className="text-sm text-gray-500">Analyzing</p>
              <p className="text-lg font-semibold text-gray-900">{selectedTranscript.filename}</p>
            </div>
          </div>
        </div>
      )}
      
      <h1 className="text-3xl font-bold mb-2 flex items-center text-gray-900">
        {/* Using brand's mint teal color for the brain icon */}
        <Brain className="w-8 h-8 mr-3" style={{ color: '#5AE8C7' }} />
        AI Analysis Dashboard
      </h1>
      
      {/* Session Status Warning - Using brand's soft yellow for warnings */}
      {!isValidSession && (
        <div className="mt-4 p-4 border rounded-lg" style={{ 
          backgroundColor: '#FFF3B0', 
          borderColor: '#FFC700' 
        }}>
          <div className="flex items-center space-x-2" style={{ color: '#B8860B' }}>
            <AlertTriangle className="w-5 h-5" />
            <span>No active session found. Please upload and process audio first.</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ================================
// 2. CUSTOM ANALYSIS PANEL COMPONENT
// ================================
const CustomAnalysisPanel = ({ 
  customPrompt, 
  setCustomPrompt, 
  runAnalysis, 
  loadingPrompts, 
  analysisResults, 
  analysisProgress, 
  isValidSession 
}) => {
// CustomAnalysisPanel Component - Light Theme Return Section
return (
  <div className="lg:col-span-1">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">Custom Analysis</h2>
    
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center space-x-2 mb-4">
        <Sparkles className="w-5 h-5" style={{ color: '#FFC700' }} />
        <h3 className="font-medium text-gray-900">Create Custom Prompt</h3>
      </div>
      
      
      <div className="mb-4">
        <p className="text-gray-600 text-sm mb-2">
          Write your own analysis prompt in natural language.
        </p>
      </div>
      
      
      <textarea
        value={customPrompt}
        onChange={(e) => setCustomPrompt(e.target.value)}
        placeholder="Example: Identify the main topics discussed, extract action items, summarize key decisions..."
        className="w-full h-32 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 resize-none focus:ring-2 focus:border-transparent"
        style={{ 
          '--tw-ring-color': '#5AE8C7'
        }}
      />
      
      <button
        onClick={() => {
          console.log(`Custom analysis button clicked, runAnalysis type:`, typeof runAnalysis);
          runAnalysis('custom_analysis');
        }}
        disabled={!isValidSession || !customPrompt.trim() || loadingPrompts.has('custom_analysis')}
        className={`w-full mt-4 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-md ${
          isValidSession && customPrompt.trim() && !loadingPrompts.has('custom_analysis')
            ? 'text-white hover:opacity-90'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        style={isValidSession && customPrompt.trim() && !loadingPrompts.has('custom_analysis') 
          ? { background: 'linear-gradient(to right, #5AE8C7, #DF72E8)' }
          : {}
        }
      >
        {loadingPrompts.has('custom_analysis') ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing Custom Analysis...</span>
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            <span>Run Custom Analysis</span>
          </>
        )}
      </button>

      {/* Custom Analysis Results */}
      {analysisResults['custom_analysis'] && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 border-t border-gray-200 pt-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4" style={{ color: '#5AE8C7' }} />
              <span>Custom analysis completed</span>
              {analysisResults['custom_analysis'].processing_time && (
                <>
                  <span>â€¢</span>
                  <span>{analysisResults['custom_analysis'].processing_time.toFixed(1)}s</span>
                </>
              )}
            </div>
            <button
              onClick={() => {
                const result = analysisResults['custom_analysis'];
                if (result?.response || result?.result) {
                  const blob = new Blob([result.response || result.result], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `custom_analysis.txt`;
                  link.click();
                  URL.revokeObjectURL(url);
                  toast.success('Custom analysis downloaded');
                }
              }}
              className="flex items-center space-x-1 px-3 py-1 m-2 text-white text-sm rounded transition-colors shadow-sm hover:opacity-90"
              style={{ backgroundColor: '#5AE8C7' }}
            >
              <Sparkles className="w-3 h-3" />
              <span>Download</span>
            </button>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
            <div className="text-gray-700 text-sm whitespace-pre-wrap">
              {analysisResults['custom_analysis']?.response || 
               analysisResults['custom_analysis']?.result || 
               'No content available'}
            </div>
          </div>
        </motion.div>
      )}

      {/* Custom Analysis Progress */}
      {analysisProgress['custom_analysis'] && (
        <div className="mt-4">
          {analysisProgress['custom_analysis'].status === 'processing' && (
            <div className="flex items-center space-x-2" style={{ color: '#5AE8C7' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Processing custom analysis...</span>
            </div>
          )}
          
          {analysisProgress['custom_analysis'].status === 'failed' && (
            <div className="flex items-center space-x-2 text-red-500">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">
                {analysisProgress['custom_analysis'].error || 'Custom analysis failed'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
};

// ================================
// 3. MAIN ANALYSIS COMPONENT (Cards + Search + Filters) - UPDATED WITH FAVORITES
// ================================
const AnalysisMain = ({ 
  prompts, 
  loadingPromptData, 
  searchTerm, 
  setSearchTerm, 
  selectedCategory, 
  setSelectedCategory, 
  filteredPrompts, 
  currentSessionId, 
  analysisResults, 
  analysisProgress, 
  loadingPrompts, 
  runAnalysis,
  // NEW: Favorites props
  showFavoritesOnly,
  setShowFavoritesOnly,
  userFavorites,
  handleToggleFavorite
}) => {
  const categories = ['all', 'general', 'meeting', 'content', 'analysis', 'productivity'];

  // AnalysisMain Component - Light Theme Return Section
  return (
    <div className="lg:col-span-2">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Analysis Tools</h2>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-gray-700 shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-6 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search analysis tools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:border-transparent shadow-sm"
            style={{ 
              '--tw-ring-color': '#5AE8C7'
            }}
          />
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {/* MY FAVORITES BUTTON - NEW */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all flex items-center space-x-1 ${
              showFavoritesOnly
                ? 'bg-yellow-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            <Star className="w-4 h-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} />
            <span>My Favorites</span>
            {userFavorites.length > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                showFavoritesOnly ? 'bg-yellow-600' : 'bg-gray-200'
              }`}>
                {userFavorites.length}
              </span>
            )}
          </button>

          {/* Existing Category Buttons */}
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
              }`}
              style={selectedCategory === category ? { backgroundColor: '#5AE8C7' } : {}}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Prompts Grid Section */}
      {loadingPromptData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#5AE8C7' }} />
          <span className="ml-2 text-gray-600">Loading analysis tools...</span>
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">
            {showFavoritesOnly 
              ? 'No favorite prompts yet' 
              : 'No analysis prompts available'}
          </p>
          <p className="text-gray-500 text-sm">
            {showFavoritesOnly
              ? 'Click the star icon on any analysis card to add it to your favorites'
              : prompts.length === 0 
                ? 'No prompts loaded from server' 
                : 'Try adjusting your search or filter criteria'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPrompts.map((prompt) => {
            // Check if this prompt is favorited
            const isFavorited = userFavorites.includes(prompt.id);
            
            return (
              <div key={prompt.key} className="w-full">
                <UnifiedAnalysisCard
                  prompt={prompt}
                  selectedSession={currentSessionId}
                  analysisResults={analysisResults}
                  analysisProgress={analysisProgress}
                  isLoading={loadingPrompts.has(prompt.key)}
                  onRunAnalysis={runAnalysis}
                  onDownload={(promptKey) => {
                    console.log('ðŸ“¥ Download requested for:', promptKey);
                    const result = analysisResults[promptKey];
                    if (result?.response || result?.result) {
                      const blob = new Blob([result.response || result.result], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `analysis_${promptKey}.txt`;
                      link.click();
                      URL.revokeObjectURL(url);
                      toast.success('Analysis downloaded');
                    } else {
                      toast.error('No result to download');
                    }
                  }}
                  showUsageStats={false}
                  isAdminView={false}
                  // NEW: Favorites props
                  isFavorited={isFavorited}
                  onToggleFavorite={handleToggleFavorite}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ================================
// 4. MAIN ANALYSIS PAGE COMPONENT (Orchestrator) - UPDATED WITH FAVORITES
// ================================
const AnalysisPage = () => {
  // Local UI state only
  const [prompts, setPrompts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loadingPromptData, setLoadingPromptData] = useState(false);
  const [loadingPrompts, setLoadingPrompts] = useState(new Set());
  
  // Get URL params and location
  const location = useLocation();
  const { sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();
  
  // Use Zustand store for persistent state
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const results = useAppStore((state) => state.results);
  const processingStatus = useAppStore((state) => state.processingStatus);
  const selectedTranscript = useAppStore((state) => state.selectedTranscript);
  const selectTranscript = useAppStore((state) => state.selectTranscript);
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
  const customPrompt = useAppStore((state) => state.customPrompt);
  const setCustomPrompt = useAppStore((state) => state.setCustomPrompt);
  
  // Analysis results from Zustand store
  const analysisResults = useAppStore((state) => state.analysisResults);
  const setAnalysisResults = useAppStore((state) => state.setAnalysisResults);
  const analysisProgress = useAppStore((state) => state.analysisProgress);
  const setAnalysisProgress = useAppStore((state) => state.setAnalysisProgress);
  
  // FAVORITES STATE FROM ZUSTAND
  const userFavorites = useAppStore((state) => state.userFavorites);
  const showFavoritesOnly = useAppStore((state) => state.showFavoritesOnly);
  const setShowFavoritesOnly = useAppStore((state) => state.setShowFavoritesOnly);
  const loadUserFavorites = useAppStore((state) => state.loadUserFavorites);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);

  // Load user favorites on mount
  useEffect(() => {
    const initializeFavorites = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        await loadUserFavorites();
      }
    };
    
    initializeFavorites();
  }, [loadUserFavorites]);

  // Handle transcript selection from sidebar
  const handleTranscriptSelect = useCallback((sessionId) => {
    console.log('📄 Transcript selected from sidebar:', sessionId);
    // Update URL to reflect selected transcript
    navigate(`/analysis/${sessionId}`);
  }, [navigate]);

  // Handle URL-based transcript loading
  useEffect(() => {
    // If we have a URL session ID and it's different from current, load it
    if (urlSessionId && urlSessionId !== currentSessionId) {
      console.log('🔗 Loading transcript from URL:', urlSessionId);
      selectTranscript(urlSessionId).catch(error => {
        console.error('Failed to load transcript from URL:', error);
        toast.error('Failed to load transcript');
      });
    }
  }, [urlSessionId, currentSessionId, selectTranscript]);

  const getTranscriptFromResults = useCallback(async () => {
    // Try getting from current results first
    if (results?.results?.segments) {
      return results.results.segments
        .map(segment => `${segment.speaker}: ${segment.text}`)
        .join('\n');
    }
    
    // âœ… NEW: If not in results, try loading from database
    if (currentSessionId) {
      try {
        console.log('ðŸ“š Loading transcript from database:', currentSessionId);
        const response = await backendApi.transcripts.getById(currentSessionId);
        
        if (response?.data?.segments) {
          console.log('âœ… Loaded transcript from database');
          return response.data.segments
            .map(segment => `${segment.speaker}: ${segment.text}`)
            .join('\n');
        }
      } catch (error) {
        console.error('Failed to load transcript from database:', error);
      }
    }
    
    return null;
  }, [results, currentSessionId]);

  // CORE ANALYSIS FUNCTION - Main business logic
// CORE ANALYSIS FUNCTION - Main business logic
const runAnalysis = useCallback(async (promptKey) => {
  console.log(`Starting analysis for: ${promptKey}`);

  if (!currentSessionId) {
    toast.error('Please process audio first.');
    return;
  }

  try {
    // âœ… CHANGED: Now async
    let transcript = await getTranscriptFromResults();
    
    if (!transcript) {
      toast.error('No transcript available for analysis.');
      return;
    }

      // Update loading state
      setLoadingPrompts(prev => new Set(prev).add(promptKey));
      
      // Update progress to processing
      const newProgressBefore = {
        ...analysisProgress,
        [promptKey]: { 
          status: 'processing', 
          progress: 0,
          timestamp: new Date().toISOString()
        }
      };
      
      setAnalysisProgress(newProgressBefore);

      // Handle custom analysis differently
      let apiPayload;
      if (promptKey === 'custom_analysis') {
        if (!customPrompt || !customPrompt.trim()) {
          toast.error('Please enter a custom prompt first.');
          setLoadingPrompts(prev => {
            const newSet = new Set(prev);
            newSet.delete(promptKey);
            return newSet;
          });
          return;
        }
        
        // Include custom_prompt in payload
        apiPayload = {
          transcript,
          prompt_key: promptKey,
          custom_prompt: customPrompt
        };
      } else {
        // Find the prompt for regular prompts
        const actualPromptKey = typeof promptKey === 'object' ? promptKey.key : promptKey;



        const prompt = prompts.find(p => p.key === promptKey);
        if (!prompt) {
          throw new Error('Prompt not found');
        }

        apiPayload = {
          transcript,
          prompt_key: promptKey
        };
      }
      
      const analysisResponse = await backendApi.post('/api/llm-process', apiPayload);

      if (analysisResponse.data?.result || analysisResponse.data?.response) {
        const resultData = {
          ...analysisResponse.data,
          response: analysisResponse.data.result || analysisResponse.data.response,
          timestamp: new Date().toISOString(),
          prompt_key: promptKey,
          session_id: currentSessionId
        };
        
        setAnalysisResults({
          ...analysisResults,
          [promptKey]: resultData
        });

        setAnalysisProgress({
          ...analysisProgress,
          [promptKey]: {
            status: 'completed',
            progress: 100,
            timestamp: new Date().toISOString()
          }
        });

        const promptTitle = promptKey === 'custom_analysis' ? 'Custom Analysis' : 
                           prompts.find(p => p.key === promptKey)?.title || promptKey;
        toast.success(`${promptTitle} completed successfully!`);
      } else {
        throw new Error('No result received from API');
      }

    } catch (error) {
      console.error(`Analysis failed for ${promptKey}:`, error);
      
      const errorMessage = error.response?.data?.detail || error.message || 'Analysis failed';
      
      setAnalysisProgress({
        ...analysisProgress,
        [promptKey]: {
          status: 'failed',
          progress: 0,
          error: errorMessage,
          timestamp: new Date().toISOString()
        }
      });

      toast.error(`Analysis failed: ${errorMessage}`);
    } finally {
      setLoadingPrompts(prev => {
        const newSet = new Set(prev);
        newSet.delete(promptKey);
        return newSet;
      });
    }
  }, [currentSessionId, results, customPrompt, prompts, analysisResults, analysisProgress, setAnalysisResults, setAnalysisProgress]);

  // Load prompts data with favorites
  useEffect(() => {
    const loadPrompts = async () => {
      setLoadingPromptData(true);
      try {
        const response = await backendApi.prompts.getPublic();
        
        // Handle both formats: {prompts: [...]} or just [...]
        const promptsArray = response?.data?.prompts || response?.data;
        
        if (promptsArray && Array.isArray(promptsArray)) {
          const token = localStorage.getItem('access_token');
          
          // Map prompts with favorite status
          const promptsData = promptsArray.map(prompt => ({
            ...prompt,
            id: prompt.id ,
            key: prompt.key,
            title: prompt.title,
            description: prompt.description || '',
            category: prompt.category || 'general',
            icon: prompt.icon || 'Brain',
            emoji: prompt.emoji || 'ðŸ¤–',
            estimated_time: prompt.estimated_time || 30,
            gradient_from: prompt.gradient_from || 'cyan-500',
            gradient_to: prompt.gradient_to || 'cyan-600',
            max_tokens: prompt.max_tokens || 2000,
            is_active: true,
            is_favorited: token && userFavorites.includes(prompt.id)
          }));
          
          setPrompts(promptsData);
          
          if (promptsData.length === 0) {
            toast.info('No active prompts available for analysis');
          }
        } else {
          throw new Error('Invalid response format from public API');
        }
        
      } catch (error) {
        console.error('Failed to load public prompts:', error);
        
        // Fallback to hardcoded prompts
        const fallbackPrompts = [
          {
            id: 1,
            key: 'summary',
            title: 'Conversation Summary',
            description: 'Generate a comprehensive summary of the entire conversation',
            category: 'general',
            icon: 'FileText',
            emoji: 'ðŸ“‹',
            estimated_time: 30,
            gradient_from: 'cyan-500',
            gradient_to: 'cyan-600',
            max_tokens: 2000,
            is_active: true,
            is_favorited: false
          },
          {
            id: 2,
            key: 'action_items',
            title: 'Action Items & Tasks',
            description: 'Extract actionable tasks and commitments from the conversation',
            category: 'productivity',
            icon: 'CheckSquare',
            emoji: 'âœ…',
            estimated_time: 25,
            gradient_from: 'green-500',
            gradient_to: 'green-600',
            max_tokens: 1500,
            is_active: true,
            is_favorited: false
          }
        ];
        
        setPrompts(fallbackPrompts);
        toast('Using fallback prompts - some features may be limited');
      } finally {
        setLoadingPromptData(false);
      }
    };

    loadPrompts();
  }, [userFavorites]); // Re-run when favorites change

  // Handle toggle favorite
  const handleToggleFavorite = async (promptId) => {
    const success = await toggleFavorite(promptId);
    if (success) {
      // Update the local prompts state to reflect the change
      setPrompts(prevPrompts => 
        prevPrompts.map(prompt => 
          prompt.id === promptId 
            ? { ...prompt, is_favorited: !prompt.is_favorited }
            : prompt
        )
      );
      
      // Show toast notification
      const isFavorited = userFavorites.includes(promptId);
      toast.success(isFavorited ? 'Removed from favorites' : 'Added to favorites');
    } else {
      toast.error('Failed to update favorite');
    }
  };

  // Filter prompts based on search, category, and favorites
  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prompt.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || prompt.category === selectedCategory;
    const matchesFavorites = !showFavoritesOnly || prompt.is_favorited;
    
    return matchesSearch && matchesCategory && matchesFavorites;
  });

  const isValidSession = currentSessionId && results;

  // Updated return section for AnalysisPage
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Transcript History Sidebar */}
      <TranscriptionSidebar 
        onSelectTranscript={handleTranscriptSelect}
      />
      
      {/* Main Content Area */}
      <div className={`flex-1 overflow-auto transition-all duration-300 ${isSidebarOpen ? 'ml-0' : 'ml-0'}`}>
        <div className="container mx-auto px-4 py-8">
          {/* 1. HEADER SECTION */}
          <AnalysisPageHeader 
            isValidSession={isValidSession}
            currentSessionId={currentSessionId}
            selectedTranscript={selectedTranscript}
          />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 2. MAIN ANALYSIS SECTION (Left 2/3) */}
          <AnalysisMain 
            prompts={prompts}
            loadingPromptData={loadingPromptData}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            filteredPrompts={filteredPrompts}
            currentSessionId={currentSessionId}
            analysisResults={analysisResults}
            analysisProgress={analysisProgress}
            loadingPrompts={loadingPrompts}
            runAnalysis={runAnalysis}
            showFavoritesOnly={showFavoritesOnly}
            setShowFavoritesOnly={setShowFavoritesOnly}
            userFavorites={userFavorites}
            handleToggleFavorite={handleToggleFavorite}
          />

          {/* 3. CUSTOM ANALYSIS PANEL (Right 1/3) */}
          <CustomAnalysisPanel 
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            runAnalysis={runAnalysis}
            loadingPrompts={loadingPrompts}
            analysisResults={analysisResults}
            analysisProgress={analysisProgress}
            isValidSession={isValidSession}
          />
        </div>
      </div>
      </div>
    </div>
  );
};

export default AnalysisPage;