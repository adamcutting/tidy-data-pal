import { FileData, MappedColumn, DedupeConfig, DedupeResult, SavedConfig } from './types';

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

// Mock deduplication function (in a real app, this would use Splink)
export const deduplicateData = (
  data: any[],
  mappedColumns: MappedColumn[],
  config: DedupeConfig
): DedupeResult => {
  console.log('Deduplicating with config:', config);
  
  // This is a simplified mock implementation
  // In a real app, this would use Splink for sophisticated deduplication
  
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
  
  // Improve matching within clusters using comparison columns
  const improvedClusters: any[] = [];
  
  clusters.forEach(cluster => {
    if (cluster.length <= 1) {
      // No need to compare, add as is
      improvedClusters.push(cluster);
      return;
    }
    
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
  });
  
  // Get unique rows (first from each cluster)
  const uniqueRows = improvedClusters.map(cluster => processedData[cluster[0]]);
  
  // Create flagged data with duplicate information
  const flaggedData = processedData.map((row, index) => {
    // Find which cluster this row belongs to
    const clusterIndex = improvedClusters.findIndex(cluster => cluster.includes(index));
    const cluster = improvedClusters[clusterIndex];
    
    // Determine if this row is a duplicate (not the first in its cluster)
    const isDuplicate = cluster.indexOf(index) !== 0;
    
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
