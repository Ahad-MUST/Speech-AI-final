// src/components/TranscriptionSidebar.jsx - Transcript History Sidebar Component WITH RENAME
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileAudio, 
  Search, 
  Clock, 
  Users, 
  Trash2, 
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Calendar,
  Globe,
  Edit2
} from 'lucide-react';
import useAppStore from '../stores/appStore';
import toast from 'react-hot-toast';
import RenameAudioModal from './RenameAudioModal';
import backendApi from '../services/api';

const TranscriptionSidebar = ({ onSelectTranscript, className = '' }) => {
  // Zustand state
  const {
    transcriptHistory,
    selectedTranscriptId,
    isLoadingHistory,
    isSidebarOpen,
    historySortBy,
    historySearchQuery,
    loadTranscriptHistory,
    selectTranscript,
    searchTranscripts,
    deleteTranscript,
    toggleSidebar,
    setSortBy,
    refreshHistory
  } = useAppStore();

  // Local state
  const [searchInput, setSearchInput] = useState(historySearchQuery || '');
  const [isSearching, setIsSearching] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  // ✅ NEW: Rename modal state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [selectedForRename, setSelectedForRename] = useState(null);

  // Load transcript history on mount
  useEffect(() => {
    const initializeHistory = async () => {
      try {
        await loadTranscriptHistory();
      } catch (error) {
        console.error('Failed to load transcript history:', error);
        toast.error('Failed to load transcript history');
      }
    };

    initializeHistory();
  }, [loadTranscriptHistory]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchInput.trim() !== historySearchQuery) {
        setIsSearching(true);
        try {
          await searchTranscripts(searchInput.trim());
        } catch (error) {
          console.error('Search failed:', error);
          toast.error('Search failed');
        } finally {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Handle transcript selection
  const handleSelectTranscript = async (transcript) => {
    try {
      await selectTranscript(transcript.session_id);
      
      // Call parent callback if provided
      if (onSelectTranscript) {
        onSelectTranscript(transcript.session_id);
      }
      
      toast.success(`Loaded: ${transcript.filename}`);
    } catch (error) {
      console.error('Failed to load transcript:', error);
      toast.error('Failed to load transcript');
    }
  };

  // ✅ NEW: Handle rename click
  const handleRenameClick = (transcript, event) => {
    event.stopPropagation(); // Prevent selecting the transcript
    setSelectedForRename(transcript);
    setRenameModalOpen(true);
  };

  // ✅ NEW: Handle rename
  const handleRename = async (newFilename) => {
    try {
      const response = await backendApi.transcripts.rename(
        selectedForRename.session_id, 
        newFilename
      );
      
      // Refresh the history to show updated name
      await refreshHistory();
      
      toast.success('Audio file renamed successfully');
      setRenameModalOpen(false);
      setSelectedForRename(null);
    } catch (error) {
      console.error('Rename failed:', error);
      throw error; // Let modal handle the error display
    }
  };

  // Handle delete
  const handleDelete = async (transcript, event) => {
    event.stopPropagation(); // Prevent selecting the transcript
    
    if (!window.confirm(`Delete "${transcript.filename}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(transcript.session_id);
    try {
      await deleteTranscript(transcript.session_id, false); // Soft delete
      toast.success('Transcript deleted');
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete transcript');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      await refreshHistory();
      toast.success('History refreshed');
    } catch (error) {
      console.error('Refresh failed:', error);
      toast.error('Failed to refresh history');
    }
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Sort options
  const sortOptions = [
    { value: 'date', label: 'Date', icon: Calendar },
    { value: 'duration', label: 'Duration', icon: Clock },
    { value: 'filename', label: 'Name', icon: FileAudio },
  ];

  if (!isSidebarOpen) {
    return (
      <motion.div
        initial={{ x: -20 }}
        animate={{ x: 0 }}
        className="fixed left-0 top-20 z-40"
      >
        <button
          onClick={toggleSidebar}
          className="bg-white shadow-lg rounded-r-lg p-2 hover:bg-gray-50 transition-colors"
          title="Open sidebar"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        exit={{ x: -300 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`fixed left-0 top-0 h-screen w-80 bg-white border-r border-gray-200 shadow-lg z-50 flex flex-col ${className}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-psycon-mint/10 to-psycon-lavender/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileAudio className="w-5 h-5 text-psycon-mint" />
              Transcript History
            </h2>
            <div className="flex gap-1">
              <button
                onClick={handleRefresh}
                disabled={isLoadingHistory}
                className="p-1.5 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={toggleSidebar}
                className="p-1.5 hover:bg-white rounded-lg transition-colors"
                title="Close sidebar"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transcripts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-psycon-mint focus:border-transparent"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>

          {/* Sort Options */}
          <div className="mt-2 flex gap-1">
            {sortOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  historySortBy === option.value
                    ? 'bg-psycon-mint text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <option.icon className="w-3 h-3" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transcript List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingHistory && transcriptHistory.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading transcripts...</p>
              </div>
            </div>
          ) : transcriptHistory.length === 0 ? (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center">
                <FileAudio className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600 mb-1">No transcripts yet</p>
                <p className="text-xs text-gray-500">Upload an audio file to get started</p>
              </div>
            </div>
          ) : (
            <div className="p-2">
              <AnimatePresence>
                {transcriptHistory.map((transcript, index) => (
                  <motion.div
                    key={transcript.session_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelectTranscript(transcript)}
                    className={`mb-2 p-3 rounded-lg border cursor-pointer transition-all group ${
                      selectedTranscriptId === transcript.session_id
                        ? 'bg-psycon-mint/10 border-psycon-mint shadow-sm'
                        : 'bg-white border-gray-200 hover:border-psycon-mint/50 hover:shadow-sm'
                    }`}
                  >
                    {/* Filename */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                        {transcript.filename}
                      </h3>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* ✅ NEW: Rename button */}
                        <button
                          onClick={(e) => handleRenameClick(transcript, e)}
                          className="p-1 hover:bg-blue-50 rounded transition-colors"
                          title="Rename audio"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(transcript, e)}
                          disabled={deletingId === transcript.session_id}
                          className="p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Delete transcript"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <div className="flex items-center gap-1" title="Duration">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(transcript.duration_seconds)}</span>
                        </div>
                        {transcript.num_speakers && (
                          <div className="flex items-center gap-1" title="Speakers">
                            <Users className="w-3 h-3" />
                            <span>{transcript.num_speakers}</span>
                          </div>
                        )}
                        {transcript.language && (
                          <div className="flex items-center gap-1" title="Language">
                            <Globe className="w-3 h-3" />
                            <span className="uppercase">{transcript.language}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formatDate(transcript.created_at)}</span>
                        <span>{formatFileSize(transcript.audio_file_size)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer with stats */}
        {transcriptHistory.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-600 text-center">
              {transcriptHistory.length} transcript{transcriptHistory.length !== 1 ? 's' : ''}
              {searchInput && ' (filtered)'}
            </div>
          </div>
        )}
      </motion.div>

      {/* ✅ NEW: Rename Modal */}
      <RenameAudioModal
        isOpen={renameModalOpen}
        onClose={() => {
          setRenameModalOpen(false);
          setSelectedForRename(null);
        }}
        currentFilename={selectedForRename?.filename || ''}
        onRename={handleRename}
      />
    </>
  );
};

export default TranscriptionSidebar;