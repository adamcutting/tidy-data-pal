
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { DedupeProgress } from '@/lib/types';
import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface JobProgressIndicatorProps {
  progress?: DedupeProgress;
}

const JobProgressIndicator: React.FC<JobProgressIndicatorProps> = ({ progress }) => {
  const isUsingSpark = progress?.debugInfo?.includes('spark') || 
                      progress?.debugInfo?.includes('Spark') || 
                      progress?.stage?.includes('spark') ||
                      progress?.statusMessage?.toLowerCase().includes('spark');
  
  return (
    <div className="w-32">
      <div className="flex items-center gap-1">
        <Progress value={progress?.percentage || 0} className="h-2 flex-grow" />
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
      </div>
      <p className="text-xs mt-1">{progress?.statusMessage || 'Processing...'}</p>
    </div>
  );
};

export default JobProgressIndicator;
