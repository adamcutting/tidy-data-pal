import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Database } from 'lucide-react';
import SourceSelector from '@/components/SourceSelector';
import ColumnMapping from '@/components/ColumnMapping';
import DedupeConfig from '@/components/DedupeConfig';
import ResultsView from '@/components/ResultsView';
import ProgressIndicator from '@/components/ProgressIndicator';
import StepIndicator from '@/components/StepIndicator';
import { 
  FileData, 
  MappedColumn, 
  DedupeConfig as DedupeConfigType, 
  DedupeResult, 
  Step, 
  DedupeProgress,
  DatabaseType,
  MySQLConfig,
  MSSQLConfig
} from '@/lib/types';
import { deduplicateData } from '@/lib/dedupeService';
import { loadDatabaseData, pollDedupeStatus } from '@/lib/sqlService';
import { cancelSplinkJob } from '@/lib/splinkAdapter';

const Index = () => {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [mappedColumns, setMappedColumns] = useState<MappedColumn[]>([]);
  const [dedupeConfig, setDedupeConfig] = useState<DedupeConfigType | null>(null);
  const [dedupeResult, setDedupeResult] = useState<DedupeResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<DedupeProgress>({
    status: 'waiting',
    percentage: 0,
    statusMessage: 'Waiting to start...'
  });

  const handleFileLoaded = useCallback((data: FileData) => {
    setFileData(data);
    markStepCompleted('upload');
    goToNextStep('mapping');
  }, []);

  const handleSqlConnect = useCallback(async (
    dbType: DatabaseType,
    config: MySQLConfig | MSSQLConfig,
    query: string,
    isTable: boolean
  ) => {
    setIsProcessing(true);
    
    try {
      const data = await loadDatabaseData(
        dbType, 
        config, 
        query, 
        isTable,
        setProgress
      );
      
      const dbFileData: FileData = {
        fileName: isTable ? query : 'sql_query_result',
        fileType: 'database',
        data: data,
        rawData: null,
        columns: data.length > 0 ? Object.keys(data[0]) : []
      };
      
      setFileData(dbFileData);
      markStepCompleted('upload');
      goToNextStep('mapping');
      
      toast.success(`Successfully loaded ${data.length} records from database`);
    } catch (error) {
      console.error('Database connection error:', error);
      toast.error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleMappingComplete = useCallback((columns: MappedColumn[]) => {
    setMappedColumns(columns);
    markStepCompleted('mapping');
    goToNextStep('config');
  }, []);

  const handleConfigComplete = useCallback(async (config: DedupeConfigType) => {
    const fullConfig: DedupeConfigType = {
      ...config,
      dataSource: fileData?.fileType === 'database' ? 'database' : 'file',
    };
    
    setDedupeConfig(fullConfig);
    markStepCompleted('config');
    
    if (fileData) {
      setIsProcessing(true);
      goToNextStep('progress');
      
      setProgress({
        status: 'waiting',
        percentage: 0,
        statusMessage: 'Initializing deduplication process...'
      });
      
      toast.info('Starting deduplication process...');
      
      try {
        setTimeout(async () => {
          try {
            const dataSize = fileData.data.length;
            
            if (dataSize > 10000) {
              toast.info(`Processing a large dataset (${dataSize.toLocaleString()} records). This may take some time.`);
            }
            
            const result = await deduplicateData(
              fileData.data, 
              mappedColumns, 
              fullConfig, 
              (progressUpdate) => {
                setProgress(progressUpdate);
                
                if (progressUpdate.status === 'processing' && progressUpdate.percentage > 0 && progressUpdate.percentage % 10 === 0) {
                  console.log(`Progress update: ${progressUpdate.percentage}% - ${progressUpdate.statusMessage}`);
                }
              }
            );
            
            setDedupeResult(result);
            markStepCompleted('progress');
            
            if (result.jobId) {
              if (result.processedData.length > 0) {
                goToNextStep('results');
                toast.success(`Deduplication complete! Found ${result.duplicateRows} duplicate records.`);
              } else {
                pollDedupeStatus(result.jobId, (progressUpdate) => {
                  setProgress(progressUpdate);
                  
                  if (progressUpdate.status === 'completed') {
                    markStepCompleted('progress');
                    goToNextStep('results');
                    toast.success(`Deduplication complete! Check results tab for details.`);
                  } else if (progressUpdate.status === 'failed') {
                    toast.error(`Deduplication failed: ${progressUpdate.error || 'Unknown error'}`);
                  } else if (progressUpdate.status === 'cancelled') {
                    toast.info(`Deduplication job was cancelled.`);
                  }
                });
              }
            } else {
              goToNextStep('results');
              toast.success(`Deduplication complete! Found ${result.duplicateRows} duplicate records.`);
            }
          } catch (error) {
            console.error('Deduplication error inside timeout:', error);
            
            setProgress({
              status: 'failed',
              percentage: 0,
              statusMessage: 'Deduplication process failed',
              error: error instanceof Error ? error.message : 'Unknown error occurred'
            });
            
            toast.error(`Error during deduplication process: ${error instanceof Error ? error.message : 'Please try again'}`);
          } finally {
            setIsProcessing(false);
          }
        }, 100);
      } catch (error) {
        console.error('Deduplication error:', error);
        
        setProgress({
          status: 'failed',
          percentage: 0,
          statusMessage: 'Deduplication process failed',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
        
        toast.error(`Error during deduplication process: ${error instanceof Error ? error.message : 'Please try again'}`);
        setIsProcessing(false);
      }
    }
  }, [fileData, mappedColumns]);

  const handleRefreshStatus = useCallback(() => {
    if (dedupeResult?.jobId) {
      setProgress(prev => ({
        ...prev,
        statusMessage: `Refreshing status for job ${dedupeResult.jobId}...`
      }));
      
      pollDedupeStatus(dedupeResult.jobId, setProgress);
    }
  }, [dedupeResult]);

  const handleCancelJob = useCallback(async () => {
    if (dedupeResult?.jobId) {
      try {
        const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/deduplicate';
        const apiKey = process.env.REACT_APP_API_KEY;
        
        const result = await cancelSplinkJob(dedupeResult.jobId, apiBaseUrl, apiKey);
        
        if (result.success) {
          toast.success(result.message);
          
          setProgress(prev => ({
            ...prev,
            statusMessage: 'Cancellation requested. Waiting for confirmation...'
          }));
          
          setTimeout(() => {
            if (dedupeResult?.jobId) {
              pollDedupeStatus(dedupeResult.jobId, setProgress);
            }
          }, 1000);
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        console.error('Error cancelling job:', error);
        toast.error(`Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [dedupeResult]);

  const markStepCompleted = useCallback((step: Step) => {
    setCompletedSteps(prev => new Set(prev).add(step));
  }, []);

  const goToNextStep = useCallback((step: Step) => {
    setCurrentStep(step);
  }, []);

  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <SourceSelector 
            onFileLoaded={handleFileLoaded} 
            onSqlConnect={handleSqlConnect}
            isConnecting={isProcessing}
          />
        );
        
      case 'mapping':
        return fileData ? (
          <ColumnMapping fileData={fileData} onMappingComplete={handleMappingComplete} />
        ) : (
          <div className="text-center">
            <p>Please upload a file or connect to a database first</p>
          </div>
        );
        
      case 'config':
        return mappedColumns.length > 0 ? (
          <DedupeConfig 
            mappedColumns={mappedColumns} 
            onConfigComplete={handleConfigComplete}
            isProcessing={isProcessing}
          />
        ) : (
          <div className="text-center">
            <p>Please map columns first</p>
          </div>
        );
      
      case 'progress':
        return (
          <div className="w-full max-w-2xl mx-auto">
            <ProgressIndicator 
              progress={progress} 
              jobId={dedupeResult?.jobId}
              onRefresh={handleRefreshStatus}
              onCancel={handleCancelJob}
            />
          </div>
        );
        
      case 'results':
        return fileData && dedupeResult ? (
          <ResultsView result={dedupeResult} fileData={fileData} />
        ) : (
          <div className="text-center">
            <p>No results available yet</p>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full py-6 px-4 sm:px-6 lg:px-8 border-b bg-[#403E43] text-white">
        <div className="container max-w-screen-xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-[#1EAEDB]" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight animate-fade-in">
                  Data HQ Dedupe
                </h1>
                <p className="text-muted-foreground animate-fade-in text-gray-300">
                  Streamline your data by removing duplicates with ease
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-screen-xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <StepIndicator 
            currentStep={currentStep} 
            setStep={setCurrentStep} 
            completedSteps={completedSteps} 
          />
        </div>
        
        <div className="py-4 animate-fade-in">
          {renderStepContent()}
        </div>
      </main>

      <footer className="w-full py-6 border-t mt-auto bg-[#403E43] text-white">
        <div className="container max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-300">
              &copy; {new Date().getFullYear()} Data HQ. All rights reserved.
            </p>
            <p className="text-xs text-gray-300">
              A tool for powerful data deduplication
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
