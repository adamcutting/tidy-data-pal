
import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export interface DedupeProgress {
  status: 'waiting' | 'connecting' | 'loading' | 'processing' | 'blocked' | 'clustering' | 'completed' | 'failed';
  percentage: number;
  statusMessage: string;
  estimatedTimeRemaining?: string;
  recordsProcessed?: number;
  totalRecords?: number;
  error?: string;
}

interface ProgressIndicatorProps {
  progress: DedupeProgress;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress }) => {
  const getStatusColor = () => {
    switch (progress.status) {
      case 'waiting':
      case 'connecting':
      case 'loading':
      case 'processing':
      case 'blocked':
      case 'clustering':
        return 'text-amber-500';
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-primary';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {progress.status !== 'completed' && progress.status !== 'failed' && <Spinner />}
          <span>Deduplication Progress</span>
          <span className={`text-sm font-normal ${getStatusColor()}`}>
            {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={progress.percentage} className="h-2 mb-2" />
        
        <div className="text-sm text-muted-foreground">
          <p>{progress.statusMessage}</p>
          
          {progress.recordsProcessed !== undefined && progress.totalRecords !== undefined && (
            <p className="mt-1 text-xs">
              Processed {progress.recordsProcessed.toLocaleString()} of {progress.totalRecords.toLocaleString()} records
            </p>
          )}
          
          {progress.estimatedTimeRemaining && (
            <p className="mt-1 text-xs">
              Estimated time remaining: {progress.estimatedTimeRemaining}
            </p>
          )}
          
          {progress.error && (
            <p className="mt-2 text-destructive">
              Error: {progress.error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgressIndicator;
