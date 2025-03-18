
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { DedupeProgress } from '@/lib/types';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isUsingSparkEngine } from '@/lib/sparkUtils';

interface JobProgressIndicatorProps {
  progress?: DedupeProgress;
}

const JobProgressIndicator: React.FC<JobProgressIndicatorProps> = ({ progress }) => {
  const isUsingSpark = isUsingSparkEngine(progress);
  
  // Determine if there's an error or warning state
  const hasError = progress?.status === 'failed';
  const hasWarning = progress?.status === 'blocked';
  
  return (
    <div className="w-32">
      <div className="flex items-center gap-1">
        <Progress value={progress?.percentage || 0} className={`h-2 flex-grow ${hasError ? 'bg-red-200' : ''}`} />
        {isUsingSpark && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Sparkles className="h-3 w-3 text-amber-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Using Apache Spark</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {hasError && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <AlertCircle className="h-3 w-3 text-red-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{progress?.error || 'Job failed'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <p className="text-xs mt-1">{progress?.statusMessage || 'Processing...'}</p>
    </div>
  );
};

export default JobProgressIndicator;
