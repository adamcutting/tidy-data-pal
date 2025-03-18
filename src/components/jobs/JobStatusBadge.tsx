
import React from 'react';
import { cn } from '@/lib/utils';

interface JobStatusBadgeProps {
  status?: string;
}

const JobStatusBadge: React.FC<JobStatusBadgeProps> = ({ status }) => {
  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'cancelled': return 'text-orange-500';
      default: return 'text-blue-500';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 ${getStatusColor(status)}`}>
      {status === 'running' && (
        <span className="animate-pulse relative flex h-2 w-2 mr-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
      )}
      {status || 'running'}
    </span>
  );
};

export default JobStatusBadge;
