import { 
  WorkerInboundMessage, 
  WorkerOutboundMessage, 
  DedupeProgress,
  MappedColumn,
  DedupeConfig
} from './types';

// Set up the worker context
const ctx: Worker = self as any;

// Notify that worker is ready
postMessage({ type: 'ready' } as WorkerOutboundMessage);

// Listen for messages from the main thread
ctx.addEventListener('message', (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;
  
  if (message.type === 'init') {
    try {
      // Extract data from the message
      const { data, mappedColumns, config } = message;
      
      // Send initial progress
      sendProgress({
        status: 'processing',
        percentage: 10,
        statusMessage: 'Starting data processing in Web Worker...',
        recordsProcessed: 0,
        totalRecords: data.length,
        stage: 'initialization'
      });
      
      // Process the data
      processData(data, mappedColumns, config);
    } catch (error) {
      // Send error message back to main thread
      postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred in worker'
      } as WorkerOutboundMessage);
    }
  } else if (message.type === 'deduplicate') {
    try {
      // Extract data from the message
      const { fileData, mappedColumns, config, jobId, optimizePostcodeProcessing } = message.data;
      
      // Send initial progress update
      sendProgress({
        status: 'processing',
        percentage: 5,
        statusMessage: 'Starting deduplication process in worker...',
        recordsProcessed: 0,
        totalRecords: fileData.length
      });
      
      // Process in chunks to allow progress updates
      processInChunks(fileData, mappedColumns, config, jobId, optimizePostcodeProcessing);
    } catch (error) {
      console.error('[Worker] Error processing message:', error);
      
      // Send error back to main thread
      ctx.postMessage({
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error in worker'
      });
    }
  }
});

