
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FileUpload from './FileUpload';
import SqlConnectionForm from './SqlConnectionForm';
import { FileData, DatabaseLoadRequest, DatabaseType, MySQLConfig, MSSQLConfig } from '@/lib/types';

interface SourceSelectorProps {
  onFileLoaded: (fileData: FileData) => void;
  onSqlConnect: (type: DatabaseType, config: MySQLConfig | MSSQLConfig, query: string, isTable: boolean) => Promise<void>;
  isConnecting: boolean;
}

const SourceSelector: React.FC<SourceSelectorProps> = ({ 
  onFileLoaded, 
  onSqlConnect,
  isConnecting
}) => {
  return (
    <Card>
      <CardContent className="p-6">
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="file">File Upload</TabsTrigger>
            <TabsTrigger value="database">SQL Database</TabsTrigger>
          </TabsList>
          
          <TabsContent value="file" className="mt-0">
            <FileUpload onFileLoaded={onFileLoaded} />
          </TabsContent>
          
          <TabsContent value="database" className="mt-0">
            <SqlConnectionForm 
              onConnect={onSqlConnect} 
              isConnecting={isConnecting}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SourceSelector;
