
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { DedupeProgress } from '@/lib/types';

interface JobProgressIndicatorProps {
  progress?: DedupeProgress;
}

const JobProgressIndicator: React.FC<JobProgressIndicatorProps> = ({ progress }) => {
  return (
    <div className="w-32">
      <Progress value={progress?.percentage || 0} className="h-2" />
      <p className="text-xs mt-1">{progress?.statusMessage || 'Processing...'}</p>
    </div>
  );
};

export default JobProgressIndicator;
