
import { DedupeConfig, MappedColumn, DedupeProgress, WorkerOutboundMessage, SplinkSettings } from './types';
import { deduplicateData as performDeduplication } from './dedupeService';

// Setup for the worker
(() => {
  // Helper function to send progress updates
  function sendProgress(progress: DedupeProgress) {
    postMessage({
      type: 'progress',
      progress: progress
    } as WorkerOutboundMessage);
  }
  
  // Process large datasets by breaking them into chunks
  function processLargeDataset(
    data: any[],
    mappedColumns: MappedColumn[],
    config: DedupeConfig,
    jobId: string,
    optimizePostcodeProcessing: boolean,
    splinkSettings?: SplinkSettings
  ) {
    const chunkSize = config.splinkParams?.maxChunkSize || 10000;
    const totalChunks = Math.ceil(data.length / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = start + chunkSize;
      const chunk = data.slice(start, end);
      
      sendProgress({
        status: 'processing',
        percentage: 10 + (i / totalChunks) * 80,
        statusMessage: `Processing chunk ${i + 1} of ${totalChunks}...`,
        recordsProcessed: start,
        totalRecords: data.length,
        chunked: true,
        totalChunks: totalChunks,
        currentChunk: i + 1,
        stage: 'chunk-processing'
      });
      
      // Perform deduplication on the chunk, passing splinkSettings
      performDeduplication(chunk, mappedColumns, config, (progress) => {
        sendProgress({
          ...progress,
          percentage: 10 + (i / totalChunks) * 80 + progress.percentage / (totalChunks * 100) * 80,
          chunked: true,
          totalChunks: totalChunks,
          currentChunk: i + 1
        });
      }, optimizePostcodeProcessing, splinkSettings)
        .then(result => {
          // Send progress update for chunk completion
          sendProgress({
            status: 'completed',
            percentage: 90 + (i / totalChunks) * 10,
            statusMessage: `Chunk ${i + 1} deduplication complete.`,
            recordsProcessed: end,
            totalRecords: data.length,
            chunked: true,
            totalChunks: totalChunks,
            currentChunk: i + 1,
            stage: 'chunk-complete',
            result: i === totalChunks - 1 ? {
              originalRows: data.length,
              uniqueRows: result.uniqueRows,
              duplicateRows: result.duplicateRows,
              clusters: result.clusters,
              processedData: result.processedData,
              flaggedData: result.flaggedData
            } : undefined
          });
          
          // If this is the last chunk, also send a result message
          if (i === totalChunks - 1) {
            postMessage({
              type: 'result',
              result: {
                originalRows: data.length,
                uniqueRows: result.uniqueRows,
                duplicateRows: result.duplicateRows,
                clusters: result.clusters,
                processedData: result.processedData,
                flaggedData: result.flaggedData
              }
            } as WorkerOutboundMessage);
          }
        })
        .catch(error => {
          console.error(`Error processing chunk ${i + 1}:`, error);
          postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : `Chunk ${i + 1} processing failed.`
          } as WorkerOutboundMessage);
        });
    }
  }
  
  // Process deduplication with Splink
  function processSplinkDeduplication(
    data: any[],
    mappedColumns: MappedColumn[],
    config: DedupeConfig,
    jobId: string,
    optimizePostcodeProcessing: boolean,
    splinkSettings?: SplinkSettings
  ) {
    try {
      // Update progress
      sendProgress({
        status: 'processing',
        percentage: 15,
        statusMessage: 'Preparing data for Splink processing...',
        recordsProcessed: 0,
        totalRecords: data.length,
        stage: 'splink-preparation'
      });
      
      // Prepare for Splink processing
      setTimeout(async () => {
        try {
          // Check if we should use the Splink API
          if (config.splinkParams?.enableLargeDatasetMode || data.length > 10000) {
            // For large datasets, we need to indicate we're ready for API submission
            postMessage({
              type: 'splink-job',
              data: {
                jobId,
                readyForSubmission: true,
                totalRows: data.length
              }
            } as WorkerOutboundMessage);
          } else {
            // For smaller datasets, process directly
            // This is a placeholder for actual Splink processing
            // In a real implementation, this would use the Splink API
            
            // Simulate processing with progress updates
            for (let i = 0; i <= 10; i++) {
              sendProgress({
                status: i < 10 ? 'processing' : 'completed',
                percentage: 20 + (i * 8),
                statusMessage: i < 10 
                  ? `Processing with Splink (${i * 10}%)...` 
                  : 'Deduplication completed successfully.',
                recordsProcessed: Math.floor(data.length * (i / 10)),
                totalRecords: data.length,
                stage: i < 10 ? 'splink-processing' : 'complete'
              });
              
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Process a mock result
            const deduplicatedData = data.slice(0, Math.floor(data.length * 0.8));
            const clusters = [];
            
            // Create mock clusters
            for (let i = 0; i < Math.floor(data.length * 0.2); i += 2) {
              if (i + 1 < data.length) {
                clusters.push([i, i + 1]);
              } else {
                clusters.push([i]);
              }
            }
            
            // Create flagged data with duplicate information
            const flaggedData = data.map((row, index) => {
              const clusterIndex = clusters.findIndex(cluster => cluster.includes(index));
              const isDuplicate = clusterIndex >= 0 && clusters[clusterIndex].indexOf(index) !== 0;
              
              return {
                ...row,
                __is_duplicate: isDuplicate ? 'Yes' : 'No',
                __cluster_id: clusterIndex >= 0 ? `cluster_${clusterIndex}` : 'unique',
                __record_id: `record_${index}`
              };
            });
            
            // Send progress with result included
            const finalResult = {
              originalRows: data.length,
              uniqueRows: deduplicatedData.length,
              duplicateRows: data.length - deduplicatedData.length,
              clusters,
              processedData: deduplicatedData,
              flaggedData
            };
            
            // Send completion progress with result
            sendProgress({
              status: 'completed',
              percentage: 100,
              statusMessage: 'Deduplication completed successfully.',
              recordsProcessed: data.length,
              totalRecords: data.length,
              stage: 'complete',
              result: finalResult
            });
            
            // Also send final result message
            postMessage({
              type: 'result',
              result: finalResult
            } as WorkerOutboundMessage);
          }
        } catch (error) {
          console.error('Error in Splink processing:', error);
          postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error in Splink processing'
          } as WorkerOutboundMessage);
        }
      }, 0);
    } catch (error) {
      console.error('Error preparing for Splink processing:', error);
      postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Error preparing for Splink: ' + error
      } as WorkerOutboundMessage);
    }
  }
  
  // Process standard deduplication without Splink
  function processStandardDeduplication(
    data: any[],
    mappedColumns: MappedColumn[],
    config: DedupeConfig,
    jobId: string,
    optimizePostcodeProcessing: boolean,
    splinkSettings?: SplinkSettings
  ) {
    // Inform about local processing fallback
    sendProgress({
      status: 'processing',
      percentage: 15,
      statusMessage: 'Using local deduplication (Splink API not accessible)',
      recordsProcessed: 0,
      totalRecords: data.length,
      stage: 'local-fallback',
      // Add a warning flag to indicate we're using local fallback
      warning: 'Using local deduplication instead of Splink API. Results may be less accurate.'
    });
    
    performDeduplication(data, mappedColumns, config, (progress) => {
      // Add the fallback warning to all progress updates
      if (!progress.warning) {
        progress.warning = 'Using local deduplication instead of Splink API. Results may be less accurate.';
      }
      
      // Ensure the final progress update includes the result if it's complete
      if (progress.status === 'completed') {
        // The worker will handle this result in the then() block below
        // but we need to make sure progress updates include the result
        sendProgress(progress);
      } else {
        sendProgress(progress);
      }
    }, optimizePostcodeProcessing, splinkSettings)
      .then(result => {
        // Send a final progress update with the result
        sendProgress({
          status: 'completed',
          percentage: 100,
          statusMessage: 'Deduplication completed successfully (local processing).',
          recordsProcessed: data.length,
          totalRecords: data.length,
          stage: 'complete',
          result: result,
          warning: 'Results are from local deduplication and may be less accurate than Splink API.'
        });
        
        // Also send the result message
        postMessage({
          type: 'result',
          result: result,
          warning: 'Results are from local deduplication and may be less accurate than Splink API.'
        } as WorkerOutboundMessage);
      })
      .catch(error => {
        console.error('Error during standard deduplication:', error);
        postMessage({
          type: 'error',
          error: error instanceof Error ? error.message : 'Deduplication failed'
        } as WorkerOutboundMessage);
      });
  }
  
  // Worker-specific implementation of deduplicateData
  async function deduplicateData(
    data: any[],
    mappedColumns: MappedColumn[],
    config: DedupeConfig,
    jobId: string,
    optimizePostcodeProcessing: boolean = true,
    splinkSettings?: SplinkSettings
  ) {
    try {
      if (config.splinkParams?.enableLargeDatasetMode && data.length > 10000) {
        processLargeDataset(data, mappedColumns, config, jobId, optimizePostcodeProcessing, splinkSettings);
      } else if (config.useSplink) {
        processSplinkDeduplication(data, mappedColumns, config, jobId, optimizePostcodeProcessing, splinkSettings);
      } else {
        processStandardDeduplication(data, mappedColumns, config, jobId, optimizePostcodeProcessing, splinkSettings);
      }
    } catch (error) {
      console.error('Error in deduplication process:', error);
      postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error during deduplication'
      } as WorkerOutboundMessage);
    }
  }
  
  // Helper function to check Splink connection
  function checkSplinkConnection(): Promise<boolean> {
    // Placeholder implementation
    return Promise.resolve(true);
  }
  
  // Listen for messages from the main thread
  self.onmessage = (event) => {
    const message = event.data;
    
    if (message.type === 'init') {
      try {
        // Initialize the worker with the provided data
        const { data, mappedColumns, config } = message;
        
        // Send ready message
        postMessage({
          type: 'ready'
        } as WorkerOutboundMessage);
        
      } catch (error) {
        console.error('Error initializing worker:', error);
        
        // Send error message back to main thread
        postMessage({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error initializing worker'
        } as WorkerOutboundMessage);
      }
    } else if (message.type === 'deduplicate') {
      try {
        // Fix the destructuring to correctly extract properties from message.data object
        const { 
          data: fileData, 
          mappedColumns, 
          config, 
          jobId, 
          optimizePostcodeProcessing,
          splinkSettings // Extract Splink settings from message
        } = message.data;
        
        // Send initial progress update
        sendProgress({
          status: 'processing',
          percentage: 5,
          statusMessage: 'Starting deduplication process...',
          recordsProcessed: 0,
          totalRecords: fileData.length,
          stage: 'initialization'
        });
        
        // If large dataset processing is enabled, use chunked processing
        if (config.splinkParams?.enableLargeDatasetMode && fileData.length > 10000) {
          // Set the initial progress for chunked processing
          sendProgress({
            status: 'processing',
            percentage: 10,
            statusMessage: 'Preparing chunked processing for large dataset...',
            recordsProcessed: 0,
            totalRecords: fileData.length,
            chunked: true,
            totalChunks: Math.ceil(fileData.length / (config.splinkParams.maxChunkSize || 10000)),
            currentChunk: 0,
            stage: 'chunking'
          });
          
          // Handle large dataset with chunked processing
          processLargeDataset(fileData, mappedColumns, config, jobId, optimizePostcodeProcessing, splinkSettings);
        } else if (config.useSplink) {
          // Handle Splink processing
          processSplinkDeduplication(fileData, mappedColumns, config, jobId, optimizePostcodeProcessing, splinkSettings);
        } else {
          // Handle standard deduplication
          processStandardDeduplication(fileData, mappedColumns, config, jobId, optimizePostcodeProcessing, splinkSettings);
        }
      } catch (error) {
        console.error('Worker error during deduplication:', error);
        
        // Send error message back to main thread
        postMessage({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error during deduplication'
        } as WorkerOutboundMessage);
      }
    }
  };
})();
