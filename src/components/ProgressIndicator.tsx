
import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, XCircle, Info } from "lucide-react";
import { toast } from "sonner";

export interface DedupeProgress {
  status: 'waiting' | 'connecting' | 'loading' | 'processing' | 'blocked' | 'clustering' | 'completed' | 'failed' | 'cancelled';
  percentage: number;
  statusMessage: string;
  estimatedTimeRemaining?: string;
  recordsProcessed?: number;
  totalRecords?: number;
  error?: string;
  debugInfo?: string; // Added for detailed debugging information
}

interface ProgressIndicatorProps {
  progress: DedupeProgress;
  jobId?: string;
  onRefresh?: () => void;
  onCancel?: () => void;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress, jobId, onRefresh, onCancel }) => {
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [isLongRunning, setIsLongRunning] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [showDebugInfo, setShowDebugInfo] = useState<boolean>(false);
  const [lastProgressUpdate, setLastProgressUpdate] = useState<number>(Date.now());
  const [stalled, setStalled] = useState<boolean>(false);
  
  // Track when progress updates come in
  useEffect(() => {
    setLastProgressUpdate(Date.now());
    setStalled(false);
  }, [progress]);
  
  useEffect(() => {
    let timer: number | null = null;
    let stalledCheckTimer: number | null = null;

    // Only start the timer if process is running
    if (progress.status !== 'completed' && progress.status !== 'failed' && progress.status !== 'cancelled') {
      // Timer for elapsed time
      timer = window.setInterval(() => {
        setTimeElapsed(prev => {
          const newTime = prev + 1;
          
          // After 2 minutes, consider it a long-running job
          if (newTime > 120 && !isLongRunning) {
            setIsLongRunning(true);
            toast.info("This is taking longer than expected. Large datasets may require several minutes to process.");
          }
          
          return newTime;
        });
      }, 1000);
      
      // Timer to check if progress has stalled
      stalledCheckTimer = window.setInterval(() => {
        const timeSinceLastUpdate = Date.now() - lastProgressUpdate;
        // If no update in 15 seconds and not already marked as stalled
        if (timeSinceLastUpdate > 15000 && !stalled) {
          setStalled(true);
          console.warn(`Process appears to be stalled. No updates for ${Math.floor(timeSinceLastUpdate/1000)} seconds.`);
          toast.warning("Processing appears to be stalled. Browser may be unresponsive due to large data processing.", {
            duration: 10000,
            action: {
              label: "Cancel Job",
              onClick: () => onCancel && onCancel()
            }
          });
        }
      }, 5000);
    }

    return () => {
      if (timer !== null) {
        clearInterval(timer);
      }
      if (stalledCheckTimer !== null) {
        clearInterval(stalledCheckTimer);
      }
    };
  }, [progress.status, isLongRunning, lastProgressUpdate, stalled, onCancel]);

  // Format time elapsed
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'waiting':
      case 'connecting':
      case 'loading':
      case 'processing':
      case 'blocked':
      case 'clustering':
        return stalled ? 'text-red-500' : 'text-amber-500';
      case 'completed':
        return 'text-green-500';
      case 'failed':
      case 'cancelled':
        return 'text-red-500';
      default:
        return 'text-primary';
    }
  };

  const handleManualRefresh = () => {
    if (onRefresh) {
      toast.info("Requesting status update...");
      onRefresh();
    }
  };

  const handleCancelJob = () => {
    if (onCancel) {
      setIsCancelling(true);
      toast.info("Requesting job cancellation...");
      onCancel();
      // Don't reset isCancelling here - let the status update handle that
    }
  };

  const toggleDebugInfo = () => {
    setShowDebugInfo(!showDebugInfo);
    
    // If showing debug info, log current progress state to console
    if (!showDebugInfo) {
      console.log('Current progress state:', progress);
    }
  };

  // Reset cancelling state if status changes to cancelled or failed
  useEffect(() => {
    if (progress.status === 'cancelled' || progress.status === 'failed') {
      setIsCancelling(false);
    }
  }, [progress.status]);

  const isProcessing = progress.status !== 'completed' && progress.status !== 'failed' && progress.status !== 'cancelled';

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {isProcessing && <Spinner />}
          <span>Deduplication Progress</span>
          <span className={`text-sm font-normal ${getStatusColor()}`}>
            {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
            {stalled && " (Stalled)"}
          </span>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto h-6 w-6" 
            onClick={toggleDebugInfo}
            title="Toggle debug information"
          >
            <Info className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress.percentage} className="h-2 mb-2" />
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium">{progress.statusMessage}</p>
          
          {isProcessing && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Time elapsed:</p>
                <p className={`font-mono ${stalled ? 'text-red-500' : ''}`}>{formatTime(timeElapsed)}</p>
              </div>
              
              {progress.estimatedTimeRemaining && (
                <div>
                  <p className="text-muted-foreground">Est. time remaining:</p>
                  <p className="font-mono">{progress.estimatedTimeRemaining}</p>
                </div>
              )}
            </div>
          )}
          
          {progress.recordsProcessed !== undefined && progress.totalRecords !== undefined && (
            <div className="bg-muted p-2 rounded">
              <p className="flex justify-between">
                <span>Records processed:</span>
                <span className="font-mono">{progress.recordsProcessed.toLocaleString()} / {progress.totalRecords.toLocaleString()}</span>
              </p>
              <Progress
                value={(progress.recordsProcessed / progress.totalRecords) * 100}
                className="h-1 mt-1"
              />
            </div>
          )}
          
          {/* Show debug information if enabled */}
          {showDebugInfo && (
            <div className="mt-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
              <p className="text-xs font-bold mb-1">Debug Information:</p>
              <div className="text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap">
                <p>Status: {progress.status}</p>
                <p>Percentage: {progress.percentage}%</p>
                <p>Last update: {new Date(lastProgressUpdate).toISOString()}</p>
                <p>Time since update: {Math.floor((Date.now() - lastProgressUpdate)/1000)}s</p>
                <p>Stalled: {stalled ? 'Yes' : 'No'}</p>
                {progress.debugInfo && <p>Details: {progress.debugInfo}</p>}
                {jobId && <p>Job ID: {jobId}</p>}
              </div>
            </div>
          )}
          
          {isLongRunning && isProcessing && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Long-running job detected</p>
                <p className="text-xs mt-1">
                  Large datasets or complex matching configurations may take several minutes to complete.
                  {jobId && <span> Job ID: {jobId}</span>}
                </p>
              </div>
            </div>
          )}
          
          {progress.error && (
            <p className="mt-2 text-destructive">
              Error: {progress.error}
            </p>
          )}
        </div>
      </CardContent>
      
      {isProcessing && (
        <CardFooter className="pt-0 flex justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancelJob}
            disabled={isCancelling}
            className="flex items-center gap-1 text-xs"
          >
            <XCircle className="h-3 w-3" />
            {isCancelling ? 'Cancelling...' : 'Cancel Job'}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            className="flex items-center gap-1 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh Status
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default ProgressIndicator;
