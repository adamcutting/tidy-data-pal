
import React from 'react';
import { RefreshCw, X, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { DedupeProgress } from '@/lib/types';

interface ProgressIndicatorProps {
  progress: DedupeProgress;
  jobId?: string;
  onRefresh?: () => void;
  onCancel?: () => void;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ 
  progress, 
  jobId,
  onRefresh,
  onCancel
}) => {
  const isProcessing = progress.status === 'processing' || progress.status === 'waiting';
  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';
  const isCancelled = progress.status === 'cancelled';
  
  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-card rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isProcessing && <Spinner size="sm" />}
            {isCompleted && <div className="h-4 w-4 rounded-full bg-green-500"></div>}
            {isFailed && <div className="h-4 w-4 rounded-full bg-red-500"></div>}
            {isCancelled && <div className="h-4 w-4 rounded-full bg-amber-500"></div>}
            
            <h3 className="text-lg font-medium">
              {isProcessing && 'Processing Data...'}
              {isCompleted && 'Deduplication Complete'}
              {isFailed && 'Deduplication Failed'}
              {isCancelled && 'Deduplication Cancelled'}
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onRefresh}
                disabled={isProcessing}
                className="h-8 px-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            
            {onCancel && isProcessing && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={onCancel}
                className="h-8 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Display warning alert for local fallback */}
        {progress.warning && (
          <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Local Processing Mode</AlertTitle>
            <AlertDescription>
              {progress.warning}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Status:</span>
            <span className="font-medium">
              {progress.statusMessage || 'Processing...'}
            </span>
          </div>
          
          {jobId && (
            <div className="flex justify-between text-sm">
              <span>Job ID:</span>
              <span className="font-mono text-xs">{jobId}</span>
            </div>
          )}
          
          {progress.recordsProcessed !== undefined && progress.totalRecords && (
            <div className="flex justify-between text-sm">
              <span>Records:</span>
              <span>
                {progress.recordsProcessed.toLocaleString()} / {progress.totalRecords.toLocaleString()}
              </span>
            </div>
          )}
          
          {progress.chunked && (
            <div className="flex justify-between text-sm">
              <span>Chunk:</span>
              <span>
                {progress.currentChunk} / {progress.totalChunks}
              </span>
            </div>
          )}
        </div>
        
        <Progress value={progress.percentage || 0} className="h-2" />
        
        {progress.error && (
          <div className="mt-4 text-sm text-red-500 bg-red-50 p-3 rounded border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            <p className="font-semibold mb-1">Error:</p>
            <p className="font-mono text-xs">{progress.error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressIndicator;
