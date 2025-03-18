
import React from 'react';
import { Clock } from 'lucide-react';

interface JobTimestampProps {
  timestamp: number;
}

const JobTimestamp: React.FC<JobTimestampProps> = ({ timestamp }) => {
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getTimeSince = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <div className="flex items-center gap-1 text-xs">
      <Clock className="h-3 w-3" />
      <span title={formatTime(timestamp)}>
        {getTimeSince(timestamp)} ago
      </span>
    </div>
  );
};

export default JobTimestamp;
