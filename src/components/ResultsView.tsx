import React, { useState, useEffect } from 'react';
import { Download, FileCheck, Calculator, ArrowRight, BarChart3, Filter, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { DedupeResult, FileData, DownloadFormat } from '@/lib/types';
import { convertToCSV, downloadCSV } from '@/lib/dedupeService';
import { pollDedupeStatus } from '@/lib/sqlService';

interface ResultsViewProps {
  result: DedupeResult;
  fileData: FileData;
  onRefreshStatus?: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ result, fileData, onRefreshStatus }) => {
  const [deduplicatedCSV, setDeduplicatedCSV] = useState<string>('');
  const [flaggedCSV, setFlaggedCSV] = useState<string>('');
  const [hasProcessedData, setHasProcessedData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  
  useEffect(() => {
    console.log("ResultsView received result:", result);
    
    // Check if we have valid data to process
    if (result && Array.isArray(result.processedData) && result.processedData.length > 0) {
      try {
        // Generate CSVs from both data sets
        const deduplicated = convertToCSV(result.processedData);
        const flagged = Array.isArray(result.flaggedData) && result.flaggedData.length > 0 
          ? convertToCSV(result.flaggedData) 
          : 'No flagged data available';
        
        setDeduplicatedCSV(deduplicated);
        setFlaggedCSV(flagged);
        setHasProcessedData(true);
      } catch (error) {
        console.error('Error generating CSV data:', error);
        setHasProcessedData(false);
      }
    } else {
      console.warn('No valid processed data available in results');
      setHasProcessedData(false);
    }
  }, [result]);

  // Start a timer for jobs that are still processing
  useEffect(() => {
    let interval: number | null = null;
    
    if (!hasProcessedData && result?.jobId) {
      interval = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [hasProcessedData, result?.jobId]);

  const handleRefresh = () => {
    if (onRefreshStatus) {
      setIsRefreshing(true);
      setLastRefreshed(new Date());
      onRefreshStatus();
      
      // Reset refreshing state after a short delay
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1500);
    }
  };

  const handleDownload = (format: DownloadFormat) => {
    const baseFileName = fileData.fileName.replace(/\.[^/.]+$/, '');
    
    if (format === 'deduplicated' && deduplicatedCSV) {
      downloadCSV(deduplicatedCSV, `${baseFileName}_deduplicated.csv`);
    } else if (format === 'flagged' && flaggedCSV) {
      downloadCSV(flaggedCSV, `${baseFileName}_flagged.csv`);
    }
  };

  // Use zero values as fallbacks for undefined properties
  const originalRows = result?.originalRows || 0;
  const uniqueRows = result?.uniqueRows || 0;
  const duplicateRows = result?.duplicateRows || 0;
  const percentReduction = originalRows > 0 ? Math.round((duplicateRows / originalRows) * 100) : 0;
  
  // Format processing time (convert ms to seconds with 2 decimal places)
  const formattedProcessingTime = result?.processingTimeMs 
    ? (result.processingTimeMs / 1000).toFixed(2) 
    : 'N/A';

  // Calculate records per second
  const recordsPerSecond = result?.processingTimeMs && result.processingTimeMs > 0 && originalRows > 0
    ? Math.round(originalRows / (result.processingTimeMs / 1000))
    : 0;

  // Format elapsed time
  const formatElapsedTime = () => {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Handle the case where we don't have processed data yet
  if (!hasProcessedData) {
    return (
      <div className="w-full max-w-3xl mx-auto animate-fade-in">
        <div className="bg-card rounded-lg border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-medium">Processing Results</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing || !onRefreshStatus}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {result?.jobId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Spinner size="sm" variant="default" showLabel={false} />
                <p className="text-muted-foreground">
                  Job ID: <span className="font-mono text-sm">{result.jobId}</span>
                </p>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Status:</span>
                  <span className="font-medium text-primary">Processing</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Started:</span>
                  <span className="font-medium">{result?.startTime ? new Date(result.startTime).toLocaleTimeString() : 'Unknown'}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Elapsed time:</span>
                  <span className="font-medium font-mono">{formatElapsedTime()}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Initial records:</span>
                  <span className="font-medium">{originalRows > 0 ? originalRows.toLocaleString() : 'Loading...'}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Last refreshed:</span>
                  <span className="font-medium">{lastRefreshed.toLocaleTimeString()}</span>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm mb-2">Progress (estimating...):</p>
                <Progress value={15} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Your data is being processed. The results will be available soon.
                  {originalRows > 10000 && " Processing large datasets may take a few minutes."}
                </p>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded border border-amber-200 dark:border-amber-900 mt-4">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  The deduplication is still running. You can refresh to check the status or return to this page later.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Spinner size="sm" variant="warning" showLabel={false} />
                <p className="text-muted-foreground">
                  Waiting for processing information...
                </p>
              </div>
              
              <p className="text-muted-foreground">
                No job information available yet. This could be because:
                <ul className="list-disc list-inside mt-2 text-left pl-4">
                  <li>The deduplication process is still initializing</li>
                  <li>There was an error during processing</li>
                  <li>The results format was unexpected</li>
                </ul>
              </p>
              
              <Button onClick={handleRefresh} className="mt-4" disabled={isRefreshing || !onRefreshStatus}>
                Check Status
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card rounded-lg border p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-2xl font-bold">{uniqueRows}</h3>
          <p className="text-muted-foreground">Unique Records</p>
          <p className="text-xs text-muted-foreground mt-2">
            {percentReduction}% reduction from original
          </p>
        </div>
        
        <div className="bg-card rounded-lg border p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">{originalRows}</span>
            <ArrowRight className="h-5 w-5" />
            <span className="text-2xl font-bold">{uniqueRows}</span>
          </div>
          <p className="text-muted-foreground">Total Records</p>
          <p className="text-xs text-muted-foreground mt-2">
            {duplicateRows} duplicates removed
          </p>
        </div>
        
        <div className="bg-card rounded-lg border p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h3 className="text-2xl font-bold">{formattedProcessingTime}s</h3>
          <p className="text-muted-foreground">Processing Time</p>
          <p className="text-xs text-muted-foreground mt-2">
            {recordsPerSecond > 0 ? `${recordsPerSecond.toLocaleString()} records/sec` : ''}
          </p>
        </div>
      </div>
      
      <div className="bg-card rounded-lg border overflow-hidden mb-8">
        <div className="p-4 border-b bg-secondary/50 flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Deduplication Results</h3>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <h4 className="font-medium mb-2">Summary</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Processed file:</span>
                <span>{fileData.fileName}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Original records:</span>
                <span>{originalRows}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Unique records:</span>
                <span>{uniqueRows}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Duplicate records:</span>
                <span>{duplicateRows}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Duplicate clusters:</span>
                <span>{result.clusters ? result.clusters.filter(c => c?.length > 1).length : 0}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Processing time:</span>
                <span>{formattedProcessingTime} seconds</span>
              </li>
              {recordsPerSecond > 0 && (
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Processing speed:</span>
                  <span>{recordsPerSecond.toLocaleString()} records/second</span>
                </li>
              )}
            </ul>
          </div>
          
          <div className="mb-6">
            <h4 className="font-medium mb-2">Preview</h4>
            <div className="bg-muted/40 rounded-md p-3 overflow-auto max-h-[200px] text-sm font-mono">
              {result.processedData && result.processedData.length > 0 ? (
                <pre>
                  {Object.keys(result.processedData[0]).join(', ')}{'\n'}
                  {result.processedData.slice(0, 5).map((row, i) => (
                    <div key={i} className="text-xs">
                      {Object.values(row).join(', ')}
                    </div>
                  ))}
                  {result.processedData.length > 5 && '...'}
                </pre>
              ) : (
                <p className="text-muted-foreground text-center">No data to preview</p>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium mb-2">Download Options</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                onClick={() => handleDownload('deduplicated')}
                className="flex items-center justify-center gap-2 btn-transition"
                disabled={!deduplicatedCSV}
              >
                <Download className="h-4 w-4" />
                Deduplicated Data
              </Button>
              
              <Button 
                onClick={() => handleDownload('flagged')}
                variant="outline"
                className="flex items-center justify-center gap-2 btn-transition"
                disabled={!flaggedCSV}
              >
                <Filter className="h-4 w-4" />
                Flagged Data
              </Button>
            </div>
            <div className="text-xs text-muted-foreground pt-2">
              <p><strong>Deduplicated Data:</strong> Only unique records, duplicates removed</p>
              <p><strong>Flagged Data:</strong> All records with duplicate flags and cluster IDs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;
