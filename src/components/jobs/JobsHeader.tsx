
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { CardTitle, CardDescription } from '@/components/ui/card';

interface JobsHeaderProps {
  isLoading: boolean;
  isApiAvailable: boolean;
  onRefresh: () => void;
}

const JobsHeader: React.FC<JobsHeaderProps> = ({ 
  isLoading, 
  isApiAvailable, 
  onRefresh 
}) => {
  return (
    <>
      <CardTitle className="flex items-center justify-between">
        <span>Running Jobs</span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh} 
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
    </>
  );
};

export default JobsHeader;
