
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
  if (config.splinkSettings?.outputDir) {
    payload['output_dir'] = config.splinkSettings.outputDir;
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
    
    console.log("Received cluster data:", clusterData.length, "records");
    console.log("Statistics:", statistics);
    
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
    
    // Use the cluster data directly for processedData
    const processedData = clusterData;
    
    // Create flagged data by adding a is_duplicate flag to each record
    // based on whether it belongs to a cluster with size > 1
    const flaggedData = originalData.map(row => {
      let isDuplicate = false;
      let clusterId = null;
      
      // Try to find this record in the cluster data
      // Note: This is a simplistic approach and might need to be refined
      // based on your exact data structure and matching logic
      for (const [id, cluster] of clusterMap.entries()) {
        if (cluster.length > 1 && 
            cluster.some((clusterRow: any) => {
              // Check if this cluster record matches the original row
              // based on a few key fields (this logic may need adjustment)
              const keyFields = Object.keys(row).slice(0, 3); // Use first 3 fields as sample
              return keyFields.every(key => 
                clusterRow[key] !== undefined && 
                row[key] !== undefined &&
                String(clusterRow[key]) === String(row[key])
              );
            })) {
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
    
    return {
      originalRows,
      uniqueRows,
      duplicateRows,
      clusters,
      processedData,
      flaggedData,
      resultId: new Date().getTime().toString(),
      jobId: apiResponse.output_path || new Date().getTime().toString()
    };
  }
  
  // If there was an error
  throw new Error(apiResponse.error || 'Failed to process data with Splink API');
};
