
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatabaseType, MySQLConfig, MSSQLConfig } from '@/lib/types';
import { toast } from 'sonner';

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

  const handleTypeChange = (value: string) => {
    const newType = value as DatabaseType;
    setDbType(newType);
    setPort(newType === 'mssql' ? '1433' : '3306');
  };

  const handleConnect = async () => {
    if (!server || !database || !username) {
      toast.error('Please fill in all required fields');
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
          user: username,
          password,
          database,
          options: {
            encrypt,
            trustServerCertificate: trustServerCert
          }
        };
      }

      await onConnect(dbType, config, query, isTable);
    } catch (error) {
      console.error('Connection error:', error);
      toast.error(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

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
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="is-table" 
              checked={isTable} 
              onCheckedChange={(checked) => setIsTable(checked as boolean)} 
            />
            <Label htmlFor="is-table" className="cursor-pointer">
              Use table name instead of query
            </Label>
          </div>
          
          <Label htmlFor="query">
            {isTable ? 'Table Name' : 'SQL Query'}
          </Label>
          <Input 
            id="query" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder={isTable ? 'customers' : 'SELECT * FROM customers WHERE active = 1'} 
          />
          
          {!isTable && (
            <p className="text-xs text-muted-foreground">
              Note: For optimal performance, limit your query size or add a LIMIT clause.
            </p>
          )}
        </div>

        <Button 
          onClick={handleConnect} 
          disabled={isConnecting}
          className="w-full"
        >
          {isConnecting ? 'Connecting...' : 'Connect and Load Data'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SqlConnectionForm;
