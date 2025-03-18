import { DedupeConfig, DedupeResult, MappedColumn, DedupeProgress, WorkerOutboundMessage, SparkConfig } from './types';

/**
 * Prepares and formats data for the Splink API according to its expected structure
 * Uses Web Workers to prevent UI freezing when processing large datasets
 */
export const formatDataForSplinkApi = async (
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig,
  onProgress?: (progress: DedupeProgress) => void
): Promise<{
  unique_id_column: string;
  blocking_fields: string[];
  match_fields: { field: string; type: string }[];
  input_data: any[];
  chunk_size?: number;
  total_rows?: number;
  output_dir?: string;
  spark_config?: any;
}> => {
  // Log the start of processing
  console.log(`Starting formatDataForSplinkApi with ${data.length} records`);
  
  if (config.useWebWorker !== false && window.Worker) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Using Web Worker for data processing');
        
        // Create a new worker
        const worker = new Worker(new URL('./dataProcessingWorker.ts', import.meta.url), { type: 'module' });
        
        // Handle messages from the worker
        worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
          const message = event.data;
          
          switch (message.type) {
            case 'progress':
              if (onProgress) {
                onProgress(message.progress);
              }
              break;
              
            case 'result':
              console.log('Received processed data from worker');
              resolve(message.result);
              worker.terminate();
              break;
              
            case 'error':
              console.error('Worker error:', message.error);
              reject(new Error(message.error));
              worker.terminate();
              break;
          }
        };
        
        // Handle worker errors
        worker.onerror = (error) => {
          console.error('Worker error event:', error);
          if (onProgress) {
            onProgress({
              status: 'failed',
              percentage: 0,
              statusMessage: 'Error in Web Worker',
              error: error.message || 'Unknown error in Web Worker',
              debugInfo: `Line: ${error.lineno}, File: ${error.filename}`
            });
          }
          reject(new Error('Worker failed: ' + error.message));
          worker.terminate();
        };
        
        // Send data to worker for processing
        console.log('Sending data to worker');
        if (onProgress) {
          onProgress({
            status: 'processing',
            percentage: 5,
            statusMessage: 'Initializing Web Worker for data processing...',
            recordsProcessed: 0,
            totalRecords: data.length,
            debugInfo: `Starting Web Worker with ${data.length} records`
          });
        }
        
        worker.postMessage({
          type: 'deduplicate',
          data: {
            data,
            mappedColumns,
            config,
            jobId: `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            optimizePostcodeProcessing: true
          }
        });
        
      } catch (error) {
        console.error('Error initializing Web Worker:', error);
        if (onProgress) {
          onProgress({
            status: 'failed',
            percentage: 0,
            statusMessage: 'Failed to initialize Web Worker',
            error: error instanceof Error ? error.message : 'Unknown error initializing worker',
          });
        }
        reject(error);
      }
    });
  } else {
    // Fallback to the old implementation if Web Workers are not supported
    // or explicitly disabled
    console.log('Web Workers not supported or disabled, using main thread processing');
    
    // Update progress if callback is provided
    if (onProgress) {
      onProgress({
        status: 'processing',
        percentage: 5,
        statusMessage: 'Starting data preparation on main thread (Web Workers not available)...',
        debugInfo: 'Using legacy processing method'
      });
    }
    
    // Get columns that are included in the deduplication
    const includedColumns = mappedColumns
      .filter(col => col.include && col.mappedName)
      .map(col => col.mappedName as string);
    
    console.log(`Included columns (${includedColumns.length}):`, includedColumns);

    // Use the configured uniqueIdColumn if specified, otherwise use the first column
    const uniqueIdColumn = config.splinkParams?.uniqueIdColumn || includedColumns[0];
    console.log(`Using unique ID column: ${uniqueIdColumn}`);

    // Format blocking columns
    const blockingFields = config.blockingColumns || [];
    console.log(`Blocking fields (${blockingFields.length}):`, blockingFields);

    // Format match fields - match field structure changed from "column" to "field"
    console.log('Setting up match fields from comparisons...');
    const matchFields = config.comparisons.map(comp => {
      let type = 'exact';
      
      // Map matchType to Splink's expected format
      if (comp.matchType === 'fuzzy') {
        // Determine if we should use levenshtein or jaro_winkler based on threshold
        type = comp.threshold && comp.threshold < 0.85 ? 'levenshtein' : 'jaro_winkler';
      } else if (comp.matchType === 'partial') {
        type = 'levenshtein';
      }
      
      return {
        field: comp.column,
        type
      };
    });
    
    console.log(`Match fields (${matchFields.length}):`, JSON.stringify(matchFields, null, 2));

    // For extremely large datasets, we'll use a different approach
    // We'll send the first chunk to start processing and include metadata
    // about total size to let the backend handle the rest
    const isVeryLargeDataset = data.length > 100000;
    const chunkSize = isVeryLargeDataset ? 50000 : 5000; // Smaller chunks for better UI responsiveness
    
    console.log(`Dataset size: ${data.length} records (${isVeryLargeDataset ? 'very large' : 'standard'})`);
    console.log(`Using chunk size: ${chunkSize}`);
    
    // For very large datasets, we'll only process the first chunk on the client
    const rowsToProcess = isVeryLargeDataset ? Math.min(chunkSize, data.length) : data.length;
    const totalChunks = Math.ceil(rowsToProcess / chunkSize);
    
    console.log(`Will process ${rowsToProcess} rows in ${totalChunks} chunks`);
    
    const processedData: any[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const logPrefix = `Chunk ${i+1}/${totalChunks}:`;
      console.log(`${logPrefix} Starting processing`);
      
      // Yield to the main thread before processing each chunk
      console.log(`${logPrefix} Yielding to main thread...`);
      await new Promise(resolve => setTimeout(resolve, 0));
      console.log(`${logPrefix} Resumed after yield`);
      
      // Update progress if callback is provided
      if (onProgress) {
        const progressPercentage = 30 + (i / totalChunks) * 10; // Spread from 30% to 40%
        console.log(`${logPrefix} Updating progress to ${Math.round(progressPercentage)}%`);
        onProgress({
          status: 'processing',
          percentage: Math.round(progressPercentage),
          statusMessage: `Preparing data for Splink API (chunk ${i+1}/${totalChunks})...`,
          recordsProcessed: i * chunkSize,
          totalRecords: data.length,
          debugInfo: `Processing chunk ${i+1}/${totalChunks} (${chunkSize} records per chunk)`
        });
      }
      
      console.log(`${logPrefix} Slicing data...`);
      // Process this chunk
      const startIdx = i * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, data.length);
      console.log(`${logPrefix} Slicing from ${startIdx} to ${endIdx} (${endIdx - startIdx} records)`);
      const chunk = data.slice(startIdx, endIdx);
      
      console.log(`${logPrefix} Adding unique IDs if needed...`);
      // Add a simple unique ID if needed for this chunk
      const processedChunk = chunk.map((row, index) => {
        // If the unique ID column doesn't exist in the data, add it
        if (!row[uniqueIdColumn]) {
          return { ...row, [uniqueIdColumn]: `id-${startIdx + index}` };
        }
        return row;
      });
      
      console.log(`${logPrefix} Adding ${processedChunk.length} records to result`);
      // Add processed chunk to results
      processedData.push(...processedChunk);
      console.log(`${logPrefix} Total processed records so far: ${processedData.length}`);
    }

    console.log(`All chunks processed. Total records: ${processedData.length}`);

    // Generate a unique job ID for tracking
    const jobId = `job_${new Date().getTime()}_${Math.random().toString(36).substring(2, 10)}`;
    console.log(`Generated job ID: ${jobId}`);

    // Create the payload
    console.log('Creating payload for API...');
    const payload = {
      unique_id_column: uniqueIdColumn,
      blocking_fields: blockingFields,
      match_fields: matchFields,
      input_data: processedData,
      job_id: jobId, // Add the job ID to the payload
      chunk_size: chunkSize, // Add chunk size for backend reference
      total_rows: data.length // Add total rows for backend chunking
    };

    // Add output directory if specified in settings
    if (config.splinkSettings?.outputDir) {
      payload['output_dir'] = config.splinkSettings.outputDir;
      console.log(`Using output directory: ${config.splinkSettings.outputDir}`);
    }
    
    // Add Spark configuration if enabled
    if (config.splinkParams?.useSpark && config.splinkSettings?.sparkConfig?.enabled) {
      console.log('Adding Spark configuration to payload');
      payload['spark_config'] = {
        enabled: true,
        master_url: config.splinkSettings.sparkConfig.masterUrl,
        app_name: config.splinkSettings.sparkConfig.appName,
        executor_memory: config.splinkSettings.sparkConfig.executorMemory,
        driver_memory: config.splinkSettings.sparkConfig.driverMemory,
        num_executors: config.splinkSettings.sparkConfig.numExecutors,
        executor_cores: config.splinkSettings.sparkConfig.executorCores,
        shuffle_partitions: config.splinkSettings.sparkConfig.shufflePartitions,
        local_dir: config.splinkSettings.sparkConfig.localDir
      };
    }

    console.log('Payload creation complete. Ready to send to API.');
    console.log(`Data size: ${JSON.stringify(processedData).length / 1024 / 1024} MB`);

    return payload;
  }
};

/**
 * Check the status of a Splink job from the backend
 */
export const checkSplinkJobStatus = async (
  jobId: string,
  apiBaseUrl: string,
  apiKey?: string
): Promise<DedupeProgress> => {
  try {
    // Build the status check URL
    const statusUrl = `${apiBaseUrl.replace(/\/deduplicate$/, '')}/job-status/${jobId}`;
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get job status: ${errorText}`);
    }

    const statusData = await response.json();
    
    // Map backend status to our DedupeProgress format
    let status: DedupeProgress['status'];
    switch (statusData.status) {
      case 'completed':
        status = 'completed';
        break;
      case 'failed':
        status = 'failed';
        break;
      case 'cancelled':
        status = 'cancelled';
        break;
      case 'clustering':
        status = 'clustering';
        break;
      case 'estimating_u':
      case 'predicting':
      default:
        status = 'processing';
    }

    return {
      status,
      percentage: statusData.progress || 0,
      statusMessage: getStatusMessage(statusData.status, statusData.progress),
      recordsProcessed: statusData.records_processed,
      totalRecords: statusData.total_records,
      estimatedTimeRemaining: formatTime(statusData.estimated_time_remaining),
      error: statusData.error
    };
  } catch (error) {
    console.error('Error checking job status:', error);
    return {
      status: 'failed',
      percentage: 0,
      statusMessage: 'Failed to check job status',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Cancel a running Splink job
 */
export const cancelSplinkJob = async (
  jobId: string,
  apiBaseUrl: string,
  apiKey?: string
): Promise<{success: boolean; message: string}> => {
  try {
    // Build the cancel job URL
    const cancelUrl = `${apiBaseUrl.replace(/\/deduplicate$/, '')}/cancel-job/${jobId}`;
    
    const response = await fetch(cancelUrl, {
      method: 'POST',
      headers: {
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `Failed to cancel job: ${response.statusText}`);
    }

    return {
      success: true,
      message: data.message || 'Job cancellation requested'
    };
  } catch (error) {
    console.error('Error cancelling job:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred while cancelling job'
    };
  }
};

/**
 * Processes the response from the Splink API into the format expected by the application
 */
export const processSplinkResponse = (
  apiResponse: any,
  originalData: any[]
): DedupeResult => {
  // If we have a job ID, this is the initial response
  if (apiResponse.job_id) {
    return {
      originalRows: originalData.length,
      uniqueRows: originalData.length, // Will be updated when processing completes
      duplicateRows: 0, // Will be updated when processing completes
      clusters: [],
      processedData: [],
      flaggedData: [],
      jobId: apiResponse.job_id
    };
  }
  
  // If we have result data, this is the completed response
  if (apiResponse.result) {
    const { cluster_data, statistics } = apiResponse.result;
    
    return {
      originalRows: statistics.total_records,
      uniqueRows: statistics.num_clusters,
      duplicateRows: statistics.total_records - statistics.num_clusters,
      clusters: groupDataIntoClusters(cluster_data),
      processedData: cluster_data,
      flaggedData: createFlaggedData(originalData, cluster_data),
      jobId: apiResponse.job_id
    };
  }
  
  throw new Error('Invalid API response format');
};

/**
 * Prepares and submits a job to the Splink API with Spark configuration
 * @param data Input data for deduplication
 * @param config Deduplication configuration
 * @param apiUrl Splink API URL
 * @param apiKey Optional API key for authentication
 * @returns Promise with the job submission result
 */
export const submitSplinkJob = async (
  data: any[],
  config: any,
  apiUrl: string,
  apiKey?: string
): Promise<{ success: boolean; jobId?: string; message: string }> => {
  try {
    // Prepare the request body
    const requestBody = {
      input_data: data,
      unique_id_column: config.uniqueIdColumn || Object.keys(data[0])[0],
      blocking_fields: config.blockingColumns || [],
      match_fields: config.comparisons.map((comp: any) => ({
        field: comp.column,
        match_type: comp.matchType,
        threshold: comp.threshold || 0.8
      })),
      job_id: `splink_job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      total_rows: data.length,
      chunk_size: config.splinkParams?.maxChunkSize || 10000,
    };
    
    // Add Spark configuration if enabled
    if (config.splinkParams?.useSpark && config.splinkSettings?.sparkConfig) {
      const sparkConfig: SparkConfig = config.splinkSettings.sparkConfig;
      
      // Only include Spark config if actually enabled
      if (sparkConfig.enabled) {
        requestBody.spark_config = {
          enabled: true,
          masterUrl: sparkConfig.masterUrl || 'local[*]',
          appName: sparkConfig.appName || 'DataHQ-Splink',
          executorMemory: sparkConfig.executorMemory || '4g',
          driverMemory: sparkConfig.driverMemory || '2g',
          numExecutors: sparkConfig.numExecutors || 2,
          executorCores: sparkConfig.executorCores || 2,
          shufflePartitions: sparkConfig.shufflePartitions || 100,
          localDir: sparkConfig.localDir || null
        };
      }
    }
    
    console.log('Submitting Splink job with config:', JSON.stringify(requestBody, null, 2));

    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Add API key if provided
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    // Make the request to the Splink API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    // Handle response
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Splink API error: ${error}`);
    }

    // Parse response
    const result = await response.json();
    
    // Return formatted result
    return {
      success: true,
      jobId: result.job_id,
      message: result.message || 'Job submitted successfully'
    };
  } catch (error) {
    console.error('Error submitting Splink job:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error submitting job'
    };
  }
};

// Helper functions
function getStatusMessage(status: string, progress: number): string {
  switch (status) {
    case 'estimating_u':
      return 'Estimating initial parameters...';
    case 'predicting':
      return 'Predicting potential matches...';
    case 'clustering':
      return 'Clustering similar records...';
    case 'completed':
      return 'Processing complete';
    case 'failed':
      return 'Processing failed';
    case 'cancelled':
      return 'Processing cancelled by user';
    default:
      return `Processing... ${progress}% complete`;
  }
}

function formatTime(seconds: number | null): string | undefined {
  if (!seconds) return undefined;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function groupDataIntoClusters(clusterData: any[]): any[] {
  const clusterMap = new Map<string | number, any[]>();
  
  clusterData.forEach((record: any) => {
    const clusterId = record.cluster_id;
    if (!clusterMap.has(clusterId)) {
      clusterMap.set(clusterId, []);
    }
    clusterMap.get(clusterId)?.push(record);
  });
  
  return Array.from(clusterMap.values());
}

function createFlaggedData(originalData: any[], clusterData: any[]): any[] {
  const clusterMap = new Map<string | number, any[]>();
  
  // First, group cluster data by cluster ID
  clusterData.forEach((record: any) => {
    const clusterId = record.cluster_id;
    if (!clusterMap.has(clusterId)) {
      clusterMap.set(clusterId, []);
    }
    clusterMap.get(clusterId)?.push(record);
  });
  
  // Then flag original data based on cluster membership
  return originalData.map(row => {
    let isDuplicate = false;
    let clusterId = null;
    
    for (const [id, cluster] of clusterMap.entries()) {
      if (cluster.length > 1 && findMatchingRecord(row, cluster)) {
        isDuplicate = true;
        clusterId = id;
        break;
      }
    }
    
    return {
      ...row,
      is_duplicate: isDuplicate ? 'Yes' : 'No',
      cluster_id: clusterId || 'unique'
    };
  });
}

function findMatchingRecord(originalRow: any, cluster: any[]): boolean {
  const keyFields = Object.keys(originalRow).slice(0, 3); // Use first 3 fields as sample
  return cluster.some(clusterRow => 
    keyFields.every(key => 
      clusterRow[key] !== undefined && 
      originalRow[key] !== undefined &&
      String(clusterRow[key]) === String(originalRow[key])
    )
  );
}
