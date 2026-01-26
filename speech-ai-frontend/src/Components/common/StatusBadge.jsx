// src/components/common/StatusBadge.jsx - Status Badge Component
import React from 'react';
import { CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';

const StatusBadge = ({ status, size = 'md' }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          className: 'bg-green-100 text-green-800 border-green-200',
          text: 'Completed'
        };
      case 'processing':
        return {
          icon: Clock,
          className: 'bg-blue-100 text-blue-800 border-blue-200',
          text: 'Processing'
        };
      case 'failed':
        return {
          icon: XCircle,
          className: 'bg-red-100 text-red-800 border-red-200',
          text: 'Failed'
        };
      case 'pending':
        return {
          icon: AlertCircle,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          text: 'Pending'
        };
      default:
        return {
          icon: Clock,
          className: 'bg-gray-100 text-gray-800 border-gray-200',
          text: status
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4', 
    lg: 'w-5 h-5'
  };

  return (
    <span className={`inline-flex items-center space-x-1 rounded-full border font-medium ${config.className} ${sizeClasses[size]}`}>
      <Icon className={iconSizes[size]} />
      <span>{config.text}</span>
    </span>
  );
};

export default StatusBadge;