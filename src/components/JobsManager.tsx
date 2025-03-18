
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw, XCircle, ExternalLink, Clock, Database, FileText } from 'lucide-react';
import { ActiveJob, DedupeProgress } from '@/lib/types';
import { getLocalJobs, getActiveJobs, markJobCompleted } from '@/lib/apiService';
import { pollDedupeStatus } from '@/lib/sqlService';
import { cancelSplinkJob } from '@/lib/splinkAdapter';
import { Progress } from '@/components/ui/progress';

const JobsManager: React.FC = () => {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApiAvailable, setIsApiAvailable] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const navigate = useNavigate();

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

  const handleRefresh = () => {
    loadJobs();
    toast.info('Refreshing jobs...');
  };

  const handleViewJob = (jobId: string) => {
    // Find the job to get its current status
    const job = jobs.find(j => j.jobId === jobId);
    
    if (job?.status === 'completed') {
      // If job is completed, navigate to results view
      navigate(`/results/${jobId}`);
    } else {
      // Otherwise navigate to progress view to monitor
      navigate(`/progress/${jobId}`);
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

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getTimeSince = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'cancelled': return 'text-orange-500';
      default: return 'text-blue-500';
    }
  };

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

  return (
    <div className="container mx-auto py-8 animate-fade-in">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Running Jobs</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh} 
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            View and manage currently running deduplication jobs
            {!isApiAvailable && (
              <div className="mt-2 text-amber-600 text-sm border border-amber-300 bg-amber-50 p-2 rounded">
                Note: API server not available. Only showing locally tracked jobs.
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No active jobs found</p>
              <p className="text-sm mt-2">
                Any running deduplication processes will appear here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.jobId}>
                      <TableCell className="font-mono text-xs">
                        {job.jobId}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 ${getStatusColor(job.status)}`}>
                          {job.status === 'running' && (
                            <span className="animate-pulse relative flex h-2 w-2 mr-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                          )}
                          {job.status || 'running'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="w-32">
                          <Progress value={job.progress?.percentage || 0} className="h-2" />
                          <p className="text-xs mt-1">{job.progress?.statusMessage || 'Processing...'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          <span title={formatTime(job.startTime)}>
                            {getTimeSince(job.startTime)} ago
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          {job.dataSource === 'database' ? (
                            <Database className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          <span>{job.configName || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewJob(job.jobId)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          {job.status !== 'completed' && job.status !== 'cancelled' && isApiAvailable && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelJob(job.jobId)}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JobsManager;
