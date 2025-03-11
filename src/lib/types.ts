
export interface FileData {
  fileName: string;
  fileType: string;
  data: any[];
  rawData: string | ArrayBuffer | null;
  columns: string[];
  totalRows?: number; // Added for large dataset support
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
  useSplink?: boolean; // Toggle between local and Splink backend
  splinkParams?: {
    termFrequencyAdjustments?: boolean;
    retainMatchingColumns?: boolean;
    retainIntermediateCalculations?: boolean;
    trainModel?: boolean;
    clusteringThreshold?: number;
    uniqueIdColumn?: string; // Used for Splink's unique ID requirement
    pythonPath?: string;     // Path to Python executable (only needed for local Splink)
    enableLargeDatasetMode?: boolean; // Added for large dataset support
    maxChunkSize?: number;   // Added for large dataset support
  };
  splinkSettings?: SplinkSettings; // Added to support outputDir and other Splink settings
  dataSource: 'file' | 'database';
  databaseConfig?: {
    databaseType: DatabaseType;
    connectionConfig: MySQLConfig | MSSQLConfig;
    query: string;
    isTable: boolean;
  };
  enableStreamProcessing?: boolean; // Added for large dataset support
  useWebWorker?: boolean; // Added for Web Worker support
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
  outputDir?: string;  // Added for specifying output directory
  largeDatasetThreshold?: number; // Added for large dataset support
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
  }
}

export type DatabaseType = 'mysql' | 'mssql';

export interface DatabaseLoadRequest {
  databaseType: DatabaseType;
  connectionConfig: MySQLConfig | MSSQLConfig;
  query: string;  // SQL query or table name
  isTable: boolean; // Whether the query parameter is a table name or SQL query
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
  chunked?: boolean; // Added for large dataset support
  processedChunks?: number; // Added for large dataset support
  totalChunks?: number; // Added for large dataset support
}

export type DedupeProgress = {
  status: 'waiting' | 'connecting' | 'loading' | 'processing' | 'blocked' | 'clustering' | 'completed' | 'failed' | 'cancelled';
  percentage: number;
  statusMessage: string;
  estimatedTimeRemaining?: string;
  recordsProcessed?: number;
  totalRecords?: number;
  error?: string;
  chunked?: boolean; // Added for large dataset support
  currentChunk?: number; // Added for large dataset support
  totalChunks?: number; // Added for large dataset support
  debugInfo?: string; // Added for detailed debugging information
  stage?: string; // Added for more detailed progress tracking
};

// Web Worker message types
export interface WorkerReadyMessage {
  type: 'ready';
}

export interface WorkerInitMessage {
  type: 'init';
  data: any[];
  mappedColumns: MappedColumn[];
  config: DedupeConfig;
}

export interface WorkerProgressMessage {
  type: 'progress';
  progress: DedupeProgress;
}

export interface WorkerResultMessage {
  type: 'result';
  result: any;
}

export interface WorkerErrorMessage {
  type: 'error';
  error: string;
}

export type WorkerOutboundMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage | WorkerReadyMessage;
export type WorkerInboundMessage = WorkerInitMessage;
