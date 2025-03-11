
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
  match_fields: { column: string; type: string }[];
  input_data: any[];
} => {
  // Get columns that are included in the deduplication
  const includedColumns = mappedColumns
    .filter(col => col.include && col.mappedName)
    .map(col => col.mappedName as string);

  // Use the first column as the unique ID if none specified, or use the configured one
  const uniqueIdColumn = config.splinkParams?.uniqueIdColumn || includedColumns[0];

  // Format blocking columns
  const blockingFields = config.blockingColumns || [];

  // Format match fields
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
      column: comp.column,
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

  return {
    unique_id_column: uniqueIdColumn,
    blocking_fields: blockingFields,
    match_fields: matchFields,
    input_data: dataWithIds
  };
};

/**
 * Processes the response from the Splink API into the format expected by the application
 */
export const processSplinkResponse = (
  apiResponse: any,
  originalData: any[]
): DedupeResult => {
  // If the API returned a proper response with clusters
  if (apiResponse && apiResponse.status === 'success') {
    // Since we don't have the actual clusters in the API response yet, 
    // we'll create a mock result structure
    
    // In a real implementation, you would parse the CSV file or receive the cluster data directly
    
    return {
      originalRows: originalData.length,
      uniqueRows: originalData.length - 10, // Placeholder - ideally from API response
      duplicateRows: 10, // Placeholder - ideally from API response
      clusters: [], // This should come from parsing the output file
      processedData: originalData,
      flaggedData: originalData.map(row => ({ ...row, is_duplicate: false })), // Placeholder
      resultId: new Date().getTime().toString(),
      jobId: new Date().getTime().toString()
    };
  }
  
  // If there was an error
  throw new Error(apiResponse.message || 'Failed to process data with Splink API');
};
