
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
  useSplink?: boolean; // Added to toggle between local and Splink backend
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
  flaggedData: any[]; // Added this field for data with duplicate flags
}

export type Step = 'upload' | 'mapping' | 'config' | 'results';

export type DownloadFormat = 'deduplicated' | 'flagged';

export interface SplinkSettings {
  apiUrl: string;
  apiKey?: string;
}
