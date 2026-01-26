// src/components/analysis/UnifiedAnalysisCard.jsx - WITH FAVORITES FEATURE
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Download, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  Clock,
  TrendingUp,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Star
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const UnifiedAnalysisCard = ({ 
  prompt,                    // Prompt object from database
  selectedSession,
  analysisResults,
  analysisProgress,
  isLoading,
  onRunAnalysis,
  onDownload,
  showUsageStats = false,
  isAdminView = false,
  onToggleStatus,
  onEdit,
  onDelete,
  // NEW: Favorites props
  isFavorited = false,
  onToggleFavorite
}) => {
  // Get the appropriate icon component
  const IconComponent = LucideIcons[prompt.icon] || Brain;
  
  // Get results and progress for this specific prompt
  const result = analysisResults[prompt.key];
  const progress = analysisProgress[prompt.key];

  // State for collapsible content
  const [isExpanded, setIsExpanded] = useState(true);

  // Check if there's content to show (results, processing, or error)
  const hasContent = (result && (result.response || result.result || result.error)) || 
                    (progress && (progress.status === 'processing' || progress.status === 'failed'));

  const formatAnalysisText = (text) => {
    if (!text) {
      return <div className="text-gray-500">No content available</div>;
    }
    
    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      if (line.trim() === '') {
        return <div key={index} className="mb-2"></div>;
      }
      
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <h4 key={index} className="text-lg font-semibold text-black mt-4 mb-2">
            {line.replace(/\*\*/g, '')}
          </h4>
        );
      }
      
      if (line.startsWith('###')) {
        return (
          <h5 key={index} className="text-md font-medium text-black mt-3 mb-2">
            {line.replace(/###/g, '').trim()}
          </h5>
        );
      }
      
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <li key={index} className="ml-4 text-black mb-1 list-disc">
            {line.replace(/^[•\-]\s/, '')}
          </li>
        );
      }
      
      if (line.includes('**')) {
        return (
          <p key={index} className="text-black mb-2" dangerouslySetInnerHTML={{
            __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          }} />
        );
      }
      
      return (
        <p key={index} className="text-black mb-2">
          {line}
        </p>
      );
    });
  };

  const getCategoryColor = () => {
    switch(prompt.category) {
      case 'general':
        return 'border-teal-400 text-teal-600 bg-teal-50';
      case 'meeting':
        return 'border-green-400 text-green-600 bg-green-50';
      case 'content':
        return 'border-purple-400 text-purple-600 bg-purple-50';
      case 'analysis':
        return 'border-yellow-400 text-yellow-600 bg-yellow-50';
      case 'productivity':
        return 'border-orange-400 text-orange-600 bg-orange-50';
      default:
        return 'border-teal-400 text-teal-600 bg-teal-50';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Header with gradient */}
      <div 
        className="p-4"
        style={{
          background: prompt.gradient_from && prompt.gradient_to
            ? `linear-gradient(to right, ${
                prompt.gradient_from === 'cyan-500' ? '#5AE8C7' :
                prompt.gradient_from === 'green-500' ? '#10B981' :
                prompt.gradient_from === 'purple-500' ? '#DF72E8' :
                prompt.gradient_from === 'yellow-500' ? '#FFC700' :
                prompt.gradient_from === 'orange-500' ? '#F97316' : '#5AE8C7'}, ${
                prompt.gradient_to === 'cyan-600' ? '#4FD1C7' :
                prompt.gradient_to === 'green-600' ? '#059669' :
                prompt.gradient_to === 'purple-600' ? '#C061CB' :
                prompt.gradient_to === 'yellow-600' ? '#D97706' :
                prompt.gradient_to === 'orange-600' ? '#EA580C' : '#4FD1C7'})`
            : 'linear-gradient(to right, #5AE8C7, #4FD1C7)'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <span className="text-2xl">{prompt.emoji}</span>
            </div>
            <div className="text-white">
              <h3 className="font-semibold text-white">{prompt.title}</h3>
              <p className="text-sm text-white/90">{prompt.description}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Favorite Star Button - NEW */}
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(prompt.id);
                }}
                className={`p-2 rounded-lg transition-all backdrop-blur-sm ${
                  isFavorited 
                    ? 'bg-yellow-500/30 text-yellow-200 hover:bg-yellow-500/40' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star 
                  className="w-4 h-4" 
                  fill={isFavorited ? 'currentColor' : 'none'}
                />
              </button>
            )}

            {/* Collapse/Expand button - only show when there's content */}
            {hasContent && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors backdrop-blur-sm"
                title={isExpanded ? 'Minimize content' : 'Expand content'}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}

            {/* Admin controls */}
            {isAdminView && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onToggleStatus(prompt)}
                  className={`p-2 rounded-lg transition-colors backdrop-blur-sm ${
                    prompt.is_active 
                      ? 'bg-green-600/20 text-green-100 hover:bg-green-600/30' 
                      : 'bg-gray-600/20 text-gray-200 hover:bg-gray-600/30'
                  }`}
                  title={prompt.is_active ? 'Deactivate' : 'Activate'}
                >
                  {prompt.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => onEdit(prompt)}
                  className="p-2 bg-blue-600/20 text-blue-100 rounded-lg hover:bg-blue-600/30 transition-colors backdrop-blur-sm"
                  title="Edit Prompt"
                >
                  <IconComponent className="w-4 h-4" />
                </button>
                {!prompt.is_system && (
                  <button
                    onClick={() => onDelete(prompt.id)}
                    className="p-2 bg-red-600/20 text-red-100 rounded-lg hover:bg-red-600/30 transition-colors backdrop-blur-sm"
                    title="Delete Prompt"
                  >
                    <AlertCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category and Stats */}
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <div className="flex items-center space-x-3">
          <span 
            className={`px-2 py-1 text-xs rounded border font-medium ${getCategoryColor()}`}
            style={{
              borderColor: prompt.category === 'general' ? '#5AE8C7' :
                          prompt.category === 'meeting' ? '#10B981' :
                          prompt.category === 'content' ? '#DF72E8' :
                          prompt.category === 'analysis' ? '#FFC700' :
                          prompt.category === 'productivity' ? '#F97316' : '#5AE8C7',
              color: prompt.category === 'general' ? '#5AE8C7' :
                     prompt.category === 'meeting' ? '#10B981' :
                     prompt.category === 'content' ? '#DF72E8' :
                     prompt.category === 'analysis' ? '#FFC700' :
                     prompt.category === 'productivity' ? '#F97316' : '#5AE8C7'
            }}
          >
            {prompt.category}
          </span>
          
          {showUsageStats && prompt.usage_count > 0 && (
            <span className="text-xs text-gray-500 flex items-center space-x-1">
              <TrendingUp className="w-3 h-3" />
              <span>{prompt.usage_count} uses</span>
            </span>
          )}
        </div>

        {/* Run Analysis Button */}
        {!isAdminView && (
          <button
            onClick={() => onRunAnalysis(prompt.key)}
            disabled={isLoading || !selectedSession || progress?.status === 'processing'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isLoading || !selectedSession || progress?.status === 'processing'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'text-white hover:opacity-90'
            }`}
            style={{
              background: !(isLoading || !selectedSession || progress?.status === 'processing')
                ? `linear-gradient(to right, ${
                    prompt.gradient_from === 'cyan-500' ? '#5AE8C7' :
                    prompt.gradient_from === 'green-500' ? '#10B981' :
                    prompt.gradient_from === 'purple-500' ? '#DF72E8' :
                    prompt.gradient_from === 'yellow-500' ? '#FFC700' :
                    prompt.gradient_from === 'orange-500' ? '#F97316' : '#5AE8C7'}, ${
                    prompt.gradient_to === 'cyan-600' ? '#4FD1C7' :
                    prompt.gradient_to === 'green-600' ? '#059669' :
                    prompt.gradient_to === 'purple-600' ? '#C061CB' :
                    prompt.gradient_to === 'yellow-600' ? '#D97706' :
                    prompt.gradient_to === 'orange-600' ? '#EA580C' : '#4FD1C7'})`
                : undefined
            }}
          >
            {progress?.status === 'processing' ? (
              <span className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <Brain className="w-4 h-4" />
                <span>Run Analysis</span>
              </span>
            )}
          </button>
        )}
      </div>

      {/* Collapsible Results Section */}
      <AnimatePresence>
        {hasContent && (
          <motion.div
            initial={{ height: isExpanded ? 'auto' : 0 }}
            animate={{ height: isExpanded ? 'auto' : 0 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            {/* Processing State */}
            {progress && progress.status === 'processing' && !result && (
              <div className="px-4 pb-4">
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center space-x-2 text-sm text-blue-600 mb-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analysis in progress...</span>
                  </div>
                  {progress.progress !== undefined && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${progress.progress}%`,
                          background: `linear-gradient(to right, ${
                            prompt.gradient_from === 'cyan-500' ? '#5AE8C7' :
                            prompt.gradient_from === 'green-500' ? '#10B981' :
                            prompt.gradient_from === 'purple-500' ? '#DF72E8' :
                            prompt.gradient_from === 'yellow-500' ? '#FFC700' :
                            prompt.gradient_from === 'orange-500' ? '#F97316' : '#5AE8C7'}, ${
                            prompt.gradient_to === 'cyan-600' ? '#4FD1C7' :
                            prompt.gradient_to === 'green-600' ? '#059669' :
                            prompt.gradient_to === 'purple-600' ? '#C061CB' :
                            prompt.gradient_to === 'yellow-600' ? '#D97706' :
                            prompt.gradient_to === 'orange-600' ? '#EA580C' : '#4FD1C7'})`
                        }}
                      />
                    </div>
                  )}
                  {progress.message && (
                    <p className="text-sm text-gray-600">{progress.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Success State with Results */}
            {result && (result.response || result.result) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="px-4 pb-4">
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2 text-sm text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>Analysis complete</span>
                        {result.timestamp && (
                          <span className="text-gray-400 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
                          </span>
                        )}
                      </div>
                      {onDownload && (
                        <button
                        onClick={() => onDownload(prompt.key)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export</span>
                        </button>
                      )}
                    </div>
                    <div className="prose prose-sm max-w-none text-black">
                      {formatAnalysisText(result.response || result.result)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Error State */}
            {result && result.error && (
              <div className="px-4 pb-4">
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center space-x-2 text-sm text-red-600 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Analysis failed</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {result.error}
                  </div>
                </div>
              </div>
            )}

            {/* Failed Progress State */}
            {progress && progress.status === 'failed' && !result && (
              <div className="px-4 pb-4">
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center space-x-2 text-sm text-red-600 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Analysis failed</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {progress.error || 'Analysis failed to complete'}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default UnifiedAnalysisCard;