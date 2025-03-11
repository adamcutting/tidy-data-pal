import { DedupeConfig, DedupeResult, MappedColumn, DedupeProgress } from './types';

/**
 * Prepares and formats data for the Splink API according to its expected structure
 */
export const formatDataForSplinkApi = (
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig
): {
  unique_id_column: string;
  blocking_fields: string[];
  match_fields: { field: string; type: string }[];
  input_data: any[];
  output_dir?: string;
} => {
  // Get columns that are included in the deduplication
  const includedColumns = mappedColumns
    .filter(col => col.include && col.mappedName)
    .map(col => col.mappedName as string);

  // Use the first column as the unique ID if none specified, or use the configured one
  const uniqueIdColumn = config.splinkParams?.uniqueIdColumn || includedColumns[0];

  // Format blocking columns
  const blockingFields = config.blockingColumns || [];

  // Format match fields - match field structure changed from "column" to "field"
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

  // Add a simple unique ID if needed
  const dataWithIds = data.map((row, index) => {
    // If the unique ID column doesn't exist in the data, add it
    if (!row[uniqueIdColumn]) {
      return { ...row, [uniqueIdColumn]: `id-${index}` };
    }
    return row;
  });

  // Generate a unique job ID for tracking
  const jobId = `job_${new Date().getTime()}_${Math.random().toString(36).substring(2, 10)}`;

  // Create the payload
  const payload = {
    unique_id_column: uniqueIdColumn,
    blocking_fields: blockingFields,
    match_fields: matchFields,
    input_data: dataWithIds,
    job_id: jobId // Add the job ID to the payload
  };

  // Add output directory if specified in settings
  if (config.splinkSettings?.outputDir) {
    payload['output_dir'] = config.splinkSettings.outputDir;
  }

  return payload;
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
      resultId: new Date().getTime().toString(),
      jobId: apiResponse.job_id
    };
  }
  
  throw new Error('Invalid API response format');
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
