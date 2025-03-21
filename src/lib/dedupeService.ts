import { FileData, MappedColumn, DedupeConfig, DedupeResult, SavedConfig, SplinkSettings, DedupeProgress } from './types';
import { formatDataForSplinkApi, processSplinkResponse, checkSplinkJobStatus } from './splinkAdapter';

// Default Splink settings
const DEFAULT_SPLINK_SETTINGS: SplinkSettings = {
  apiUrl: 'http://localhost:5000/api/deduplicate', // Default to local development server
};

// Modified to work in both browser and worker contexts
export const getSplinkSettings = (providedSettings?: SplinkSettings): SplinkSettings => {
  // If we have provided settings (from worker context), use those
  if (providedSettings) {
    return providedSettings;
  }
  
  // Only try localStorage in browser context
  if (typeof window !== 'undefined' && window.localStorage) {
    const settingsJson = localStorage.getItem('splink-settings');
    if (!settingsJson) return DEFAULT_SPLINK_SETTINGS;
    
    try {
      return JSON.parse(settingsJson);
    } catch (e) {
      console.error('Error parsing Splink settings:', e);
      return DEFAULT_SPLINK_SETTINGS;
    }
  }
  
  // Default case for worker context
  return DEFAULT_SPLINK_SETTINGS;
};

// Save Splink settings to localStorage
export const saveSplinkSettings = (settings: SplinkSettings): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('splink-settings', JSON.stringify(settings));
  }
};

// Test Splink API connection
export const testSplinkConnection = async (providedSettings?: SplinkSettings): Promise<boolean> => {
  const splinkSettings = getSplinkSettings(providedSettings);
  try {
    // Use a proper test endpoint instead of a HEAD request
    const testUrl = splinkSettings.apiUrl ? 
      // If apiUrl ends with /deduplicate, replace it with /test-connection
      splinkSettings.apiUrl.replace(/\/deduplicate$/, '/test-connection') : 
      'http://localhost:5000/test-connection';
    
    console.log("Testing Splink API connection at:", testUrl);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        ...(splinkSettings.apiKey ? { 'Authorization': `Bearer ${splinkSettings.apiKey}` } : {})
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("Splink API connection test response:", data);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Splink API connection test failed:', error);
    return false;
  }
};

// String normalization functions
export const normalizeString = (str: string): string => {
  if (!str) return '';
  
  // Convert to lowercase
  let normalized = str.toLowerCase();
  
  // Remove non-alphanumeric characters (except spaces)
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  
  // Trim extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
};

// Optimized postcode processing functions
// Create a cache for postcode processing to avoid redundant calculations
const postcodeCache = new Map<string, string>();

// Extract postcode sector efficiently (e.g., "AB12 3" from "AB12 3CD")
export const extractPostcodeSector = (postcode: string): string => {
  if (!postcode) return '';
  
  // Check cache first
  const cacheKey = `sector_${postcode}`;
  if (postcodeCache.has(cacheKey)) {
    return postcodeCache.get(cacheKey) || '';
  }
  
  // Normalize and clean the postcode
  const cleanPostcode = postcode.trim().toUpperCase().replace(/\s+/g, ' ');
  
  // Fast extraction using substring operations instead of regex
  const parts = cleanPostcode.split(' ');
  let sector = '';
  
  if (parts.length === 2 && parts[1].length >= 1) {
    // Take the outward code and first digit of the inward code
    sector = `${parts[0]} ${parts[1][0]}`;
  } else if (cleanPostcode.length >= 4) {
    // If no space, try to split at appropriate position
    const outwardEnd = cleanPostcode.length - 3;
    const possibleSector = `${cleanPostcode.substring(0, outwardEnd)} ${cleanPostcode.charAt(outwardEnd)}`;
    sector = possibleSector;
  } else {
    sector = cleanPostcode; // Can't determine sector, use full postcode
  }
  
  // Cache the result
  postcodeCache.set(cacheKey, sector);
  return sector;
};

