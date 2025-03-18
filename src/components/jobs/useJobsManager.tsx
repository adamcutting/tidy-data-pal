
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ActiveJob, DedupeProgress } from '@/lib/types';
import { getLocalJobs, getActiveJobs, markJobCompleted } from '@/lib/apiService';
import { pollDedupeStatus } from '@/lib/sqlService';
import { cancelSplinkJob } from '@/lib/splinkAdapter';

export const useJobsManager = () => {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApiAvailable, setIsApiAvailable] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  // Merge local and server job lists, preferring server data
  const mergeJobLists = (localJobs: ActiveJob[], serverJobs: ActiveJob[]): ActiveJob[] => {
    const result = [...localJobs];
    
    // Add or update with server jobs
    for (const serverJob of serverJobs) {
      const existingIndex = result.findIndex(job => job.jobId === serverJob.jobId);
      if (existingIndex >= 0) {
        result[existingIndex] = { ...result[existingIndex], ...serverJob };
      } else {
        result.push(serverJob);
      }
    }
    
    return result;
  };

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      // Get locally tracked jobs from localStorage
      const localJobs = getLocalJobs();
      
      // Try to get active jobs from the server
      let serverJobs: ActiveJob[] = [];
      try {
        if (isApiAvailable) {
          serverJobs = await getActiveJobs();
        }
      } catch (error) {
        console.error('Could not fetch server jobs:', error);
        setIsApiAvailable(false);
        // Continue with local jobs if server jobs can't be fetched
      }
      
      // Merge jobs, preferring server data when available
      const mergedJobs = mergeJobLists(localJobs, serverJobs);
      
      // Update progress for each job
      const jobsWithProgress = await Promise.all(
        mergedJobs.map(async (job) => {
          if (job.jobId) {
            try {
              let latestProgress: DedupeProgress | undefined;
              
              // Only try to poll status if the API is available
              if (isApiAvailable) {
                try {
                  await pollDedupeStatus(job.jobId, (progress) => {
                    latestProgress = progress;
                  });
                } catch (error) {
                  console.log(`Could not poll status for job ${job.jobId}:`, error);
                }
              }
              
              // Ensure we return an object that matches the ActiveJob type
              return {
                ...job,
                progress: latestProgress || job.progress,
                // Make sure status is one of the allowed values in ActiveJob
                status: latestProgress?.status || job.status || 'running'
              } as ActiveJob;
            } catch (error) {
              console.error(`Error updating progress for job ${job.jobId}:`, error);
            }
          }
          return job;
        })
      );
      
      // Fix: Ensure we're setting a valid ActiveJob[] array
      setJobs(jobsWithProgress as ActiveJob[]);
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast.error('Failed to load active jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      toast.info(`Attempting to cancel job ${jobId}...`);
      
      // Check if API is available before attempting to cancel
      if (!isApiAvailable) {
        toast.error("Cannot cancel job: API server not available");
        return;
      }
      
      const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/deduplicate';
      const apiKey = process.env.REACT_APP_API_KEY;
      
      const result = await cancelSplinkJob(jobId, apiBaseUrl, apiKey);
      
      if (result.success) {
        toast.success(result.message);
        
        // Update the job in the list
        setJobs(prevJobs => 
          prevJobs.map(job => 
            job.jobId === jobId 
              ? { ...job, status: 'cancelled', progress: { ...job.progress, status: 'cancelled', statusMessage: 'Job cancelled by user' } } 
              : job
          )
        );
        
        // Remove from localStorage tracking
        markJobCompleted(jobId);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      toast.error(`Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Set up auto-refresh
  useEffect(() => {
    // Load jobs on mount
    loadJobs();
    
    // Set up auto-refresh every 30 seconds
    const interval = window.setInterval(() => {
      loadJobs();
    }, 30000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  return {
    jobs,
    isLoading,
    isApiAvailable,
    loadJobs,
    handleCancelJob
  };
};
