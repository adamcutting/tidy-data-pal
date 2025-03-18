
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { ActiveJob, DedupeProgress } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

const JobsManagerFixed: React.FC = () => {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      
      // First, get jobs from localStorage
      const localStorageJobs = localStorage.getItem('activeJobs');
      let activeJobs: ActiveJob[] = localStorageJobs ? JSON.parse(localStorageJobs) : [];
      
      // Then try to fetch updated information from the server
      try {
        const response = await fetch('/api/jobs');
        if (response.ok) {
          const serverJobs = await response.json();
          
          // Merge server jobs with local storage jobs
          const updatedJobs = mergeJobs(activeJobs, serverJobs);
          localStorage.setItem('activeJobs', JSON.stringify(updatedJobs));
          setJobs(updatedJobs);
        } else {
          // If server is not available, just use localStorage jobs
          setJobs(activeJobs);
        }
      } catch (error) {
        console.error("Error fetching server jobs:", error);
        setJobs(activeJobs);
        toast({
          title: "Could not connect to server",
          description: "Using locally stored job information only",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Function to merge local jobs with server jobs
  const mergeJobs = (localJobs: ActiveJob[], serverJobs: any[]): ActiveJob[] => {
    // Create a map of server jobs by ID for quick lookup
    const serverJobMap = new Map(serverJobs.map(job => [job.jobId, job]));
    
    // Update local jobs with server data where available
    const updatedLocalJobs = localJobs.map(localJob => {
      const serverJob = serverJobMap.get(localJob.jobId);
      if (serverJob) {
        return {
          ...localJob,
          status: serverJob.status || localJob.status,
          progress: serverJob.progress || localJob.progress
        };
      }
      return localJob;
    });
    
    // Add any server jobs that aren't in the local storage
    serverJobs.forEach(serverJob => {
      if (!localJobs.some(localJob => localJob.jobId === serverJob.jobId)) {
        updatedLocalJobs.push({
          jobId: serverJob.jobId,
          startTime: serverJob.startTime || Date.now(),
          status: serverJob.status || 'running',
          progress: serverJob.progress || { status: 'processing', percentage: 0, statusMessage: 'Processing...' },
          configName: serverJob.configName || 'Unknown',
          dataSource: serverJob.dataSource || 'Unknown',
          rowCount: serverJob.rowCount
        });
      }
    });
    
    return updatedLocalJobs;
  };

  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST'
      });
      
      if (response.ok) {
        // Update the job status locally without waiting for the next refresh
        setJobs(currentJobs => 
          currentJobs.map(job => 
            job.jobId === jobId 
              ? { ...job, status: 'cancelled', progress: { ...job.progress, status: 'cancelled', statusMessage: 'Job cancelled' } } 
              : job
          )
        );
        
        toast({
          title: "Job cancelled",
          description: "The job has been cancelled successfully",
        });
        
        // Update localStorage
        const updatedJobs = jobs.map(job => 
          job.jobId === jobId 
            ? { ...job, status: 'cancelled', progress: { ...job.progress, status: 'cancelled', statusMessage: 'Job cancelled' } } 
            : job
        );
        localStorage.setItem('activeJobs', JSON.stringify(updatedJobs));
      } else {
        toast({
          title: "Error",
          description: "Failed to cancel the job",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error cancelling job:", error);
      toast({
        title: "Error",
        description: "Failed to cancel the job: " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive"
      });
    }
  };

  const viewJob = (jobId: string) => {
    // Navigate back to the process page with the selected job ID
    navigate('/?job=' + jobId);
  };

  useEffect(() => {
    fetchJobs();
    
    // Refresh jobs every 30 seconds
    const intervalId = setInterval(fetchJobs, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Running</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Completed</span>;
      case 'failed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Failed</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Running and Recent Jobs</h2>
        <Button 
          onClick={fetchJobs} 
          variant="outline" 
          size="sm" 
          className="flex gap-2"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center text-muted-foreground">
              <p>No active or recent jobs found</p>
              <p className="text-sm mt-2">Start a new deduplication job to see it here</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <Card key={job.jobId} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{job.configName || 'Unnamed Job'}</CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      Started {formatDistanceToNow(job.startTime)} ago
                    </CardDescription>
                  </div>
                  {getStatusBadge(job.status || 'unknown')}
                </div>
              </CardHeader>
              
              <CardContent className="pb-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Source:</span>
                    <span>{job.dataSource || 'Unknown'}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Records:</span>
                    <span>{job.rowCount?.toLocaleString() || 'Unknown'}</span>
                  </div>
                  
                  <div className="space-y-1 mt-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>{job.progress?.percentage.toFixed(0)}%</span>
                    </div>
                    <Progress value={job.progress?.percentage || 0} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{job.progress?.statusMessage || 'Processing...'}</p>
                  </div>
                </div>
              </CardContent>
              
              <Separator />
              
              <CardFooter className="pt-3 pb-3 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => viewJob(job.jobId)}
                  disabled={!['running', 'completed'].includes(job.status || '')}
                  className="flex gap-1"
                >
                  <Eye className="h-4 w-4" />
                  View
                </Button>
                
                {job.status === 'running' && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => cancelJob(job.jobId)}
                    className="flex gap-1"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobsManagerFixed;