// Extract postcode district efficiently (e.g., "AB12" from "AB12 3CD")
export const extractPostcodeDistrict = (postcode: string): string => {
  if (!postcode) return '';
  
  // Check cache first
  const cacheKey = `district_${postcode}`;
  if (postcodeCache.has(cacheKey)) {
    return postcodeCache.get(cacheKey) || '';
  }
  
  // Normalize and clean the postcode
  const cleanPostcode = postcode.trim().toUpperCase().replace(/\s+/g, ' ');
  
  // Fast extraction using substring operations
  const parts = cleanPostcode.split(' ');
  let district = '';
  
  if (parts.length >= 1) {
    // The outward code is the district
    district = parts[0];
  } else if (cleanPostcode.length >= 3) {
    // If no space, try to extract the outward code
    const outwardEnd = Math.max(cleanPostcode.length - 3, Math.floor(cleanPostcode.length / 2));
    district = cleanPostcode.substring(0, outwardEnd);
  } else {
    district = cleanPostcode; // Can't determine district, use full postcode
  }
  
  // Cache the result
  postcodeCache.set(cacheKey, district);
  return district;
};

// Parse CSV data
export const parseCSV = (csvData: string): any[] => {
  const lines = csvData.split('\n');
  const headers = lines[0].split(',').map(header => header.trim());
  
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const obj: Record<string, string> = {};
    const currentLine = lines[i].split(',');
    
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentLine[j]?.trim() || '';
    }
    
    result.push(obj);
  }
  
  return result;
};

// Convert array data to CSV string
export const convertToCSV = (data: any[]): string => {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add header row
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + row[header]).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

// Configuration storage functions
export const saveConfiguration = (config: DedupeConfig): SavedConfig => {
  if (!config.name) {
    throw new Error('Configuration name is required');
  }
  
  const savedConfigs = getConfigurations();
  
  // Create a new saved config
  const newConfig: SavedConfig = {
    id: generateId(),
    name: config.name,
    config,
    createdAt: Date.now()
  };
  
  // Check if a config with this name already exists
  const existingIndex = savedConfigs.findIndex(c => c.name === config.name);
  if (existingIndex >= 0) {
    // Update the existing config
    savedConfigs[existingIndex] = newConfig;
  } else {
    // Add the new config
    savedConfigs.push(newConfig);
  }
  
  // Save to localStorage - only in browser context
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('dedupe-configurations', JSON.stringify(savedConfigs));
  }
  
  return newConfig;
};

export const getConfigurations = (): SavedConfig[] => {
  // Only try localStorage in browser context
  if (typeof window !== 'undefined' && window.localStorage) {
    const configsJson = localStorage.getItem('dedupe-configurations');
    if (!configsJson) return [];
    
    try {
      return JSON.parse(configsJson);
    } catch (e) {
      console.error('Error parsing saved configurations:', e);
      return [];
    }
  }
  
  // Default for worker context
  return [];
};

export const deleteConfiguration = (configId: string): void => {
  // Only operate in browser context
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  const configs = getConfigurations();
  const updatedConfigs = configs.filter(config => config.id !== configId);
  localStorage.setItem('dedupe-configurations', JSON.stringify(updatedConfigs));
};

// Generate a unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

