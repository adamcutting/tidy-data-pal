
import { FileData, MappedColumn, DedupeConfig, DedupeResult } from './types';

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
  
  // Simple deduplication based on exact matches of blocking columns
  const uniqueMap = new Map();
  const clusters: any[] = [];
  
  processedData.forEach((row, index) => {
    // Create a key based on blocking columns
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
  
  // Get unique rows (first from each cluster)
  const uniqueRows = clusters.map(cluster => processedData[cluster[0]]);
  
  return {
    originalRows: data.length,
    uniqueRows: uniqueRows.length,
    duplicateRows: data.length - uniqueRows.length,
    clusters,
    processedData: uniqueRows, // Return only unique rows
  };
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
