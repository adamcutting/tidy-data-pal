
/**
 * Utility functions for detecting and handling Spark-related features
 */

import { DedupeProgress } from './types';

/**
 * Determines if a job is using Apache Spark based on its progress information
 * @param progress The job progress data
 * @returns True if the job is using Spark, false otherwise
 */
export const isUsingSparkEngine = (progress?: DedupeProgress): boolean => {
  if (!progress) return false;
  
  // Check multiple fields for Spark-related indicators
  return (
    (progress.debugInfo?.toLowerCase().includes('spark') || false) ||
    (progress.stage?.toLowerCase().includes('spark') || false) ||
    (progress.statusMessage?.toLowerCase().includes('spark') || false) ||
    (progress.debugInfo?.includes('PySpark') || false)
  );
};

/**
 * Generates a human-readable description of the Spark configuration
 * @param sparkConfig The Spark configuration object from the job
 * @returns A string describing the Spark configuration
 */
export const getSparkConfigDescription = (sparkConfig?: any): string => {
  if (!sparkConfig) return 'Standard Spark configuration';
  
  const parts: string[] = [];
  
  if (sparkConfig.masterUrl) {
    parts.push(`Master: ${sparkConfig.masterUrl}`);
  }
  
  if (sparkConfig.executorMemory) {
    parts.push(`Executor memory: ${sparkConfig.executorMemory}`);
  }
  
  if (sparkConfig.numExecutors) {
    parts.push(`Executors: ${sparkConfig.numExecutors}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'Custom Spark configuration';
};