// Preprocess data for comparison
const preprocessDataForComparison = (
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig,
  optimizePostcodeProcessing: boolean = false
): any[] => {
  // If postcode optimization is enabled, pre-process all postcodes in bulk first
  if (optimizePostcodeProcessing) {
    // Clear the cache before processing
    postcodeCache.clear();
    
    // Find all postcode columns used in blocking or comparison
    const postcodeColumns = new Set<string>();
    
    // Check for postcode columns in blocking rules
    for (const blockingColumn of config.blockingColumns) {
      if (blockingColumn.toLowerCase().includes('postcode')) {
        postcodeColumns.add(blockingColumn);
      }
    }
    
    // Check for postcode columns in comparison rules
    for (const comparison of config.comparisons) {
      if (comparison.column.toLowerCase().includes('postcode')) {
        postcodeColumns.add(comparison.column);
      }
    }
    
    // Pre-populate the cache for all postcodes
    if (postcodeColumns.size > 0) {
      console.time('Postcode bulk preprocessing');
      
      for (const row of data) {
        for (const column of postcodeColumns) {
          const postcode = row[column];
          if (postcode) {
            // Pre-calculate and cache sector and district
            extractPostcodeSector(postcode);
            extractPostcodeDistrict(postcode);
          }
        }
      }
      
      console.timeEnd('Postcode bulk preprocessing');
    }
  }
  
  return data.map(row => {
    const processedRow = { ...row };
    
    // Get all columns that are used in comparisons
    const comparisonColumns = config.comparisons.map(comp => comp.column);
    
    // Normalize values in comparison columns
    comparisonColumns.forEach(column => {
      if (processedRow[column]) {
        // Store both the original and normalized values
        processedRow[`__original_${column}`] = processedRow[column];
        processedRow[column] = normalizeString(processedRow[column]);
      }
    });
    
    return processedRow;
  });
};

