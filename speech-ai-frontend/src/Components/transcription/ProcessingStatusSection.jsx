// src/Components/transcription/ProcessingStatusSection.jsx - CLEAN VERSION - No API dependencies
import React from 'react';
import { motion } from 'framer-motion';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Clock, 
  Users, 
  FileAudio, 
  Globe 
} from 'lucide-react';

// Processing Status Component
const ProcessingStatus = ({ status, onReset }) => {
  if (!status) return null;
  
  const getStatusIcon = () => {
    switch (status?.status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      case 'processing':
      default:
        return <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status?.status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      case 'processing':
      default:
        return 'border-cyan-200 bg-cyan-50';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border-2 p-6 mb-6 ${getStatusColor()}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {(!status || status?.status === 'processing') && 'Processing Audio'}
              {status?.status === 'completed' && 'Processing Complete'}
              {status?.status === 'failed' && 'Processing Failed'}
            </h3>
            <p className="text-gray-600">
              {(!status || status?.status === 'processing') && (status?.message || 'Your audio is being analyzed and transcribed...')}
              {status?.status === 'completed' && 'Your results are ready to view!'}
              {status?.status === 'failed' && (status?.message || 'Something went wrong during processing.')}
            </p>
          </div>
        </div>
        
        {/* Reset button for failed status */}
        {status?.status === 'failed' && (
          <button
            onClick={onReset}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Reset and try again"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      {/* Only show progress bar for processing status only */}
      {(!status || status?.status === 'processing') && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-900">{Math.round(status?.progress || 5)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-cyan-400 to-cyan-500 h-3 rounded-full transition-all duration-500 ease-out relative"
              style={{ width: `${Math.max(5, Math.min(100, status?.progress || 5))}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span className={(status?.progress || 5) >= 10 ? 'text-cyan-600 font-medium' : ''}>Upload</span>
            <span className={(status?.progress || 5) >= 30 ? 'text-cyan-600 font-medium' : ''}>Analysis</span>
            <span className={(status?.progress || 5) >= 60 ? 'text-cyan-600 font-medium' : ''}>Diarization</span>
            <span className={(status?.progress || 5) >= 90 ? 'text-cyan-600 font-medium' : ''}>Complete</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Stats Summary Component
const StatsSummary = ({ metadata, speakerStats, hasData }) => {
  const formatTime = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const stats = [
    {
      icon: Clock,
      label: 'Duration',
      value: hasData ? formatTime(metadata?.total_duration) : '--:--',
      color: 'bg-blue-100 text-blue-800',
      isLoading: hasData && !metadata?.total_duration
    },
    {
      icon: Users,
      label: 'Speakers',
      value: hasData ? (metadata?.num_speakers || '--') : '--',
      color: 'bg-green-100 text-green-800',
      isLoading: hasData && !metadata?.num_speakers
    },
    {
      icon: FileAudio,
      label: 'Segments',
      value: hasData ? (metadata?.num_segments || '--') : '--',
      color: 'bg-purple-100 text-purple-800',
      isLoading: hasData && !metadata?.num_segments
    },
    {
      icon: Globe,
      label: 'Language',
      value: hasData ? (metadata?.language?.toUpperCase() || 'AUTO') : 'AUTO',
      color: 'bg-orange-100 text-orange-800',
      isLoading: false
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => {
        const IconComponent = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`${stat.color} rounded-xl p-4 text-center relative overflow-hidden`}
          >
            <IconComponent className="w-6 h-6 mx-auto mb-2" />
            <div className="relative">
              {stat.isLoading ? (
                <div className="flex items-center justify-center space-x-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-lg font-bold">--</span>
                </div>
              ) : (
                <div className="text-lg font-bold">{stat.value}</div>
              )}
            </div>
            <div className="text-sm opacity-80">{stat.label}</div>
            
            {stat.isLoading && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// Main ProcessingStatusSection Component
const ProcessingStatusSection = ({ 
  hasSession, 
  processingStatus, 
  onReset, 
  results, 
  metadata, 
  speakerStats 
}) => {
  // Only show processing status when actively processing or failed
  // Hide it when completed AND we have results to prevent UI clutter
  const shouldShowProcessingStatus = hasSession && 
    processingStatus && 
    (processingStatus.status === 'processing' || 
     processingStatus.status === 'failed' ||
     (processingStatus.status === 'completed' && !results?.results?.segments));

  return (
    <div>
      {/* Show processing status only when needed */}
      {shouldShowProcessingStatus && (
        <ProcessingStatus 
          status={processingStatus}
          onReset={onReset}
        />
      )}

      {/* Stats Summary - Always show when we have session data */}
      <StatsSummary 
        metadata={metadata || {}} 
        speakerStats={speakerStats || {}}
        hasData={hasSession}
      />
    </div>
  );
};

export default ProcessingStatusSection;