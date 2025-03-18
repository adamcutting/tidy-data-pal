
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActiveJob } from '@/lib/types';
import JobStatusBadge from './JobStatusBadge';
import JobProgressIndicator from './JobProgressIndicator';
import JobTimestamp from './JobTimestamp';
import JobSourceIndicator from './JobSourceIndicator';
import JobActions from './JobActions';

interface JobsListProps {
  jobs: ActiveJob[];
  isApiAvailable: boolean;
  onViewJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
}

const JobsList: React.FC<JobsListProps> = ({ 
  jobs, 
  isApiAvailable,
  onViewJob, 
  onCancelJob 
}) => {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No active jobs found</p>
        <p className="text-sm mt-2">
          Any running deduplication processes will appear here
        </p>
      </div>
    );
  }

  return (
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
                <JobStatusBadge status={job.status} />
              </TableCell>
              <TableCell>
                <JobProgressIndicator progress={job.progress} />
              </TableCell>
              <TableCell>
                <JobTimestamp timestamp={job.startTime} />
              </TableCell>
              <TableCell>
                <JobSourceIndicator 
                  dataSource={job.dataSource} 
                  configName={job.configName} 
                />
              </TableCell>
              <TableCell>
                <JobActions 
                  jobId={job.jobId}
                  status={job.status}
                  isApiAvailable={isApiAvailable}
                  onViewJob={onViewJob}
                  onCancelJob={onCancelJob}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default JobsList;