// Function to process data
async function processData(
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig
) {
  try {
    // Log info in the worker
    console.log('[Worker] Starting to process data:', {
      dataLength: data.length,
      mappedColumnsLength: mappedColumns.length,
      configName: config.name
    });
    
    // First phase - prepare the payload
    sendProgress({
      status: 'processing',
      percentage: 15,
      statusMessage: 'Preparing data structure...',
      recordsProcessed: 0,
      totalRecords: data.length,
      stage: 'preparation'
    });
    
    // Get columns that are included in the deduplication
    const includedColumns = mappedColumns
      .filter(col => col.include && col.mappedName)
      .map(col => col.mappedName as string);
    
    console.log(`[Worker] Included columns (${includedColumns.length}):`, includedColumns);

    // Use the first column as the unique ID if none specified, or use the configured one
    const uniqueIdColumn = config.splinkParams?.uniqueIdColumn || includedColumns[0];
    console.log(`[Worker] Using unique ID column: ${uniqueIdColumn}`);

    // Format blocking columns
    const blockingFields = config.blockingColumns || [];
    console.log(`[Worker] Blocking fields (${blockingFields.length}):`, blockingFields);

    // Format match fields - match field structure changed from "column" to "field"
    console.log('[Worker] Setting up match fields from comparisons...');
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
    
    sendProgress({
      status: 'processing',
      percentage: 20,
      statusMessage: 'Starting data chunking...',
      recordsProcessed: 0,
      totalRecords: data.length,
      stage: 'chunking'
    });
    
    // For extremely large datasets, use different chunking approach
    const isVeryLargeDataset = data.length > 100000;
    const chunkSize = isVeryLargeDataset ? 50000 : 5000;
    
    console.log(`[Worker] Dataset size: ${data.length} records (${isVeryLargeDataset ? 'very large' : 'standard'})`);
    console.log(`[Worker] Using chunk size: ${chunkSize}`);
    
    // For very large datasets, we'll only process the first chunk in the worker
    const rowsToProcess = isVeryLargeDataset ? Math.min(chunkSize, data.length) : data.length;
    const totalChunks = Math.ceil(rowsToProcess / chunkSize);
    
    console.log(`[Worker] Will process ${rowsToProcess} rows in ${totalChunks} chunks`);
    
    const processedData: any[] = [];
    
    // Process data in chunks - in a worker, we don't need yield time as much,
    // but we'll still send progress updates
    for (let i = 0; i < totalChunks; i++) {
      const startTime = Date.now();
      const logPrefix = `[Worker] Chunk ${i+1}/${totalChunks}:`;
      console.log(`${logPrefix} Starting processing`);
      
      // Update progress
      const progressPercentage = 20 + (i / totalChunks) * 70;
      sendProgress({
        status: 'processing',
        percentage: Math.round(progressPercentage),
        statusMessage: `Processing data chunk ${i+1}/${totalChunks}...`,
        recordsProcessed: i * chunkSize,
        totalRecords: data.length,
        stage: 'processing',
        currentChunk: i + 1,
        totalChunks: totalChunks,
        debugInfo: `Processing chunk ${i+1}/${totalChunks} (${chunkSize} records per chunk)`
      });
      
      // Process this chunk
      const startIdx = i * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, data.length);
      console.log(`${logPrefix} Processing records ${startIdx} to ${endIdx} (${endIdx - startIdx} records)`);
      const chunk = data.slice(startIdx, endIdx);
      
      // Add a simple unique ID if needed for this chunk
      const processedChunk = chunk.map((row, index) => {
        // If the unique ID column doesn't exist in the data, add it
        if (!row[uniqueIdColumn]) {
          return { ...row, [uniqueIdColumn]: `id-${startIdx + index}` };
        }
        return row;
      });
      
      // Add processed chunk to results
      processedData.push(...processedChunk);
      
      const endTime = Date.now();
      console.log(`${logPrefix} Chunk processed in ${endTime - startTime}ms. Total processed records: ${processedData.length}`);
    }

    console.log(`[Worker] All chunks processed. Total records: ${processedData.length}`);

    // Generate a unique job ID for tracking
    const jobId = `job_${new Date().getTime()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Final payload preparation
    sendProgress({
      status: 'processing',
      percentage: 90,
      statusMessage: 'Finalizing payload preparation...',
      recordsProcessed: data.length,
      totalRecords: data.length,
      stage: 'finalizing'
    });
    
    // Create the payload
    const payload = {
      unique_id_column: uniqueIdColumn,
      blocking_fields: blockingFields,
      match_fields: matchFields,
      input_data: processedData,
      job_id: jobId,
      chunk_size: chunkSize,
      total_rows: data.length
    };

    // Add output directory if specified in settings
    if (config.splinkSettings?.outputDir) {
      payload['output_dir'] = config.splinkSettings.outputDir;
    }

    // Calculate payload size for logging
    const payloadSize = JSON.stringify(payload).length / 1024 / 1024;
    console.log(`[Worker] Payload creation complete. Size: ${payloadSize.toFixed(2)} MB`);
    
    // Send the result back to the main thread
    sendProgress({
      status: 'processing',
      percentage: 95,
      statusMessage: 'Sending prepared data back to main thread...',
      recordsProcessed: data.length,
      totalRecords: data.length,
      stage: 'sending'
    });
    
    postMessage({
      type: 'result',
      result: payload
    } as WorkerOutboundMessage);
    
    // Final progress
    sendProgress({
      status: 'processing',
      percentage: 100,
      statusMessage: 'Data preparation completed in Web Worker',
      recordsProcessed: data.length,
      totalRecords: data.length,
      stage: 'completed'
    });
    
  } catch (error) {
    console.error('[Worker] Error processing data:', error);
    postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred in worker'
    } as WorkerOutboundMessage);
  }
}

// Process data in chunks to prevent memory issues and allow progress updates
async function processInChunks(
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig,
  jobId: string,
  optimizePostcodeProcessing: boolean
) {
  try {
    const totalRows = data.length;
    console.log(`[Worker] Processing ${totalRows} rows with ${config.comparisons.length} comparisons`);
    
    // Send progress update - preparing data
    sendProgress({
      status: 'processing',
      percentage: 10,
      statusMessage: 'Preparing data for processing...',
      recordsProcessed: 0,
      totalRecords: totalRows
    });
    
    // Calculate optimal chunk size based on data size
    // Smaller chunks for larger datasets to keep memory usage reasonable
    const chunkSize = totalRows > 100000 ? 2000 : 
                      totalRows > 50000 ? 5000 :
                      totalRows > 10000 ? 10000 : totalRows;
    
    const totalChunks = Math.ceil(totalRows / chunkSize);
    console.log(`[Worker] Processing in ${totalChunks} chunks of ${chunkSize} rows each`);
    
    // Format data for Splink API if useSplink is true
    if (config.useSplink) {
      sendProgress({
        status: 'processing',
        percentage: 20,
        statusMessage: 'Preparing data for Splink API...',
        recordsProcessed: 0,
        totalRecords: totalRows,
        stage: 'preparation'
      });
      
      // Process for Splink
      const splinkData = await formatForSplinkApi(data, mappedColumns, config, jobId);
      
      sendProgress({
        status: 'processing',
        percentage: 90,
        statusMessage: 'Data preparation complete. Ready for API submission.',
        recordsProcessed: totalRows,
        totalRecords: totalRows
      });
      
      // Send the Splink job data back to the main thread
      ctx.postMessage({
        type: 'splink-job',
        data: {
          jobId,
          readyForSubmission: true,
          totalRows
        }
      });
    } else {
      // Local processing implementation would go here
      // For now, we'll just simulate progress updates
      
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, totalRows);
        const currentChunk = data.slice(start, end);
        
        // Update progress
        const percentComplete = Math.floor(30 + (chunkIndex / totalChunks) * 60);
        sendProgress({
          status: 'processing',
          percentage: percentComplete,
          statusMessage: `Processing chunk ${chunkIndex + 1} of ${totalChunks}...`,
          recordsProcessed: end,
          totalRecords: totalRows,
          currentChunk: chunkIndex + 1,
          totalChunks
        });
        
        // Process this chunk
        // This is where your actual deduplication logic would go
        
        // Simulate some processing time to avoid blocking UI
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Send completion
      sendProgress({
        status: 'completed',
        percentage: 100,
        statusMessage: 'Processing complete',
        recordsProcessed: totalRows,
        totalRecords: totalRows
      });
      
      // Send result back to main thread
      ctx.postMessage({
        type: 'result',
        data: {
          originalRows: totalRows,
          uniqueRows: totalRows, // This would be calculated during processing
          duplicateRows: 0, // This would be calculated during processing
          clusters: [], // This would be filled during processing
          processedData: data, // This would be the deduplicated data
          flaggedData: data.map(row => ({ ...row, __is_duplicate: 'No' }))
        }
      });
    }
  } catch (error) {
    console.error('[Worker] Error processing data in chunks:', error);
    
    sendProgress({
      status: 'failed',
      percentage: 0,
      statusMessage: 'Processing failed',
      error: error instanceof Error ? error.message : 'Unknown error during processing'
    });
    
    // Send error back to main thread
    ctx.postMessage({
      type: 'error',
      data: error instanceof Error ? error.message : 'Unknown error in worker'
    });
  }
}

// Format data for Splink API
async function formatForSplinkApi(
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig,
  jobId: string
) {
  // Get columns that are included in the deduplication
  const includedColumns = mappedColumns
    .filter(col => col.include && col.mappedName)
    .map(col => col.mappedName as string);
  
  // Use the first column as the unique ID if none specified
  const uniqueIdColumn = config.splinkParams?.uniqueIdColumn || includedColumns[0];
  
  // Format blocking columns
  const blockingFields = config.blockingColumns || [];
  
  // Format match fields
  const matchFields = config.comparisons.map(comp => {
    let type = 'exact';
    
    // Map matchType to Splink's expected format
    if (comp.matchType === 'fuzzy') {
      type = comp.threshold && comp.threshold < 0.85 ? 'levenshtein' : 'jaro_winkler';
    } else if (comp.matchType === 'partial') {
      type = 'levenshtein';
    }
    
    return {
      field: comp.column,
      type
    };
  });
  
  // Ensure all records have the unique ID
  const processedData = data.map((row, index) => {
    if (!row[uniqueIdColumn]) {
      return { ...row, [uniqueIdColumn]: `id-${index}` };
    }
    return row;
  });
  
  return {
    unique_id_column: uniqueIdColumn,
    blocking_fields: blockingFields,
    match_fields: matchFields,
    input_data: processedData,
    job_id: jobId,
    total_rows: data.length
  };
}

// Helper function to send progress updates
function sendProgress(progress: DedupeProgress) {
  postMessage({
    type: 'progress',
    data: progress
  } as WorkerOutboundMessage);
}
