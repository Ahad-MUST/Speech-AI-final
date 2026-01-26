import React from 'react';
import { motion } from 'framer-motion';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Brain,
  Volume2,
  FileText
} from 'lucide-react';

const ProcessingStatus = ({ status, onReset }) => {
  const getStatusIcon = () => {
    switch (status?.status) {
      case 'processing':
        return <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Clock className="w-8 h-8 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              {status?.status === 'processing' && 'Processing Audio...'}
              {status?.status === 'completed' && 'Processing Complete!'}
              {status?.status === 'failed' && 'Processing Failed'}
            </h3>
            <p className="text-gray-600">
              {status?.message || 'Processing your audio file...'}
            </p>
          </div>
        </div>
      </div>

      {status?.status === 'processing' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-900">{status?.progress || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${status?.progress || 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingStatus;