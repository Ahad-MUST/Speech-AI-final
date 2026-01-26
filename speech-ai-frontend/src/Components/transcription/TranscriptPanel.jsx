// src/Components/transcription/TranscriptPanel.jsx - FIXED: Shows speaker names in Original view
import React, { useState, useMemo } from 'react';
import { Maximize2, Minimize2, FileText, Eye, Edit3, Play } from 'lucide-react';
import LiveTranscriptEditor from './LiveTranscriptEditor';

const TranscriptPanel = ({ 
  results,              // ✅ Transcript results
  currentView,          // ✅ Current view ('original' or 'editor')
  onViewChange,         // ✅ Callback to notify parent of view changes
  editorRef,            // ✅ Ref for LiveTranscriptEditor
  onSegmentClick        // ✅ Callback for when user clicks a segment to play audio
}) => {
  // Internal state for expansion
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  
  // Derive showEditor from currentView prop
  const showEditor = currentView === 'editor';

  // ✅ CRITICAL: Get speaker mappings from metadata
  const speakerMappings = useMemo(() => {
    const metadata = results?.results?.metadata || results?.metadata || {};
    return metadata.speaker_mappings || {};
  }, [results]);

  // ✅ Helper function to get display name for a speaker
  const getDisplayName = (speakerLabel) => {
    return speakerMappings[speakerLabel] || speakerLabel;
  };

  // Handle view change
  const handleViewChange = (isEditor) => {
    if (onViewChange) {
      onViewChange(isEditor ? 'editor' : 'original');
    }
  };

  // Toggle expansion
  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // ✅ Handle segment click with proper event handling
  const handleSegmentClick = (segment, index) => {
    console.log('🎯 Segment clicked in panel:', {
      index,
      speaker: segment.speaker,
      displayName: getDisplayName(segment.speaker),
      start: segment.start,
      text: segment.text.substring(0, 50) + '...'
    });
    
    if (onSegmentClick) {
      // Call parent callback with start timestamp
      onSegmentClick(segment.start);
    } else {
      console.warn('⚠️ onSegmentClick callback not provided');
    }
  };

  // Helper function to format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Check if we have results
  const hasResults = results?.results?.segments;

  if (!hasResults) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col items-center justify-center p-8">
        <FileText className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">No Transcript Available</h3>
        <p className="text-gray-500 text-center">
          Upload and process an audio file to see the transcript here.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 transition-all duration-300 ${
      isExpanded ? 'fixed inset-4 z-50' : 'h-full'
    }`}>
      {/* Header with view toggle and expand/collapse button */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">Live Transcript</h3>
          
          {/* View Toggle Buttons */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleViewChange(false)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                !showEditor 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Original</span>
            </button>
            <button
              onClick={() => handleViewChange(true)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                showEditor 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>Editor</span>
            </button>
          </div>
        </div>

        <button
          onClick={handleToggleExpand}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title={isExpanded ? "Minimize" : "Expand"}
        >
          {isExpanded ? (
            <Minimize2 className="w-5 h-5 text-gray-600" />
          ) : (
            <Maximize2 className="w-5 h-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* Content with proper layout and scroll behavior */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {showEditor ? (
          // Editor View
          <div className="flex-1 overflow-hidden h-full">
            <LiveTranscriptEditor 
              ref={editorRef}
              results={results} 
              hasSession={!!results} 
            />
          </div>
        ) : (
          // ✅ Original Transcript View - Shows SPEAKER NAMES, not labels
          <div className="flex-1 overflow-hidden flex flex-col h-full">
            <div 
              className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4" 
              style={{ 
                scrollBehavior: 'smooth',
                maxHeight: 'calc(160vh - 600px)',
                height: '100%',
                minHeight: '800px'
              }}
            >
              {results.results.segments.map((segment, index) => {
                // ✅ CRITICAL: Get the display name from mappings
                const displayName = getDisplayName(segment.speaker);
                
                return (
                  <div 
                    key={index} 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSegmentClick(segment, index);
                    }}
                    onMouseEnter={() => setHoveredSegment(index)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    className={`bg-gray-50 rounded-lg p-4 border transition-all w-full group ${
                      hoveredSegment === index
                        ? 'border-blue-400 bg-blue-50 shadow-lg cursor-pointer transform scale-[1.02]'
                        : 'border-gray-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50 hover:shadow-md'
                    }`}
                    style={{ 
                      maxWidth: '100%',
                      boxSizing: 'border-box'
                    }}
                    title={`Click to play from ${formatTime(segment.start)}`}
                  >
                    <div className="flex items-start space-x-4 w-full">
                      {/* Timestamp Badge */}
                      <div className="flex-shrink-0 flex items-center space-x-2">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                          hoveredSegment === index
                            ? 'bg-blue-500 text-white'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {formatTime(segment.start)} - {formatTime(segment.end)}
                        </div>
                        
                        {/* ✅ Play icon indicator on hover */}
                        {hoveredSegment === index && (
                          <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full animate-pulse">
                            <Play className="w-3 h-3 text-white fill-current" />
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center space-x-2 mb-2">
                          {/* ✅ CRITICAL: Display the mapped name, not the label */}
                          <span className={`font-semibold text-sm transition-colors ${
                            hoveredSegment === index
                              ? 'text-blue-800'
                              : 'text-green-700'
                          }`}>
                            {displayName}
                          </span>
                          
                          {/* ✅ Show label as a small badge if different from display name */}
                          {displayName !== segment.speaker && (
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                              {segment.speaker}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-900 leading-relaxed break-words overflow-wrap-anywhere">
                          {segment.text}
                        </p>
                      </div>
                    </div>
                    
                    {/* ✅ Hover hint */}
                    {hoveredSegment === index && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="text-xs text-blue-600 font-medium flex items-center">
                          <Play className="w-3 h-3 mr-1" />
                          Click to play from this timestamp
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Status bar for original view */}
      {!showEditor && hasResults && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>{results.results.segments.length} segments</span>
            <span>•</span>
            <span>{new Set(results.results.segments.map(s => s.speaker)).size} speakers</span>
            {results.results.metadata?.total_duration && (
              <>
                <span>•</span>
                <span>{formatTime(results.results.metadata.total_duration)} total</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2 text-xs text-blue-600">
            <Play className="w-3 h-3" />
            <span>Click any segment to play audio</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptPanel;