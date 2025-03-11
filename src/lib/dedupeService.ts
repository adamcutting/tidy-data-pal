import { FileData, MappedColumn, DedupeConfig, DedupeResult, SavedConfig, SplinkSettings, DedupeProgress } from './types';
import { pollDedupeStatus } from './sqlService';

// Default Splink settings
const DEFAULT_SPLINK_SETTINGS: SplinkSettings = {
  apiUrl: 'http://localhost:5000/api/deduplicate', // Default to local development server
};

// Get Splink settings from localStorage or use defaults
export const getSplinkSettings = (): SplinkSettings => {
  const settingsJson = localStorage.getItem('splink-settings');
  if (!settingsJson) return DEFAULT_SPLINK_SETTINGS;
  
  try {
    return JSON.parse(settingsJson);
  } catch (e) {
    console.error('Error parsing Splink settings:', e);
    return DEFAULT_SPLINK_SETTINGS;
  }
};

// Save Splink settings to localStorage
export const saveSplinkSettings = (settings: SplinkSettings): void => {
  localStorage.setItem('splink-settings', JSON.stringify(settings));
};

// Test Splink API connection
export const testSplinkConnection = async (): Promise<boolean> => {
  const splinkSettings = getSplinkSettings();
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
  
  // Save to localStorage
  localStorage.setItem('dedupe-configurations', JSON.stringify(savedConfigs));
  
  return newConfig;
};

export const getConfigurations = (): SavedConfig[] => {
  const configsJson = localStorage.getItem('dedupe-configurations');
  if (!configsJson) return [];
  
  try {
    return JSON.parse(configsJson);
  } catch (e) {
    console.error('Error parsing saved configurations:', e);
    return [];
  }
};

export const deleteConfiguration = (configId: string): void => {
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
  config: DedupeConfig
): any[] => {
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
  onProgress?: (progress: DedupeProgress) => void
): Promise<DedupeResult> => {
  console.log('Deduplicating with config:', config);
  
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
        const isApiAvailable = await testSplinkConnection();
        
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
        
        // If API is available, use Splink
        result = await deduplicateWithSplink(data, mappedColumns, config, onProgress);
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
        result = await deduplicateLocally(data, mappedColumns, config, onProgress);
      }
    } else {
      // Use local implementation as requested
      result = await deduplicateLocally(data, mappedColumns, config, onProgress);
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

// Update the polling function to use the new status check endpoint
export const pollDedupeStatus = async (
  jobId: string, 
  onProgress: (progress: DedupeProgress) => void,
  maxAttempts = 100,  // Increased max attempts for large jobs
  interval = 3000     // Poll every 3 seconds
): Promise<void> => {
  if (!jobId) {
    console.warn('No job ID provided for status polling');
    return;
  }

  let attempts = 0;
  
  // Get the Splink API URL from settings
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
      
      // Import the status checking function from splinkAdapter
      const { checkSplinkJobStatus } = await import('./splinkAdapter');
      
      // Get the current status
      const progress = await checkSplinkJobStatus(jobId, apiBaseUrl, splinkSettings.apiKey);
      
      // Update the progress
      onProgress(progress);
      
      // Continue polling if not complete
      if (progress.status !== 'completed' && progress.status !== 'failed') {
        setTimeout(checkStatus, interval);
      }
    } catch (error) {
      console.error('Error checking deduplication status:', error);
      
      // Continue polling even if there's an error
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
  
  // Start polling
  checkStatus();
};

// Update the deduplicateWithSplink function to use the improved job tracking
export const deduplicateWithSplink = async (
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig,
  progressCallback?: (progress: DedupeProgress) => void
): Promise<DedupeResult> => {
  try {
    // Update progress
    if (progressCallback) {
      progressCallback({
        status: 'processing',
        percentage: 10,
        statusMessage: 'Preparing data for Splink API...'
      });
    }

    // Import our adapter functions
    const { formatDataForSplinkApi, processSplinkResponse } = await import('./splinkAdapter');
    
    // Format the data for the Splink API
    const formattedData = formatDataForSplinkApi(data, mappedColumns, config);
    
    // Store the job ID for polling
    const jobId = formattedData.job_id;
    
    // Update progress
    if (progressCallback) {
      progressCallback({
        status: 'processing',
        percentage: 30,
        statusMessage: 'Sending data to Splink API...',
        recordsProcessed: 0,
        totalRecords: data.length
      });
    }

    // Get the API URL from settings
    const splinkSettings = getSplinkSettings();
    const apiUrl = splinkSettings.apiUrl || 'http://localhost:5000/api/deduplicate';
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(splinkSettings.apiKey ? { 'Authorization': `Bearer ${splinkSettings.apiKey}` } : {})
      },
      body: JSON.stringify(formattedData)
    });

    // Update progress
    if (progressCallback) {
      progressCallback({
        status: 'processing',
        percentage: 70,
        statusMessage: 'Processing results from Splink API...',
        recordsProcessed: Math.floor(data.length * 0.7),
        totalRecords: data.length
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Splink API error (${response.status}): ${errorText}`);
    }

    const apiResponse = await response.json();
    
    // Start the status polling if we have a job ID
    if (jobId && progressCallback) {
      pollDedupeStatus(jobId, progressCallback);
    }
    
    // Update progress
    if (progressCallback) {
      progressCallback({
        status: 'completed',
        percentage: 100,
        statusMessage: 'Deduplication complete!'
      });
    }

    // Process the response
    const result = processSplinkResponse(apiResponse, data);
    
    // Ensure the jobId is included in the result
    result.jobId = jobId || result.jobId;
    
    return result;
  } catch (error) {
    console.error('Error in deduplicateWithSplink:', error);
    
    // Update progress with error
    if (progressCallback) {
      progressCallback({
        status: 'failed',
        percentage: 0,
        statusMessage: 'Deduplication failed',
        error: error instanceof Error ? error.message : 'Unknown error during deduplication'
      });
    }
    
    throw error;
  }
};

// Enhanced local deduplication function with progress tracking
export const deduplicateLocally = async (
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig,
  onProgress?: (progress: DedupeProgress) => void
): Promise<DedupeResult> => {
  console.log('Deduplicating locally with config:', config);
  
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
  
  const normalizedData = preprocessDataForComparison(processedData, mappedColumns, config);
  
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
