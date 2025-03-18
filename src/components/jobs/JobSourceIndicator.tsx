
import React from 'react';
import { Database, FileText } from 'lucide-react';

interface JobSourceIndicatorProps {
  dataSource?: string;
  configName?: string;
}

const JobSourceIndicator: React.FC<JobSourceIndicatorProps> = ({ dataSource, configName }) => {
  return (
    <div className="flex items-center gap-1 text-xs">
      {dataSource === 'database' ? (
        <Database className="h-3 w-3" />
      ) : (
        <FileText className="h-3 w-3" />
      )}
      <span>{configName || 'Unknown'}</span>
    </div>
  );
};

export default JobSourceIndicator;
