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
    // Attempt a simple HEAD request to check if the API is available
    const response = await fetch(splinkSettings.apiUrl, {
      method: 'HEAD',
      headers: {
        ...(splinkSettings.apiKey ? { 'X-API-Key': splinkSettings.apiKey } : {})
      }
    });
    return response.ok;
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

// Main deduplication function - now always uses Splink
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
    
    // First check if Splink API is available
    const isApiAvailable = await testSplinkConnection();
    
    if (!isApiAvailable) {
      if (onProgress) {
        onProgress({
          status: 'failed',
          percentage: 0,
          statusMessage: 'Splink API is not available. Please check your connection settings.',
          error: 'Failed to connect to Splink API'
        });
      }
      throw new Error('Splink API is not available. Please configure Splink API connection in settings.');
    }
    
    // Use Splink for deduplication
    const result = await deduplicateWithSplink(data, mappedColumns, config, onProgress);
    
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

// Deduplication using Splink API
export const deduplicateWithSplink = async (
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig,
  onProgress?: (progress: DedupeProgress) => void
): Promise<DedupeResult> => {
  // Get Splink API settings
  const splinkSettings = getSplinkSettings();
  
  // Apply column mapping
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
  const normalizedData = preprocessDataForComparison(processedData, mappedColumns, config);
  
  // Update progress
  if (onProgress) {
    onProgress({
      status: 'processing',
      percentage: 30,
      statusMessage: 'Preparing Splink configuration...',
      recordsProcessed: Math.floor(data.length * 0.3),
      totalRecords: data.length
    });
  }
  
  // Prepare additional Splink parameters
  const splinkParams = config.splinkParams || {
    termFrequencyAdjustments: true,
    retainMatchingColumns: true,
    retainIntermediateCalculations: true,
    trainModel: true,
    clusteringThreshold: config.threshold,
    uniqueIdColumn: config.splinkParams?.uniqueIdColumn === 'none' ? undefined : config.splinkParams?.uniqueIdColumn
  };
  
  // Prepare payload for Splink API
  const payload = {
    data: normalizedData,
    config: {
      comparisons: config.comparisons,
      blocking_columns: config.blockingColumns,
      threshold: config.threshold,
      splink_params: splinkParams,
      data_source: config.dataSource,
      database_config: config.databaseConfig
    }
  };
  
  try {
    // Update progress
    if (onProgress) {
      onProgress({
        status: 'processing',
        percentage: 40,
        statusMessage: 'Sending data to Splink API...',
        recordsProcessed: Math.floor(data.length * 0.4),
        totalRecords: data.length
      });
    }
    
    console.log('Calling Splink API at:', splinkSettings.apiUrl);
    const response = await fetch(splinkSettings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(splinkSettings.apiKey ? { 'X-API-Key': splinkSettings.apiKey } : {})
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Splink API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update progress while processing continues on server
    if (onProgress) {
      onProgress({
        status: 'processing',
        percentage: 70,
        statusMessage: 'Splink is processing your data...',
        recordsProcessed: Math.floor(data.length * 0.7),
        totalRecords: data.length
      });
    }
    
    // Transform Splink response to match our DedupeResult interface
    return {
      originalRows: result.originalRows || data.length,
      uniqueRows: result.uniqueRows || 0,
      duplicateRows: result.duplicateRows || 0,
      clusters: result.clusters || [],
      processedData: result.processedData || [],
      flaggedData: result.flaggedData || normalizedData.map((row, index) => ({
        ...row,
        __is_duplicate: result.duplicates?.includes(index) ? 'Yes' : 'No',
        __cluster_id: result.clusterIds?.[index] || `unknown_${index}`,
        __record_id: `record_${index}`
      })),
      resultId: result.resultId
    };
  } catch (error) {
    console.error('Error calling Splink API:', error);
    throw new Error('Failed to process data with Splink. Please check your connection and API settings.');
  }
};

// Helper function to calculate string similarity (used in remaining functions)
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
