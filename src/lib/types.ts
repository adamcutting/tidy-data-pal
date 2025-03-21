
export interface FileData {
  fileName: string;
  fileType: string;
  data: any[];
  rawData: string | ArrayBuffer | null;
  columns: string[];
  totalRows?: number;
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
  uniqueIdColumn?: string; // Ensure this is properly defined
  useSplink: boolean;
  splinkParams?: {
    termFrequencyAdjustments?: boolean;
    retainMatchingColumns?: boolean;
    retainIntermediateCalculations?: boolean;
    trainModel?: boolean;
    clusteringThreshold?: number;
    uniqueIdColumn?: string;
    pythonPath?: string;
    enableLargeDatasetMode?: boolean;
    maxChunkSize?: number;
    useSpark?: boolean;
  };
  splinkSettings?: SplinkSettings;
  dataSource: 'file' | 'database';
  databaseConfig?: {
    databaseType: DatabaseType;
    connectionConfig: MySQLConfig | MSSQLConfig;
    query: string;
    isTable: boolean;
  };
  enableStreamProcessing?: boolean;
  useWebWorker?: boolean;
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
  clusters: any[][];
  processedData: any[];
  flaggedData: any[];
  jobId?: string;
  processingTimeMs?: number;
  startTime?: number;
  resultId?: string;
}

export type Step = 'upload' | 'mapping' | 'config' | 'progress' | 'results' | 'jobs';

export type DownloadFormat = 'deduplicated' | 'flagged';

export interface SplinkSettings {
  apiUrl: string;
  apiKey?: string;
  pythonPath?: string;
  scriptPath?: string;
  outputDir?: string;
  largeDatasetThreshold?: number;
  sparkConfig?: SparkConfig;
}

export interface SparkConfig {
  enabled: boolean;
  masterUrl?: string;
  appName?: string;
  executorMemory?: string;
  driverMemory?: string;
  numExecutors?: number;
  executorCores?: number;
  shufflePartitions?: number;
  localDir?: string;
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
  query: string;
  isTable: boolean;
}

export interface AutoDedupeRequest {
  data: any[];
  configId: string;
  resultLocation?: string;
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
  chunked?: boolean;
  processedChunks?: number;
  totalChunks?: number;
}

export interface ActiveJob {
  jobId: string;
  startTime: number;
  status?: 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting' | 'connecting' | 'loading' | 'processing' | 'blocked' | 'clustering';
  progress?: DedupeProgress;
  configName?: string;
  dataSource?: string;
  rowCount?: number;
}

export type DedupeProgress = {
  status: 'waiting' | 'connecting' | 'loading' | 'processing' | 'blocked' | 'clustering' | 'completed' | 'failed' | 'cancelled';
  percentage: number;
  statusMessage: string;
  estimatedTimeRemaining?: string;
  recordsProcessed?: number;
  totalRecords?: number;
  error?: string;
  chunked?: boolean;
  currentChunk?: number;
  totalChunks?: number;
  debugInfo?: string;
  stage?: string;
  result?: DedupeResult;
  warning?: string; // Added warning property for local processing fallback alerts
};

export interface WorkerReadyMessage {
  type: 'ready';
}

export interface WorkerInitMessage {
  type: 'init';
  data: any[];
  mappedColumns: MappedColumn[];
  config: DedupeConfig;
}

export interface WorkerDeduplicateMessage {
  type: 'deduplicate';
  data: {
    data: any[];
    mappedColumns: MappedColumn[];
    config: DedupeConfig;
    jobId: string;
    optimizePostcodeProcessing: boolean;
  };
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

export interface WorkerSplinkJobMessage {
  type: 'splink-job';
  data: {
    jobId: string;
    readyForSubmission: boolean;
    totalRows: number;
  };
}

export type WorkerOutboundMessage = 
  | WorkerProgressMessage 
  | WorkerResultMessage 
  | WorkerErrorMessage 
  | WorkerReadyMessage
  | WorkerSplinkJobMessage;

export type WorkerInboundMessage = WorkerInitMessage | WorkerDeduplicateMessage;
