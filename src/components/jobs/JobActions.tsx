
import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, XCircle } from 'lucide-react';

interface JobActionsProps {
  jobId: string;
  status?: string;
  isApiAvailable: boolean;
  onViewJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
}

const JobActions: React.FC<JobActionsProps> = ({ 
  jobId, 
  status, 
  isApiAvailable,
  onViewJob, 
  onCancelJob 
}) => {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onViewJob(jobId)}
      >
        <ExternalLink className="h-3 w-3 mr-1" />
        View
      </Button>
      {status !== 'completed' && status !== 'cancelled' && isApiAvailable && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onCancelJob(jobId)}
        >
          <XCircle className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      )}
    </div>
  );
};

export default JobActions;
