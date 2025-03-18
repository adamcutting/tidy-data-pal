
import React from 'react';
import { Database, FileText, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DedupeProgress } from '@/lib/types';
import { isUsingSparkEngine, getSparkConfigDescription } from '@/lib/sparkUtils';

interface JobSourceIndicatorProps {
  dataSource?: string;
  configName?: string;
  progress?: DedupeProgress;
}

const JobSourceIndicator: React.FC<JobSourceIndicatorProps> = ({ dataSource, configName, progress }) => {
  const isUsingSpark = isUsingSparkEngine(progress);
  const sparkConfig = progress?.debugInfo ? JSON.parse(progress.debugInfo).sparkConfig : null;
  const sparkDescription = getSparkConfigDescription(sparkConfig);
  
  return (
    <div className="flex items-center gap-1 text-xs">
      {dataSource === 'database' ? (
        <Database className="h-3 w-3" />
      ) : (
        <FileText className="h-3 w-3" />
      )}
      <span>{configName || 'Unknown'}</span>
      
      {isUsingSpark && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="ml-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Using Apache Spark</p>
              {sparkConfig && (
                <p className="text-xs text-gray-400 mt-1">{sparkDescription}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

export default JobSourceIndicator;
