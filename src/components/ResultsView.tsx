
import React, { useState, useEffect } from 'react';
import { Download, FileCheck, Calculator, ArrowRight, BarChart3, Filter, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { DedupeResult, FileData, DownloadFormat } from '@/lib/types';
import { convertToCSV, downloadCSV } from '@/lib/dedupeService';

interface ResultsViewProps {
  result: DedupeResult;
  fileData: FileData;
}

const ResultsView: React.FC<ResultsViewProps> = ({ result, fileData }) => {
  const [deduplicatedCSV, setDeduplicatedCSV] = useState<string>('');
  const [flaggedCSV, setFlaggedCSV] = useState<string>('');
  
  useEffect(() => {
    // Generate CSVs from both data sets
    const deduplicated = convertToCSV(result.processedData);
    const flagged = convertToCSV(result.flaggedData);
    
    setDeduplicatedCSV(deduplicated);
    setFlaggedCSV(flagged);
  }, [result]);

  const handleDownload = (format: DownloadFormat) => {
    const baseFileName = fileData.fileName.replace(/\.[^/.]+$/, '');
    
    if (format === 'deduplicated') {
      downloadCSV(deduplicatedCSV, `${baseFileName}_deduplicated.csv`);
    } else if (format === 'flagged') {
      downloadCSV(flaggedCSV, `${baseFileName}_flagged.csv`);
    }
  };

  const percentReduction = Math.round((result.duplicateRows / result.originalRows) * 100);
  
  // Format processing time (convert ms to seconds with 2 decimal places)
  const formattedProcessingTime = result.processingTimeMs 
    ? (result.processingTimeMs / 1000).toFixed(2) 
    : 'N/A';

  // Calculate records per second
  const recordsPerSecond = result.processingTimeMs && result.processingTimeMs > 0
    ? Math.round(result.originalRows / (result.processingTimeMs / 1000))
    : 0;

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card rounded-lg border p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-2xl font-bold">{result.uniqueRows}</h3>
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
            <span className="text-2xl font-bold">{result.originalRows}</span>
            <ArrowRight className="h-5 w-5" />
            <span className="text-2xl font-bold">{result.uniqueRows}</span>
          </div>
          <p className="text-muted-foreground">Total Records</p>
          <p className="text-xs text-muted-foreground mt-2">
            {result.duplicateRows} duplicates removed
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
                <span>{result.originalRows}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Unique records:</span>
                <span>{result.uniqueRows}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Duplicate records:</span>
                <span>{result.duplicateRows}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Duplicate clusters:</span>
                <span>{result.clusters.filter(c => c.length > 1).length}</span>
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
              {result.processedData.length > 0 ? (
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
              >
                <Download className="h-4 w-4" />
                Deduplicated Data
              </Button>
              
              <Button 
                onClick={() => handleDownload('flagged')}
                variant="outline"
                className="flex items-center justify-center gap-2 btn-transition"
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
