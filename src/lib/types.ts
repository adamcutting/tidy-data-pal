
export interface FileData {
  fileName: string;
  fileType: string;
  data: any[];
  rawData: string | ArrayBuffer | null;
  columns: string[];
}

export interface MappedColumn {
  originalName: string;
  mappedName: string | null;
  include: boolean;
}

export interface DedupeConfig {
  name?: string;
  comparisons: {
    column: string;
    matchType: 'exact' | 'fuzzy' | 'partial';
    threshold?: number;
  }[];
  blockingColumns: string[];
  threshold: number;
  useSplink?: boolean; // Toggle between local and Splink backend
}

export interface SavedConfig {
  id: string;
  name: string;
  config: DedupeConfig;
  createdAt: number;
}

export interface DedupeResult {
  originalRows: number;
  uniqueRows: number;
  duplicateRows: number;
  clusters: any[];
  processedData: any[];
  flaggedData: any[]; // Data with duplicate flags
  resultId?: string;  // Added for API result reference
}

export type Step = 'upload' | 'mapping' | 'config' | 'results';

export type DownloadFormat = 'deduplicated' | 'flagged';

export interface SplinkSettings {
  apiUrl: string;
  apiKey?: string;
}

// MySQL connection configuration
export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

// API request for database data loading
export interface DatabaseLoadRequest {
  connectionConfig: MySQLConfig;
  query: string;  // SQL query or table name
  isTable: boolean; // Whether the query parameter is a table name or SQL query
}

// API request for automated deduplication
export interface AutoDedupeRequest {
  data: any[];  // Data to deduplicate
  configId: string;  // ID of saved configuration to use
  resultLocation?: string; // Optional folder path to save results
}

// API response for automated deduplication
export interface AutoDedupeResponse {
  success: boolean;
  resultId: string;
  message: string;
  stats?: {
    originalRows: number;
    uniqueRows: number;
    duplicateRows: number;
  };
  resultLocation?: string;
}

// Storage for completed dedupe jobs
export interface DedupeJob {
  id: string;
  configId: string;
  timestamp: number;
  status: 'completed' | 'failed';
  stats: {
    originalRows: number;
    uniqueRows: number;
    duplicateRows: number;
  };
  resultLocation?: string;
}
