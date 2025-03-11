
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

export interface DerivedBlockingRule {
  type: 'postcode-district' | 'postcode-sector';
  sourceColumn: string;
  targetColumn: string;
}

export interface DedupeConfig {
  name?: string;
  comparisons: {
    column: string;
    matchType: 'exact' | 'fuzzy' | 'partial';
    threshold?: number;
  }[];
  blockingColumns: string[];
  derivedBlockingRules?: DerivedBlockingRule[];
  threshold: number;
  useSplink: boolean; // Always true but kept for backward compatibility
  splinkParams?: {
    termFrequencyAdjustments?: boolean;
    retainMatchingColumns?: boolean;
    retainIntermediateCalculations?: boolean;
    trainModel?: boolean;
    clusteringThreshold?: number;
    uniqueIdColumn?: string; // Added this field for Splink's unique ID requirement
  };
  dataSource: 'file' | 'database';
  databaseConfig?: {
    databaseType: DatabaseType;
    connectionConfig: MySQLConfig | MSSQLConfig;
    query: string;
    isTable: boolean;
  };
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
  jobId?: string;     // Added for progress tracking
}

export type Step = 'upload' | 'mapping' | 'config' | 'progress' | 'results';

export type DownloadFormat = 'deduplicated' | 'flagged';

export interface SplinkSettings {
  apiUrl: string;
  apiKey?: string;
  pythonPath?: string;
  scriptPath?: string;
}

export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface MSSQLConfig {
  server: string;
  port: number;
  user: string;
  password: string;
  database: string;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    authentication?: 'default' | 'windows';
    domain?: string;
  }
}

export type DatabaseType = 'mysql' | 'mssql';

export interface DatabaseLoadRequest {
  databaseType: DatabaseType;
  connectionConfig: MySQLConfig | MSSQLConfig;
  query: string;  // SQL query or table name
  isTable: boolean; // Whether the query parameter is a table name or SQL query
}

export interface DatabaseMetadata {
  tables: string[];
  views: string[];
}

export interface AutoDedupeRequest {
  data: any[];  // Data to deduplicate
  configId: string;  // ID of saved configuration to use
  resultLocation?: string; // Optional folder path to save results
}

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

export interface DedupeProgress {
  status: 'waiting' | 'connecting' | 'loading' | 'processing' | 'blocked' | 'clustering' | 'completed' | 'failed';
  percentage: number;
  statusMessage: string;
  estimatedTimeRemaining?: string;
  recordsProcessed?: number;
  totalRecords?: number;
  error?: string;
}
