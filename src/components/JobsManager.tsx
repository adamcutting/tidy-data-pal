import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { useJobsManager } from './jobs/useJobsManager';
import JobsHeader from './jobs/JobsHeader';
import JobsList from './jobs/JobsList';

const JobsManager: React.FC = () => {
  const navigate = useNavigate();
  const { 
    jobs, 
    isLoading, 
    isApiAvailable, 
    loadJobs, 
    handleCancelJob 
  } = useJobsManager();

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

  return (
    <div className="container mx-auto py-8 animate-fade-in">
      <Card className="w-full">
        <CardHeader>
          <JobsHeader
            isLoading={isLoading}
            isApiAvailable={isApiAvailable}
            onRefresh={handleRefresh}
          />
        </CardHeader>
        <CardContent>
          <JobsList
            jobs={jobs}
            isApiAvailable={isApiAvailable}
            onViewJob={handleViewJob}
            onCancelJob={handleCancelJob}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default JobsManager;
