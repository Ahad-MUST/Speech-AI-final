// src/components/transcription/AudioUploader.jsx - Audio File Upload Component
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileAudio, X, AlertCircle } from 'lucide-react';

const AudioUploader = ({ onFileUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);

  const SUPPORTED_FORMATS = ['.mp3', '.wav', '.mp4', '.m4a', '.flac', '.ogg'];
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  const validateFile = (file) => {
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!SUPPORTED_FORMATS.includes(fileExtension)) {
      return `Unsupported format. Please use: ${SUPPORTED_FORMATS.join(', ')}`;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    
    return null;
  };

  const handleFiles = useCallback((files) => {
    const file = files[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);
  }, []);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInput = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleUpload = () => {
    if (selectedFile && onFileUpload) {
      onFileUpload(selectedFile);
      setSelectedFile(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : selectedFile
            ? 'border-green-300 bg-green-50'
            : error
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="audio-upload"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept={SUPPORTED_FORMATS.join(',')}
          onChange={handleFileInput}
        />

        <div className="space-y-4">
          {selectedFile ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="space-y-3"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <FileAudio className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <div className="text-lg font-medium text-gray-900">
                  {selectedFile.name}
                </div>
                <div className="text-sm text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm hover:bg-gray-50"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </motion.div>
          ) : error ? (
            <div className="space-y-3">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div className="text-red-600">
                <div className="font-medium">Upload Error</div>
                <div className="text-sm">{error}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <div className="text-lg font-medium text-gray-900">
                  Drop your audio file here
                </div>
                <div className="text-sm text-gray-500">
                  or <span className="text-blue-600 font-medium">browse files</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Supported Formats</h4>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_FORMATS.map((format) => (
            <span
              key={format}
              className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md font-mono"
            >
              {format}
            </span>
          ))}
        </div>
        <div className="mt-2 text-xs text-blue-700">
          Maximum file size: {MAX_FILE_SIZE / 1024 / 1024}MB
        </div>
      </div>

      {/* Upload Button */}
      {selectedFile && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleUpload}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          🚀 Start Transcription
        </motion.button>
      )}
    </div>
  );
};

export default AudioUploader;