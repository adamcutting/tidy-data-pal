
import React, { useState, useEffect } from 'react';
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

  const handleFileLoaded = (data: FileData) => {
    setFileData(data);
    markStepCompleted('upload');
    goToNextStep('mapping');
  };

  const handleSqlConnect = async (
    dbType: DatabaseType,
    config: MySQLConfig | MSSQLConfig,
    query: string,
    isTable: boolean
  ) => {
    setIsProcessing(true);
    
    try {
      // Load data from the database
      const data = await loadDatabaseData(
        dbType, 
        config, 
        query, 
        isTable,
        setProgress
      );
      
      // Create a FileData object from the database data
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
  };

  const handleMappingComplete = (columns: MappedColumn[]) => {
    setMappedColumns(columns);
    markStepCompleted('mapping');
    goToNextStep('config');
  };

  const handleConfigComplete = async (config: DedupeConfigType) => {
    // Add data source info to the config
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
        // Start deduplication process
        const result = await deduplicateData(fileData.data, mappedColumns, fullConfig, 
          // Progress callback function
          (progress) => {
            setProgress(progress);
          }
        );
        
        setDedupeResult(result);
        markStepCompleted('progress');
        goToNextStep('results');
        
        toast.success(`Deduplication complete! Found ${result.duplicateRows} duplicate records.`);
        
        // If we have a job ID, poll for updates until complete
        if (result.jobId) {
          pollDedupeStatus(result.jobId, setProgress);
        }
      } catch (error) {
        console.error('Deduplication error:', error);
        
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
    }
  };

  const markStepCompleted = (step: Step) => {
    setCompletedSteps(prev => new Set(prev).add(step));
  };

  const goToNextStep = (step: Step) => {
    setCurrentStep(step);
  };

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
            <ProgressIndicator progress={progress} />
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