// Main deduplication function - decides whether to use Splink or local implementation
export const deduplicateData = async (
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig,
  onProgress?: (progress: DedupeProgress) => void,
  optimizePostcodeProcessing: boolean = true,
  providedSettings?: SplinkSettings
): Promise<DedupeResult> => {
  console.log('Deduplicating with config:', config);
  console.log('Postcode optimization enabled:', optimizePostcodeProcessing);
  
  // Update progress if callback provided
  if (onProgress) {
    onProgress({
      status: 'processing',
      percentage: 10,
      statusMessage: 'Initializing deduplication process...',
      recordsProcessed: 0,
      totalRecords: data.length
    });
  }
  
  // Generate a job ID for tracking progress
  const jobId = generateId();
  
  try {
    let result: DedupeResult;
    
    // Use Splink if enabled in the config
    if (config.useSplink) {
      // Update progress
      if (onProgress) {
        onProgress({
          status: 'processing',
          percentage: 20,
          statusMessage: 'Preparing data for Splink processing...',
          recordsProcessed: Math.floor(data.length * 0.2),
          totalRecords: data.length
        });
      }
      
      try {
        // First check if Splink API is available
        const isApiAvailable = await testSplinkConnection(providedSettings);
        
        if (!isApiAvailable) {
          if (onProgress) {
            onProgress({
              status: 'processing',
              percentage: 30,
              statusMessage: 'Splink API is not available. Falling back to local deduplication...',
              recordsProcessed: Math.floor(data.length * 0.3),
              totalRecords: data.length
            });
          }
          throw new Error('Splink API is not available');
        }
        
        // If API is available, use Splink with postcode optimization
        result = await deduplicateWithSplink(data, mappedColumns, config, onProgress, optimizePostcodeProcessing, providedSettings);
      } catch (error) {
        console.warn('Failed to use Splink, falling back to local implementation:', error);
        if (onProgress) {
          onProgress({
            status: 'processing',
            percentage: 30,
            statusMessage: 'Splink processing failed. Falling back to local deduplication...',
            recordsProcessed: Math.floor(data.length * 0.3),
            totalRecords: data.length
          });
        }
        // Fall back to local implementation if Splink fails
        result = await deduplicateLocally(data, mappedColumns, config, onProgress, optimizePostcodeProcessing);
      }
    } else {
      // Use local implementation as requested
      result = await deduplicateLocally(data, mappedColumns, config, onProgress, optimizePostcodeProcessing);
    }
    
    // Add job ID to result for progress tracking
    result.jobId = jobId;
    
    // Final progress update
    if (onProgress) {
      onProgress({
        status: 'completed',
        percentage: 100,
        statusMessage: `Deduplication completed successfully. Found ${result.duplicateRows} duplicate records.`,
        recordsProcessed: data.length,
        totalRecords: data.length
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error in deduplication process:', error);
    
    // Update progress with error
    if (onProgress) {
      onProgress({
        status: 'failed',
        percentage: 0,
        statusMessage: 'Deduplication process failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
    
    throw error;
  }
};

// Updated deduplicateWithSplink function
export const deduplicateWithSplink = async (
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig,
  onProgress?: (progress: DedupeProgress) => void,
  optimizePostcodeProcessing: boolean = true,
  providedSettings?: SplinkSettings
): Promise<DedupeResult> => {
  // Get Splink settings from provided settings or localStorage
  const splinkSettings = getSplinkSettings(providedSettings);
  
  if (!splinkSettings.apiUrl) {
    throw new Error('Splink API URL is not configured');
  }
  
  // Update progress
  if (onProgress) {
    onProgress({
      status: 'processing',
      percentage: 30,
      statusMessage: 'Preparing data for Splink API...',
      recordsProcessed: 0,
      totalRecords: data.length,
      debugInfo: `Starting data preparation, ${data.length} total records`
    });
  }
  
  let payload;
  
  try {
    console.log('=== SPLINK PROCESSING START ===');
    console.log(`Processing ${data.length} records with ${mappedColumns.length} mapped columns`);
    console.time('formatDataForSplinkApi');
    
    // Format data for the Splink API with chunking and progress updates
    payload = await formatDataForSplinkApi(data, mappedColumns, config, onProgress);
    
    console.timeEnd('formatDataForSplinkApi');
    console.log('Payload prepared successfully');
    
    // Update progress
    if (onProgress) {
      onProgress({
        status: 'processing',
        percentage: 40,
        statusMessage: 'Sending data to Splink API for processing...',
        recordsProcessed: data.length,
        totalRecords: data.length,
        debugInfo: `Data preparation complete, sending to API`
      });
    }
    
    // Yield to the main thread again before making the API request
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Make the API request
    console.log('Sending data to Splink API:', splinkSettings.apiUrl);
    console.time('splinkApiRequest');
    
    const response = await fetch(splinkSettings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(splinkSettings.apiKey ? { 'Authorization': `Bearer ${splinkSettings.apiKey}` } : {})
      },
      body: JSON.stringify(payload)
    });
    
    console.timeEnd('splinkApiRequest');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API request failed:', errorText);
      throw new Error(`Splink API error: ${errorText}`);
    }
    
    console.log('API request successful, parsing response');
    const apiResponse = await response.json();
    console.log('API response received:', apiResponse);
    
    // Update progress
    if (onProgress) {
      onProgress({
        status: 'processing',
        percentage: 60,
        statusMessage: 'Job submitted successfully. Waiting for processing...',
        recordsProcessed: Math.floor(data.length * 0.6),
        totalRecords: data.length,
        debugInfo: `Job submitted with ID: ${apiResponse.job_id || 'unknown'}`
      });
    }
    
    console.log('=== SPLINK PROCESSING COMPLETE ===');
    
    // Process the API response
    return processSplinkResponse(apiResponse, data);
  } catch (error) {
    console.error('Error using Splink API:', error);
    if (onProgress) {
      onProgress({
        status: 'failed',
        percentage: 0,
        statusMessage: 'Splink processing failed',
        error: error instanceof Error ? error.message : 'Unknown error in Splink processing',
        debugInfo: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
    throw error;
  }
};

// Our local implementation of pollDedupeStatus
export const pollDedupeStatus = async (
  jobId: string, 
  onProgress: (progress: DedupeProgress) => void,
  maxAttempts = 100,
  interval = 3000
): Promise<void> => {
  if (!jobId) {
    console.warn('No job ID provided for status polling');
    return;
  }

  let attempts = 0;
  
  const splinkSettings = getSplinkSettings();
  const apiBaseUrl = splinkSettings.apiUrl || 'http://localhost:5000/api/deduplicate';
  
  const checkStatus = async () => {
    try {
      if (attempts >= maxAttempts) {
        console.warn('Max polling attempts reached');
        onProgress({
          status: 'processing',
          percentage: 95,
          statusMessage: 'Processing is taking longer than expected. Please check results page later.',
        });
        return;
      }
      
      attempts++;
      
      const progress = await checkSplinkJobStatus(jobId, apiBaseUrl, splinkSettings.apiKey);
      
      onProgress(progress);
      
      if (progress.status !== 'completed' && progress.status !== 'failed') {
        setTimeout(checkStatus, interval);
      }
    } catch (error) {
      console.error('Error checking deduplication status:', error);
      
      if (attempts < maxAttempts) {
        setTimeout(checkStatus, interval);
      } else {
        onProgress({
          status: 'processing',
          percentage: 95,
          statusMessage: 'Unable to fetch status updates. Process may still be running.',
        });
      }
    }
  };
  
  checkStatus();
};

// Enhanced local deduplication function with progress tracking
export const deduplicateLocally = async (
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig,
  onProgress?: (progress: DedupeProgress) => void,
  optimizePostcodeProcessing: boolean = true
): Promise<DedupeResult> => {
  console.log('Deduplicating locally with config:', config);
  console.log('Optimizing postcode processing:', optimizePostcodeProcessing);
  
  // Apply column mapping
  if (onProgress) {
    onProgress({
      status: 'processing',
      percentage: 20,
      statusMessage: 'Mapping columns...',
      recordsProcessed: Math.floor(data.length * 0.2),
      totalRecords: data.length
    });
  }
  
  const processedData = data.map(row => {
    const newRow: Record<string, any> = {};
    mappedColumns.forEach(col => {
      if (col.include && col.mappedName) {
        newRow[col.mappedName] = row[col.originalName];
      }
    });
    return newRow;
  });
  
  // Preprocess data for better matching
  if (onProgress) {
    onProgress({
      status: 'processing',
      percentage: 30,
      statusMessage: 'Preprocessing data for comparison...',
      recordsProcessed: Math.floor(data.length * 0.3),
      totalRecords: data.length
    });
  }
  
  const normalizedData = preprocessDataForComparison(
    processedData, 
    mappedColumns, 
    config, 
    optimizePostcodeProcessing
  );
  
  // Apply blocking rules
  if (onProgress) {
    onProgress({
      status: 'blocked',
      percentage: 40,
      statusMessage: 'Applying blocking rules...',
      recordsProcessed: Math.floor(data.length * 0.4),
      totalRecords: data.length
    });
  }
  
  // Simple deduplication based on exact matches of blocking columns
  const uniqueMap = new Map();
  const clusters: any[] = [];
  
  normalizedData.forEach((row, index) => {
    // Create a key based on blocking columns (using normalized values)
    const blockingKey = config.blockingColumns
      .map(col => row[col] || '')
      .join('|');
    
    if (!uniqueMap.has(blockingKey)) {
      uniqueMap.set(blockingKey, { index, cluster: clusters.length });
      clusters.push([index]);
    } else {
      const { cluster } = uniqueMap.get(blockingKey);
      clusters[cluster].push(index);
    }
  });
  
  // Update progress
  if (onProgress) {
    onProgress({
      status: 'processing',
      percentage: 60,
      statusMessage: 'Comparing records within blocks...',
      recordsProcessed: Math.floor(data.length * 0.6),
      totalRecords: data.length
    });
  }
  
  // Improve matching within clusters using comparison columns
  const improvedClusters: any[] = [];
  
  let processedClusters = 0;
  const totalClusters = clusters.length;
  
  for (const cluster of clusters) {
    if (cluster.length <= 1) {
      // No need to compare, add as is
      improvedClusters.push(cluster);
    } else {
      // Create sub-clusters based on comparison columns
      const subClusters: number[][] = [];
      const assigned = new Set<number>();
      
      // Compare each record with every other record in the cluster
      for (let i = 0; i < cluster.length; i++) {
        if (assigned.has(cluster[i])) continue;
        
        const subCluster = [cluster[i]];
        assigned.add(cluster[i]);
        
        for (let j = i + 1; j < cluster.length; j++) {
          if (assigned.has(cluster[j])) continue;
          
          // Check if records are similar based on comparison columns
          const record1 = normalizedData[cluster[i]];
          const record2 = normalizedData[cluster[j]];
          
          let totalScore = 0;
          let totalWeight = 0;
          
          // Compare each field according to the comparison config
          for (const comp of config.comparisons) {
            const field1 = record1[comp.column] || '';
            const field2 = record2[comp.column] || '';
            
            let score = 0;
            
            // Apply different matching strategies
            if (comp.matchType === 'exact') {
              score = field1 === field2 ? 1 : 0;
            } else if (comp.matchType === 'fuzzy') {
              score = calculateSimilarity(field1, field2);
            } else if (comp.matchType === 'partial') {
              score = field1.includes(field2) || field2.includes(field1) ? 
                Math.min(field1.length, field2.length) / Math.max(field1.length, field2.length) : 0;
            }
            
            // Apply threshold for non-exact matches
            if (comp.matchType !== 'exact' && comp.threshold && score < comp.threshold) {
              score = 0;
            }
            
            totalScore += score;
            totalWeight += 1;
          }
          
          const similarityScore = totalWeight > 0 ? totalScore / totalWeight : 0;
          
          // If similarity is above threshold, add to the same sub-cluster
          if (similarityScore >= config.threshold) {
            subCluster.push(cluster[j]);
            assigned.add(cluster[j]);
          }
        }
        
        subClusters.push(subCluster);
      }
      
      // Add all sub-clusters to the improved clusters
      improvedClusters.push(...subClusters);
    }
    
    // Update progress for cluster processing
    processedClusters++;
    if (onProgress && processedClusters % 10 === 0) {
      const percentComplete = 60 + Math.min(30, Math.floor((processedClusters / totalClusters) * 30));
      onProgress({
        status: 'clustering',
        percentage: percentComplete,
        statusMessage: `Clustering similar records (${processedClusters}/${totalClusters})...`,
        recordsProcessed: Math.floor(data.length * (percentComplete / 100)),
        totalRecords: data.length
      });
    }
  }
  
  // Final clustering update
  if (onProgress) {
    onProgress({
      status: 'clustering',
      percentage: 90,
      statusMessage: 'Finalizing clusters...',
      recordsProcessed: Math.floor(data.length * 0.9),
      totalRecords: data.length
    });
  }
  
  // Get unique rows (first from each cluster)
  const uniqueRows = improvedClusters.map(cluster => processedData[cluster[0]]);
  
  // Create flagged data with duplicate information
  const flaggedData = processedData.map((row, index) => {
    // Find which cluster this row belongs to
    const clusterIndex = improvedClusters.findIndex(cluster => cluster.includes(index));
    const cluster = improvedClusters[clusterIndex];
    
    // Determine if this row is a duplicate (not the first in its cluster)
    const isDuplicate = cluster && cluster.indexOf(index) !== 0;
    
    return {
      ...row,
      __is_duplicate: isDuplicate ? 'Yes' : 'No',
      __cluster_id: clusterIndex >= 0 ? `cluster_${clusterIndex}` : 'unique',
      __record_id: `record_${index}`
    };
  });
  
  return {
    originalRows: data.length,
    uniqueRows: uniqueRows.length,
    duplicateRows: data.length - uniqueRows.length,
    clusters: improvedClusters,
    processedData: uniqueRows, // Return only unique rows
    flaggedData: flaggedData, // Return all rows with flags
  };
};

// Helper function to calculate string similarity (Levenshtein distance based)
const calculateSimilarity = (str1: string, str2: string): number => {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  
  // For very short strings, use exact matching
  if (str1.length <= 2 || str2.length <= 2) {
    return str1 === str2 ? 1 : 0;
  }
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Initialize matrix
  const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  // Fill the first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  // Fill the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  // Calculate similarity based on maximum possible distance
  const maxDistance = Math.max(len1, len2);
  const distance = matrix[len1][len2];
  
  return maxDistance > 0 ? 1 - (distance / maxDistance) : 1;
};

// Download CSV
export const downloadCSV = (csvData: string, fileName: string): void => {
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
