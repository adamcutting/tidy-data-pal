import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, XCircle, Info, Cpu, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export interface DedupeProgress {
  status: 'waiting' | 'connecting' | 'loading' | 'processing' | 'blocked' | 'clustering' | 'completed' | 'failed' | 'cancelled';
  percentage: number;
  statusMessage: string;
  estimatedTimeRemaining?: string;
  recordsProcessed?: number;
  totalRecords?: number;
  error?: string;
  debugInfo?: string;
  stage?: string;
  currentChunk?: number;
  totalChunks?: number;
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
  const [lastPercentage, setLastPercentage] = useState<number>(progress.percentage || 0);
  const [frozenTime, setFrozenTime] = useState<number>(0);
  
  useEffect(() => {
    const now = Date.now();
    setLastProgressUpdate(now);
    
    if (progress.percentage !== lastPercentage) {
      setLastPercentage(progress.percentage);
      setStalled(false);
      setFrozenTime(0);
    }
  }, [progress, lastPercentage]);
  
  useEffect(() => {
    let timer: number | null = null;
    let stalledCheckTimer: number | null = null;

    if (progress.status !== 'completed' && progress.status !== 'failed' && progress.status !== 'cancelled') {
      timer = window.setInterval(() => {
        setTimeElapsed(prev => {
          const newTime = prev + 1;
          
          if (newTime > 120 && !isLongRunning) {
            setIsLongRunning(true);
            toast.info("This is taking longer than expected. Large datasets may require several minutes to process.");
          }
          
          return newTime;
        });
      }, 1000);
      
      stalledCheckTimer = window.setInterval(() => {
        const timeSinceLastUpdate = Date.now() - lastProgressUpdate;
        
        if (progress.percentage === lastPercentage) {
          setFrozenTime(prev => prev + 1);
        } else {
          setFrozenTime(0);
        }
        
        if (timeSinceLastUpdate > 10000 && !stalled) {
          setStalled(true);
          console.warn(`Process appears to be stalled. No updates for ${Math.floor(timeSinceLastUpdate/1000)} seconds.`);
          toast.warning("Processing appears to be stalled. The application may be processing a large amount of data.", {
            duration: 10000,
            action: {
              label: "Cancel Job",
              onClick: () => onCancel && onCancel()
            }
          });
        }
      }, 1000);
    }

    return () => {
      if (timer !== null) {
        clearInterval(timer);
      }
      if (stalledCheckTimer !== null) {
        clearInterval(stalledCheckTimer);
      }
    };
  }, [progress.status, isLongRunning, lastProgressUpdate, lastPercentage, stalled, frozenTime, onCancel]);

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

  const getStageIcon = () => {
    if (!progress.stage) return null;
    
    switch (progress.stage) {
      case 'initialization':
      case 'preparation':
        return <Cpu className="h-4 w-4 animate-pulse" />;
      default:
        return null;
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
    }
  };

  const toggleDebugInfo = () => {
    setShowDebugInfo(!showDebugInfo);
    
    if (!showDebugInfo) {
      console.log('Current progress state:', progress);
    }
  };

  useEffect(() => {
    if (progress.status === 'cancelled' || progress.status === 'failed') {
      setIsCancelling(false);
    }
  }, [progress.status]);

  const isProcessing = progress.status !== 'completed' && progress.status !== 'failed' && progress.status !== 'cancelled';
  const isCompleted = progress.status === 'completed';

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {isProcessing && <Spinner 
            size="md" 
            variant={stalled ? "destructive" : "default"} 
          />}
          {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
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
        <Progress 
          value={progress.percentage} 
          className={`h-2 mb-2 ${isCompleted ? 'bg-green-100' : ''}`} 
        />
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p className={`font-medium flex items-center gap-2 ${isCompleted ? 'text-green-600' : ''}`}>
            {getStageIcon()}
            {progress.statusMessage}
            {progress.stage && <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{progress.stage}</span>}
          </p>
          
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
                className={`h-1 mt-1 ${isCompleted ? 'bg-green-100' : ''}`}
              />
            </div>
          )}
          
          {progress.currentChunk !== undefined && progress.totalChunks !== undefined && (
            <div className="bg-muted p-2 rounded mt-2">
              <p className="flex justify-between">
                <span>Chunk progress:</span>
                <span className="font-mono">{progress.currentChunk} / {progress.totalChunks}</span>
              </p>
              <Progress
                value={(progress.currentChunk / progress.totalChunks) * 100}
                className="h-1 mt-1"
              />
            </div>
          )}
          
          {isProcessing && stalled && (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded mt-2 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <Spinner size="sm" variant="destructive" />
                <span className="text-red-700 dark:text-red-400 font-medium">
                  UI Thread Blocked
                </span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-500">
                The application appears to be frozen. Processing large datasets may cause temporary unresponsiveness.
              </p>
              <div className="mt-2">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="w-full text-xs"
                  onClick={onCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel Processing'}
                </Button>
              </div>
            </div>
          )}
          
          {isProcessing && !stalled && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded mt-2 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 mb-2">
                <Spinner size="sm" variant="warning" />
                <span className="text-yellow-700 dark:text-yellow-400 font-medium">
                  Processing in Background
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                The application is processing your data. You can continue to use other parts of the application during this time.
              </p>
            </div>
          )}
          
          {stalled && (
            <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800 mt-2">
              <p className="flex justify-between text-red-700 dark:text-red-400">
                <span>UI unresponsive for:</span>
                <span className="font-mono">{formatTime(frozenTime)}</span>
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                The browser main thread may be blocked by intensive processing.
              </p>
            </div>
          )}
          
          {showDebugInfo && (
            <div className="mt-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
              <p className="text-xs font-bold mb-1">Debug Information:</p>
              <div className="text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap">
                <p>Status: {progress.status}</p>
                <p>Stage: {progress.stage || 'not specified'}</p>
                <p>Percentage: {progress.percentage}%</p>
                <p>Last update: {new Date(lastProgressUpdate).toISOString()}</p>
                <p>Time since update: {Math.floor((Date.now() - lastProgressUpdate)/1000)}s</p>
                <p>Stalled: {stalled ? 'Yes' : 'No'}</p>
                <p>Frozen time: {frozenTime}s</p>
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
      
      {isCompleted && (
        <CardFooter className="pt-0 flex justify-end">
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
