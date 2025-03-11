
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatabaseType, MySQLConfig, MSSQLConfig, DatabaseMetadata } from '@/lib/types';
import { toast } from 'sonner';
import { getDatabaseMetadata } from '@/lib/sqlService';
import { Spinner } from '@/components/ui/spinner';
import { Key, Database, Table2, Search } from 'lucide-react';

interface SqlConnectionFormProps {
  onConnect: (type: DatabaseType, config: MySQLConfig | MSSQLConfig, query: string, isTable: boolean) => Promise<void>;
  isConnecting: boolean;
}

const SqlConnectionForm: React.FC<SqlConnectionFormProps> = ({ onConnect, isConnecting }) => {
  const [dbType, setDbType] = useState<DatabaseType>('mssql');
  const [server, setServer] = useState<string>('localhost');
  const [port, setPort] = useState<string>(dbType === 'mssql' ? '1433' : '3306');
  const [database, setDatabase] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [isTable, setIsTable] = useState<boolean>(true);
  const [encrypt, setEncrypt] = useState<boolean>(true);
  const [trustServerCert, setTrustServerCert] = useState<boolean>(true);
  const [authType, setAuthType] = useState<'default' | 'windows'>('default');
  const [domain, setDomain] = useState<string>('');
  const [loadingMetadata, setLoadingMetadata] = useState<boolean>(false);
  const [databaseMetadata, setDatabaseMetadata] = useState<DatabaseMetadata | null>(null);
  const [selectedObjectType, setSelectedObjectType] = useState<'table' | 'view'>('table');

  const handleTypeChange = (value: string) => {
    const newType = value as DatabaseType;
    setDbType(newType);
    setPort(newType === 'mssql' ? '1433' : '3306');
    if (newType === 'mysql') {
      setAuthType('default');
    }
  };

  const fetchDatabaseMetadata = async () => {
    if (!server || !database) {
      toast.error('Please enter server and database name first');
      return;
    }

    setLoadingMetadata(true);
    try {
      let config: MySQLConfig | MSSQLConfig;
      
      if (dbType === 'mysql') {
        config = {
          host: server,
          port: parseInt(port, 10),
          user: username,
          password,
          database
        };
      } else {
        config = {
          server,
          port: parseInt(port, 10),
          user: authType === 'default' ? username : '',
          password: authType === 'default' ? password : '',
          database,
          options: {
            encrypt,
            trustServerCertificate: trustServerCert,
            authentication: authType === 'windows' ? 'windows' : 'default',
            domain: authType === 'windows' ? domain : undefined
          }
        };
      }

      console.log('Fetching database metadata with config:', 
        { ...config, password: config.password ? '***HIDDEN***' : undefined });
        
      const metadata = await getDatabaseMetadata(dbType, config);
      console.log('Received metadata:', metadata);
      setDatabaseMetadata(metadata);
      
      // Set initial table selection if available
      if (metadata.tables.length > 0 && isTable) {
        setQuery(metadata.tables[0]);
        setSelectedObjectType('table');
      } else if (metadata.views.length > 0 && isTable) {
        setQuery(metadata.views[0]);
        setSelectedObjectType('view');
      }
      
      // Show success message with count of found objects
      toast.success(`Found ${metadata.tables.length} tables and ${metadata.views.length} views`);
    } catch (error) {
      console.error('Error fetching database metadata:', error);
      toast.error(`Failed to get database objects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const handleConnect = async () => {
    if (!server || !database) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (authType === 'default' && !username) {
      toast.error('Please provide a username for SQL authentication');
      return;
    }

    try {
      let config: MySQLConfig | MSSQLConfig;
      
      if (dbType === 'mysql') {
        config = {
          host: server,
          port: parseInt(port, 10),
          user: username,
          password,
          database
        };
      } else {
        config = {
          server,
          port: parseInt(port, 10),
          user: authType === 'default' ? username : '',
          password: authType === 'default' ? password : '',
          database,
          options: {
            encrypt,
            trustServerCertificate: trustServerCert,
            authentication: authType === 'windows' ? 'windows' : 'default',
            domain: authType === 'windows' ? domain : undefined
          }
        };
      }

      await onConnect(dbType, config, query, isTable);
    } catch (error) {
      console.error('Connection error:', error);
      toast.error(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    if (isTable && databaseMetadata) {
      if (selectedObjectType === 'table' && databaseMetadata.tables.length > 0) {
        setQuery(databaseMetadata.tables[0]);
      } else if (selectedObjectType === 'view' && databaseMetadata.views.length > 0) {
        setQuery(databaseMetadata.views[0]);
      }
    } else if (!isTable) {
      setQuery('');
    }
  }, [isTable, selectedObjectType, databaseMetadata]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>SQL Database Connection</CardTitle>
        <CardDescription>Connect to a SQL database to load data for deduplication</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="db-type">Database Type</Label>
            <Select value={dbType} onValueChange={handleTypeChange}>
              <SelectTrigger id="db-type">
                <SelectValue placeholder="Select database type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mssql">Microsoft SQL Server</SelectItem>
                <SelectItem value="mysql">MySQL / MariaDB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="server">Server</Label>
            <Input 
              id="server" 
              value={server} 
              onChange={(e) => setServer(e.target.value)} 
              placeholder={dbType === 'mssql' ? 'localhost\\SQLEXPRESS' : 'localhost'} 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input 
              id="port" 
              value={port} 
              onChange={(e) => setPort(e.target.value)} 
              type="number"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="database">Database</Label>
            <Input 
              id="database" 
              value={database} 
              onChange={(e) => setDatabase(e.target.value)} 
              placeholder="database_name"
            />
          </div>
        </div>

        {dbType === 'mssql' && (
          <div className="space-y-2">
            <Label>Authentication Type</Label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="sql-auth" 
                  checked={authType === 'default'} 
                  onCheckedChange={() => setAuthType('default')} 
                />
                <Label htmlFor="sql-auth" className="cursor-pointer flex items-center">
                  <Key className="h-4 w-4 mr-2" />
                  SQL Server Authentication
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="windows-auth" 
                  checked={authType === 'windows'} 
                  onCheckedChange={() => setAuthType('windows')} 
                />
                <Label htmlFor="windows-auth" className="cursor-pointer flex items-center">
                  <Key className="h-4 w-4 mr-2" />
                  Windows Authentication
                </Label>
              </div>
            </div>
          </div>
        )}

        {authType === 'default' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="username" 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
              />
            </div>
          </div>
        )}

        {authType === 'windows' && dbType === 'mssql' && (
          <div className="space-y-2">
            <Label htmlFor="domain">Domain (Optional)</Label>
            <Input 
              id="domain" 
              value={domain} 
              onChange={(e) => setDomain(e.target.value)} 
              placeholder="DOMAIN" 
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use current Windows credentials
            </p>
          </div>
        )}

        {dbType === 'mssql' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="encrypt" 
                checked={encrypt} 
                onCheckedChange={(checked) => setEncrypt(checked as boolean)} 
              />
              <Label htmlFor="encrypt" className="cursor-pointer">
                Encrypt Connection
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="trust-server-cert" 
                checked={trustServerCert} 
                onCheckedChange={(checked) => setTrustServerCert(checked as boolean)} 
              />
              <Label htmlFor="trust-server-cert" className="cursor-pointer">
                Trust Server Certificate
              </Label>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="is-table" 
                checked={isTable} 
                onCheckedChange={(checked) => setIsTable(checked as boolean)} 
              />
              <Label htmlFor="is-table" className="cursor-pointer">
                Select table/view instead of writing query
              </Label>
            </div>
            
            {isTable && database && server && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={fetchDatabaseMetadata}
                disabled={loadingMetadata}
              >
                {loadingMetadata ? <Spinner className="mr-2 h-4 w-4" /> : <Database className="mr-2 h-4 w-4" />}
                Fetch Tables & Views
              </Button>
            )}
          </div>
          
          {isTable && databaseMetadata ? (
            <div className="space-y-2">
              <div className="flex space-x-2 mb-2">
                <Button 
                  type="button" 
                  size="sm"
                  variant={selectedObjectType === 'table' ? 'default' : 'outline'} 
                  onClick={() => setSelectedObjectType('table')}
                  className="flex-1"
                >
                  <Table2 className="mr-2 h-4 w-4" />
                  Tables ({databaseMetadata.tables.length})
                </Button>
                <Button 
                  type="button" 
                  size="sm"
                  variant={selectedObjectType === 'view' ? 'default' : 'outline'} 
                  onClick={() => setSelectedObjectType('view')}
                  className="flex-1"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Views ({databaseMetadata.views.length})
                </Button>
              </div>
              
              <Select 
                value={query} 
                onValueChange={setQuery}
                disabled={
                  (selectedObjectType === 'table' && databaseMetadata.tables.length === 0) ||
                  (selectedObjectType === 'view' && databaseMetadata.views.length === 0)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select a ${selectedObjectType}...`} />
                </SelectTrigger>
                <SelectContent>
                  {selectedObjectType === 'table' ? (
                    databaseMetadata.tables.length > 0 ? (
                      databaseMetadata.tables.map((table) => (
                        <SelectItem key={table} value={table}>{table}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-tables" disabled>No tables found</SelectItem>
                    )
                  ) : (
                    databaseMetadata.views.length > 0 ? (
                      databaseMetadata.views.map((view) => (
                        <SelectItem key={view} value={view}>{view}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-views" disabled>No views found</SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : isTable ? (
            <p className="text-sm text-muted-foreground italic">
              Enter database connection details and click "Fetch Tables & Views" to list available objects
            </p>
          ) : null}
          
          {!isTable && (
            <>
              <Label htmlFor="query">SQL Query</Label>
              <Input 
                id="query" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                placeholder="SELECT * FROM customers WHERE active = 1" 
              />
              
              <p className="text-xs text-muted-foreground">
                Note: For optimal performance, limit your query size or add a LIMIT clause.
              </p>
            </>
          )}
        </div>

        <Button 
          onClick={handleConnect} 
          disabled={isConnecting}
          className="w-full"
        >
          {isConnecting ? <Spinner className="mr-2 h-4 w-4" /> : null}
          {isConnecting ? 'Connecting...' : 'Connect and Load Data'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SqlConnectionForm;
