
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Check, AlertTriangle, Server } from 'lucide-react';
import { getSplinkSettings, saveSplinkSettings, testSplinkConnection } from '@/lib/dedupeService';
import { SplinkSettings as SplinkSettingsType } from '@/lib/types';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';

interface SplinkSettingsProps {
  onSettingsChange?: () => void;
}

const SplinkSettings: React.FC<SplinkSettingsProps> = ({ onSettingsChange }) => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<SplinkSettingsType>(getSplinkSettings);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'success' | 'failed'>('untested');

  // Initialize settings from localStorage
  useEffect(() => {
    setSettings(getSplinkSettings());
  }, [open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
    setConnectionStatus('untested');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      // Save settings temporarily for the test
      saveSplinkSettings(settings);
      
      // Test the connection - simple ping to the API endpoint
      const response = await fetch(settings.apiUrl, {
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {})
        }
      });
      
      // If we can't use OPTIONS, try a GET request
      const isSuccessful = response.ok || response.status === 404; // 404 is acceptable because the endpoint might only accept POST
      
      setConnectionStatus(isSuccessful ? 'success' : 'failed');
      
      // Show feedback
      if (isSuccessful) {
        toast.success('Successfully connected to Splink API');
      } else {
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Splink API Settings</DialogTitle>
            <DialogDescription>
              Configure the connection to your Splink API server for enhanced deduplication.
            </DialogDescription>
          </DialogHeader>
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
