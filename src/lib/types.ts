
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
  comparisons: {
    column: string;
    matchType: 'exact' | 'fuzzy' | 'partial';
    threshold?: number;
  }[];
  blockingColumns: string[];
  threshold: number;
}

export interface DedupeResult {
  originalRows: number;
  uniqueRows: number;
  duplicateRows: number;
  clusters: any[];
  processedData: any[];
}

export type Step = 'upload' | 'mapping' | 'config' | 'results';
