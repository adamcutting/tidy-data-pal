import { 
  DatabaseLoadRequest, 
  AutoDedupeRequest, 
  AutoDedupeResponse, 
  DedupeResult, 
  SavedConfig,
  DedupeJob,
  DatabaseType,
  ActiveJob
} from './types';
import { deduplicateData } from './dedupeService';
import { getConfigurations } from './dedupeService';

// Base URL for API endpoints
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' // Production API path
  : 'http://localhost:5000/api'; // Development API path

/**
 * Load data from a database (MySQL or MSSQL) via API
 * @param request Database load request with connection details and query
 * @returns Promise with the loaded data
 */
export const loadFromDatabase = async (request: DatabaseLoadRequest): Promise<any[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/database/load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Database load failed: ${errorText}`);
    }

    const data = await response.json();
    return data.rows || [];
  } catch (error) {
    console.error('Error loading from database:', error);
    throw error;
  }
};

/**
 * Run automated deduplication using a saved configuration
 * @param request Request with data and configuration ID
 * @returns Promise with deduplication results
 */
export const runAutomatedDedupe = async (request: AutoDedupeRequest): Promise<AutoDedupeResponse> => {
  try {
    // Get the saved configuration
    const savedConfigs = getConfigurations();
    const config = savedConfigs.find(c => c.id === request.configId);
    
    if (!config) {
      throw new Error(`Configuration with ID ${request.configId} not found`);
    }

    // Prepare payload for the API
    const payload = {
      data: request.data,
      config: config.config,
      resultLocation: request.resultLocation
    };

    // Call the API endpoint
    const response = await fetch(`${API_BASE_URL}/dedupe/automated`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Automated deduplication failed: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error running automated deduplication:', error);
    throw error;
  }
};

/**
 * Get results of a previous deduplication job
 * @param resultId ID of the deduplication result
 * @returns Promise with the deduplication result
 */
export const getDedupeResults = async (resultId: string): Promise<DedupeResult> => {
  try {
    const response = await fetch(`${API_BASE_URL}/dedupe/results/${resultId}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to retrieve results: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting deduplication results:', error);
    throw error;
  }
};

/**
 * Get list of completed deduplication jobs
 * @returns Promise with array of dedupe jobs
 */
export const getDedupeJobs = async (): Promise<DedupeJob[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/dedupe/jobs`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to retrieve jobs: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting deduplication jobs:', error);
    throw error;
  }
};

/**
 * Get list of active deduplication jobs
 * @returns Promise with array of active jobs
 */
export const getActiveJobs = async (): Promise<ActiveJob[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/dedupe/jobs/active`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to retrieve active jobs: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting active jobs:', error);
    throw error;
  }
};

/**
 * Run local deduplication using a saved configuration without API
 * This is used for client-side processing
 * @param data Data to deduplicate
 * @param configId ID of the saved configuration
 * @returns Promise with deduplication results
 */
export const runLocalDedupe = async (data: any[], configId: string): Promise<DedupeResult> => {
  try {
    // Get the saved configuration
    const savedConfigs = getConfigurations();
    const configData = savedConfigs.find(c => c.id === configId);
    
    if (!configData) {
      throw new Error(`Configuration with ID ${configId} not found`);
    }

    // We need to create fake mapped columns since we're bypassing the normal flow
    const mappedColumns = Object.keys(data[0] || {}).map(key => ({
      originalName: key,
      mappedName: key,
      include: true
    }));

    // Run deduplication using the service
    return await deduplicateData(data, mappedColumns, configData.config);
  } catch (error) {
    console.error('Error running local deduplication:', error);
    throw error;
  }
};

/**
 * Store job reference in local storage for tracking
 * @param jobId ID of the job
 * @param metadata Additional job metadata
 */
export const storeJobReference = (jobId: string, metadata: Record<string, any> = {}) => {
  try {
    // Get existing jobs
    const storedJobs = localStorage.getItem('activeJobs');
    const activeJobs = storedJobs ? JSON.parse(storedJobs) : [];
    
    // Add new job with timestamp
    activeJobs.push({
      jobId,
      startTime: Date.now(),
      ...metadata
    });
    
    // Store back to localStorage
    localStorage.setItem('activeJobs', JSON.stringify(activeJobs));
  } catch (error) {
    console.error('Error storing job reference:', error);
  }
};

/**
 * Retrieve all locally tracked jobs
 * @returns Array of tracked jobs
 */
export const getLocalJobs = (): ActiveJob[] => {
  try {
    const storedJobs = localStorage.getItem('activeJobs');
    return storedJobs ? JSON.parse(storedJobs) : [];
  } catch (error) {
    console.error('Error retrieving local jobs:', error);
    return [];
  }
};

/**
 * Mark a job as completed or remove it from tracking
 * @param jobId ID of the job to mark as completed
 */
export const markJobCompleted = (jobId: string) => {
  try {
    const storedJobs = localStorage.getItem('activeJobs');
    if (!storedJobs) return;
    
    let activeJobs = JSON.parse(storedJobs);
    
    // Filter out the completed job
    activeJobs = activeJobs.filter((job: any) => job.jobId !== jobId);
    
    // Update localStorage
    localStorage.setItem('activeJobs', JSON.stringify(activeJobs));
  } catch (error) {
    console.error('Error marking job as completed:', error);
  }
};
