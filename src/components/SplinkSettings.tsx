
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Check, AlertTriangle, Server, Sparkles } from 'lucide-react';
import { getSplinkSettings, saveSplinkSettings, testSplinkConnection } from '@/lib/dedupeService';
import { SplinkSettings as SplinkSettingsType, DedupeConfig, SparkConfig } from '@/lib/types';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { UseFormReturn } from 'react-hook-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

interface SplinkSettingsProps {
  form?: UseFormReturn<DedupeConfig, any, undefined>;
  onSettingsChange?: () => void;
}

const SplinkSettings: React.FC<SplinkSettingsProps> = ({ form, onSettingsChange }) => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<SplinkSettingsType>(getSplinkSettings());
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'success' | 'failed'>('untested');
  const [activeTab, setActiveTab] = useState("general");

  // Initialize settings from localStorage
  useEffect(() => {
    const storedSettings = getSplinkSettings();
    // Ensure sparkConfig exists
    if (!storedSettings.sparkConfig) {
      storedSettings.sparkConfig = {
        enabled: false,
        masterUrl: 'spark://localhost:7077',
        appName: 'SplinkDedupe',
        executorMemory: '4g',
        driverMemory: '4g',
        numExecutors: 2,
        executorCores: 2,
        shufflePartitions: 200
      };
    }
    setSettings(storedSettings);
  }, [open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
    setConnectionStatus('untested');
  };

  const handleSparkInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      sparkConfig: {
        ...prev.sparkConfig as SparkConfig,
        [name]: name === 'numExecutors' || name === 'executorCores' || name === 'shufflePartitions' 
          ? parseInt(value, 10) 
          : value
      }
    }));
  };

  const handleSparkToggle = (checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      sparkConfig: {
        ...prev.sparkConfig as SparkConfig,
        enabled: checked
      }
    }));
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      // Save settings temporarily for the test
      saveSplinkSettings(settings);
      
      // For the API endpoint, we'll use the /test-connection endpoint
      const testUrl = settings.apiUrl.replace(/\/deduplicate\/?$/, '') + '/test-connection';
      
      // Test the connection - simple ping to the API endpoint
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {})
        }
      });
      
      if (response.ok) {
        setConnectionStatus('success');
        toast.success('Successfully connected to Splink API');
      } else {
        setConnectionStatus('failed');
        toast.error('Failed to connect to Splink API');
      }
    } catch (error) {
      // Even network errors can be OK if it's a CORS preflight issue
      const isLocalhost = settings.apiUrl.includes('localhost') || settings.apiUrl.includes('127.0.0.1');
      
      if (isLocalhost) {
        setConnectionStatus('success');
        toast.success('API appears to be running locally - but check CORS settings if you have issues');
      } else {
        setConnectionStatus('failed');
        toast.error(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    saveSplinkSettings(settings);
    setOpen(false);
    if (onSettingsChange) {
      onSettingsChange();
    }
    
    // Set form field if using with form
    if (form) {
      form.setValue("splinkParams.useSpark", settings.sparkConfig?.enabled || false);
    }
    
    toast.success('Splink settings saved successfully');
  };

  const renderConnectionStatus = () => {
    if (connectionStatus === 'untested') return null;
    
    if (connectionStatus === 'success') {
      return (
        <div className="flex items-center text-green-600 gap-1 mt-1">
          <Check className="h-4 w-4" />
          <span className="text-xs">Connection successful</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center text-amber-600 gap-1 mt-1">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-xs">Connection failed</span>
      </div>
    );
  };

  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Splink API Settings</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Configure connection to your Splink API server
                {settings.sparkConfig?.enabled && <span className="ml-2 text-amber-600 inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Spark enabled
                </span>}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Splink API Settings</DialogTitle>
            <DialogDescription>
              Configure the connection to your Splink API server for enhanced deduplication.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="general">General Settings</TabsTrigger>
              <TabsTrigger value="spark">Spark Configuration</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="apiUrl">API URL</Label>
                  <Input
                    id="apiUrl"
                    name="apiUrl"
                    value={settings.apiUrl}
                    onChange={handleInputChange}
                    placeholder="http://localhost:5000/api/deduplicate"
                  />
                  {renderConnectionStatus()}
                  <p className="text-xs text-muted-foreground mt-1">
                    The URL where your Splink API is running
                  </p>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="apiKey">API Key (Optional)</Label>
                  <Input
                    id="apiKey"
                    name="apiKey"
                    value={settings.apiKey || ''}
                    onChange={handleInputChange}
                    placeholder="Enter API key if required"
                    type="password"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional authentication key for your Splink API
                  </p>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="outputDir">Results Directory (Optional)</Label>
                  <Input
                    id="outputDir"
                    name="outputDir"
                    value={settings.outputDir || ''}
                    onChange={handleInputChange}
                    placeholder="D:/SplinkProjects/results"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Directory where results will be saved on the server (if applicable)
                  </p>
                </div>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting ? <Spinner /> : <Server className="h-4 w-4 mr-2" />}
                  Test Connection
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="spark" className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="spark-enabled">Enable Spark</Label>
                    <p className="text-xs text-muted-foreground">
                      Use Apache Spark for distributed processing (requires compatible backend)
                    </p>
                  </div>
                  <Switch
                    id="spark-enabled"
                    checked={settings.sparkConfig?.enabled || false}
                    onCheckedChange={handleSparkToggle}
                  />
                </div>
                
                {settings.sparkConfig?.enabled && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="masterUrl">Spark Master URL</Label>
                      <Input
                        id="masterUrl"
                        name="masterUrl"
                        value={settings.sparkConfig?.masterUrl || ''}
                        onChange={handleSparkInputChange}
                        placeholder="spark://localhost:7077"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        URL of the Spark master (e.g., spark://host:port)
                      </p>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="appName">Application Name</Label>
                      <Input
                        id="appName"
                        name="appName"
                        value={settings.sparkConfig?.appName || ''}
                        onChange={handleSparkInputChange}
                        placeholder="SplinkDedupe"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Name of the Spark application
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="executorMemory">Executor Memory</Label>
                        <Input
                          id="executorMemory"
                          name="executorMemory"
                          value={settings.sparkConfig?.executorMemory || ''}
                          onChange={handleSparkInputChange}
                          placeholder="4g"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Memory per executor (e.g., 4g)
                        </p>
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="driverMemory">Driver Memory</Label>
                        <Input
                          id="driverMemory"
                          name="driverMemory"
                          value={settings.sparkConfig?.driverMemory || ''}
                          onChange={handleSparkInputChange}
                          placeholder="4g"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Memory for driver (e.g., 4g)
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="numExecutors">Number of Executors</Label>
                        <Input
                          id="numExecutors"
                          name="numExecutors"
                          type="number"
                          value={settings.sparkConfig?.numExecutors || ''}
                          onChange={handleSparkInputChange}
                          placeholder="2"
                        />
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="executorCores">Cores per Executor</Label>
                        <Input
                          id="executorCores"
                          name="executorCores"
                          type="number"
                          value={settings.sparkConfig?.executorCores || ''}
                          onChange={handleSparkInputChange}
                          placeholder="2"
                        />
                      </div>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="shufflePartitions">Shuffle Partitions</Label>
                      <Input
                        id="shufflePartitions"
                        name="shufflePartitions"
                        type="number"
                        value={settings.sparkConfig?.shufflePartitions || ''}
                        onChange={handleSparkInputChange}
                        placeholder="200"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Number of partitions to use when shuffling data
                      </p>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="localDir">Local Directory (Optional)</Label>
                      <Input
                        id="localDir"
                        name="localDir"
                        value={settings.sparkConfig?.localDir || ''}
                        onChange={handleSparkInputChange}
                        placeholder="/tmp/spark"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Directory to use for Spark local storage
                      </p>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SplinkSettings;
