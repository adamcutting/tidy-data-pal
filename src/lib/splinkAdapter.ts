
import { DedupeConfig, DedupeResult, MappedColumn } from './types';

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

  // Create the payload
  const payload = {
    unique_id_column: uniqueIdColumn,
    blocking_fields: blockingFields,
    match_fields: matchFields,
    input_data: dataWithIds
  };

  // Add output directory if specified in settings
  if (config.splinkParams?.outputDir) {
    payload['output_dir'] = config.splinkParams.outputDir;
  }

  return payload;
};

/**
 * Processes the response from the Splink API into the format expected by the application
 */
export const processSplinkResponse = (
  apiResponse: any,
  originalData: any[]
): DedupeResult => {
  // If the API returned a proper response
  if (apiResponse && apiResponse.message === "Deduplication successful") {
    // Extract the cluster data from the response
    const clusterData = apiResponse.cluster_data || [];
    const statistics = apiResponse.statistics || {};
    
    // Calculate unique and duplicate rows
    const originalRows = originalData.length;
    const uniqueRows = statistics.num_clusters || originalData.length;
    const duplicateRows = originalRows - uniqueRows;
    
    // Group records by cluster_id to form clusters
    const clusterMap = new Map<string | number, any[]>();
    clusterData.forEach((record: any) => {
      const clusterId = record.cluster_id;
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId)?.push(record);
    });
    
    // Convert Map to array of clusters
    const clusters = Array.from(clusterMap.values());
    
    // Create flagged data by adding a is_duplicate flag to records
    const flaggedData = originalData.map(row => {
      // Find if this row exists in any cluster with size > 1
      const isDuplicate = clusters.some(cluster => 
        cluster.length > 1 && 
        cluster.some(clusterRecord => 
          Object.keys(row).every(key => row[key] === clusterRecord[key])
        )
      );
      
      return { ...row, is_duplicate: isDuplicate };
    });
    
    return {
      originalRows,
      uniqueRows,
      duplicateRows,
      clusters,
      processedData: clusterData,
      flaggedData,
      resultId: new Date().getTime().toString(),
      jobId: apiResponse.output_path || new Date().getTime().toString()
    };
  }
  
  // If there was an error
  throw new Error(apiResponse.error || 'Failed to process data with Splink API');
};
