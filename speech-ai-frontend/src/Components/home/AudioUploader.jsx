// src/Components/home/AudioUploader.jsx - ENHANCED VERSION
// ✅ More visible UI with gradient backgrounds
// ✅ Reduced bottom padding (p-6 instead of p-8)
// ✅ Better visual hierarchy with icons and badges
// ✅ Improved hover effects and animations

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileAudio, X, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const AudioUploader = ({ 
  onFileUpload, 
  onMultipleFiles, 
  onClearFile,
  selectedFile, 
  isProcessing,
  currentSessionId,
  processingStatus 
}) => {
  
  // Handle file drop
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    if (acceptedFiles.length > 1) {
      onMultipleFiles(acceptedFiles);
    } else {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload, onMultipleFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.wma', '.mp4']
    },
    multiple: true,
    disabled: isProcessing
  });

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      {selectedFile ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-300 rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            {/* Clear button */}
            <button
              onClick={onClearFile}
              disabled={isProcessing}
              className="flex-shrink-0 p-2 hover:bg-red-100 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear file and reset"
            >
              <X className="w-5 h-5 text-gray-600 group-hover:text-red-600 transition-colors" />
            </button>

            {/* File info */}
            <div className="flex items-center space-x-3 flex-1 mx-3 min-w-0">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileAudio className="w-5 h-5 text-green-600" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-600">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Audio file'}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex-shrink-0">
              {isProcessing ? (
                <div className="flex items-center space-x-2 text-blue-600">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-green-600">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm font-medium">Ready</span>
                </div>
              )}
            </div>
          </div>

          {/* Processing progress */}
          {processingStatus?.status === 'processing' && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-gray-700 font-medium">{processingStatus.message}</span>
                <span className="font-semibold text-gray-900">
                  {processingStatus.progress}%
                </span>
              </div>
              <div className="w-full bg-green-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${processingStatus.progress}%` }}
                />
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-teal-500 bg-teal-50 shadow-lg'
                : 'border-teal-400 bg-white hover:border-teal-500 hover:bg-teal-50/50 hover:shadow-md'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />

            {/* Animated background effect */}
            {isDragActive && (
              <div className="absolute inset-0 rounded-xl pointer-events-none animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-100/0 via-teal-100/30 to-teal-100/0"></div>
              </div>
            )}

            <div className="relative flex flex-col items-center space-y-3">
              {/* Icon with solid background - HIGHLY VISIBLE */}
              <div className={`w-16 h-16 bg-teal-500 rounded-full flex items-center justify-center shadow-xl border-4 border-teal-200 transition-all duration-200 ${
                isDragActive ? 'scale-110 bg-teal-600 border-teal-300' : ''
              }`}>
                <Upload className="w-8 h-8 text-white stroke-[2.5]" />
              </div>

              <div>
                <p className="text-xl font-bold text-gray-900 mb-1">
                  {isDragActive ? '📥 Drop Files Here' : '🎵 Upload Audio Files'}
                </p>
                <p className="text-sm text-gray-700 font-medium">
                  Drag & drop or click to browse
                </p>
                <p className="text-xs text-gray-500 mt-1.5">
                  MP3, WAV, M4A, OGG, FLAC • Multiple files supported
                </p>
              </div>

              {!isProcessing && (
                <button
                  type="button"
                  className="px-8 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 hover:shadow-lg transition-all duration-200 font-semibold text-sm transform hover:scale-105 active:scale-95"
                >
                  Select Files
                </button>
              )}

              {/* Feature badges */}
              <div className="flex items-center gap-3 pt-2">
                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  Multi-file
                </span>
                <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                  AI Powered
                </span>
                <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                  Fast
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AudioUploader;