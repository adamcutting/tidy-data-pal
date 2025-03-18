
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertCircle, 
  Save, 
  Trash2, 
  Play, 
  Database, 
  Plus, 
  Minus, 
  InfoIcon, 
  Settings, 
  FileCog,
  Server,
  Cpu
} from 'lucide-react';
import { useForm, useFieldArray, Controller, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { MappedColumn, DedupeConfig as DedupeConfigType, DerivedBlockingRule } from '@/lib/types';
import { getConfigurations, saveConfiguration, deleteConfiguration } from '@/lib/dedupeService';
import SplinkSettings from './SplinkSettings';

interface DedupeConfigProps {
  mappedColumns: MappedColumn[];
  onConfigComplete: (config: DedupeConfigType) => void;
  isProcessing: boolean;
  uniqueIdColumn?: string; // Add this to accept uniqueIdColumn prop
}

interface SplinkSettingsProps {
  form?: UseFormReturn<DedupeConfigType, any, undefined>;
  onSettingsChange?: (settings: any) => void;
}

const DedupeConfig: React.FC<DedupeConfigProps> = ({ 
  mappedColumns, 
  onConfigComplete, 
  isProcessing,
  uniqueIdColumn 
}) => {
  const [savedConfigs, setSavedConfigs] = useState(getConfigurations());
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);

  useEffect(() => {
    setSavedConfigs(getConfigurations());
  }, []);

  // Define form with react-hook-form and initialize with uniqueIdColumn if provided
  const form = useForm<DedupeConfigType>({
    defaultValues: {
      name: '',
      comparisons: [{ column: '', matchType: 'exact', threshold: 0.8 }],
      blockingColumns: [],
      derivedBlockingRules: [],
      threshold: 0.8,
      uniqueIdColumn: uniqueIdColumn, // Set the uniqueIdColumn from props
      useSplink: true, // Default to true
      splinkParams: {
        termFrequencyAdjustments: true,
        retainMatchingColumns: true,
        trainModel: true,
        clusteringThreshold: 0.8,
      },
      dataSource: 'file',
      useWebWorker: true // Enable Web Workers by default
    }
  });

  // Add the missing useFieldArray for comparisons
  const { fields: comparisonFields, append: comparisonAppend, remove: comparisonRemove } = useFieldArray({
    control: form.control,
    name: "comparisons"
  });

  // Update uniqueIdColumn when prop changes
  useEffect(() => {
    if (uniqueIdColumn) {
      form.setValue('uniqueIdColumn', uniqueIdColumn);
    }
  }, [uniqueIdColumn, form]);

  // Fix the type issue with blockingColumns by using the correct generic type
  const { fields: blockingFields, append: blockingAppend, remove: blockingRemove } = useFieldArray({
    control: form.control,
    name: "blockingColumns" as any // This is a workaround for the TypeScript error
  });
  
  // Add derived blocking rules functionality back
  const { fields: derivedBlockingFields, append: derivedBlockingAppend, remove: derivedBlockingRemove } = useFieldArray({
    control: form.control,
    name: "derivedBlockingRules" as any
  });

  // Handle saving configuration (without starting deduplication)
  const onSaveConfig = (data: DedupeConfigType) => {
    try {
      // Ensure useSplink is always true
      data.useSplink = true;
      
      const savedConfig = saveConfiguration(data);
      setSavedConfigs(getConfigurations());
      setSelectedConfig(savedConfig.id);
      toast.success(`Configuration "${data.name}" saved successfully!`);
    } catch (error) {
      toast.error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle form submission for starting deduplication
  const onSubmit = (data: DedupeConfigType) => {
    // Ensure useSplink is always true
    data.useSplink = true;
    
    // Start deduplication process
    onConfigComplete(data);
  };

  const handleLoadConfig = (configId: string) => {
    const config = savedConfigs.find(c => c.id === configId)?.config;
    if (config) {
      // Ensure useSplink is always true when loading config
      config.useSplink = true;
      form.reset(config);
      setSelectedConfig(configId);
      toast.success(`Configuration "${config.name}" loaded successfully!`);
    } else {
      toast.error('Configuration not found');
    }
  };

  const handleDeleteConfig = (configId: string) => {
    deleteConfiguration(configId);
    setSavedConfigs(getConfigurations());
    setSelectedConfig(null);
    form.reset();
    toast.success('Configuration deleted successfully!');
  };

  const handleAddComparison = () => {
    comparisonAppend({ column: '', matchType: 'exact', threshold: 0.8 });
  };

  const handleRemoveComparison = (index: number) => {
    comparisonRemove(index);
  };

  const handleAddBlockingColumn = () => {
    // Fix the type issue by passing the correct type of value
    blockingAppend('') as any; // This is a workaround for the TypeScript error
  };

  const handleRemoveBlockingColumn = (index: number) => {
    blockingRemove(index);
  };
  
  const handleAddDerivedBlockingRule = () => {
    derivedBlockingAppend({
      type: 'postcode-district',
      sourceColumn: '',
      targetColumn: ''
    }) as any;
  };
  
  const handleRemoveDerivedBlockingRule = (index: number) => {
    derivedBlockingRemove(index);
  };

  return (
    <div className="container mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                Deduplication Configuration
              </CardTitle>
              <CardDescription>
                Configure the deduplication process by specifying comparison columns, blocking rules, and thresholds.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Configuration Name</FormLabel>
                      <FormDescription>
                        Give this configuration a unique name for future use.
                      </FormDescription>
                      <FormControl>
                        <Input placeholder="My Dedupe Config" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div>
                  <FormLabel>Saved Configurations</FormLabel>
                  <FormDescription>
                    Load or delete previously saved configurations.
                  </FormDescription>
                  <Select onValueChange={handleLoadConfig} defaultValue={selectedConfig || ''}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a saved configuration" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedConfig && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => handleDeleteConfig(selectedConfig)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Configuration
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="basic" className="mt-6">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="basic">Basic Settings</TabsTrigger>
              <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCog className="h-5 w-5" />
                    Comparison Settings
                  </CardTitle>
                  <CardDescription>
                    Define how records are compared to identify duplicates.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Accordion type="multiple">
                    {comparisonFields.map((field, index) => (
                      <AccordionItem value={`item-${index}`} key={field.id}>
                        <AccordionTrigger>
                          Comparison {index + 1}: {field.column || 'Not Selected'}
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`comparisons.${index}.column` as const}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Column to Compare</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a column" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {mappedColumns.filter(col => col.include).map((column) => (
                                        <SelectItem key={column.originalName} value={column.mappedName || ''}>
                                          {column.mappedName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Select the column to use for comparison.
                                  </FormDescription>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`comparisons.${index}.matchType` as const}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Match Type</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select match type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="exact">Exact</SelectItem>
                                      <SelectItem value="fuzzy">Fuzzy</SelectItem>
                                      <SelectItem value="partial">Partial</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Choose the type of matching to apply.
                                  </FormDescription>
                                </FormItem>
                              )}
                            />
                            {form.watch(`comparisons.${index}.matchType`) !== 'exact' && (
                              <FormField
                                control={form.control}
                                name={`comparisons.${index}.threshold` as const}
                                render={({ field }) => (
                                  <FormItem className="space-y-2">
                                    <FormLabel>Threshold: {(field.value || 0.8).toFixed(2)}</FormLabel>
                                    <FormControl>
                                      <div className="flex items-center space-x-2">
                                        <Slider
                                          defaultValue={[field.value || 0.8]}
                                          max={1}
                                          step={0.05}
                                          onValueChange={(value) => field.onChange(value[0])}
                                        />
                                        <span className="w-12 text-sm">{((field.value || 0.8) * 100).toFixed(0)}%</span>
                                      </div>
                                    </FormControl>
                                    <FormDescription>
                                      Set the similarity threshold for fuzzy matching.
                                    </FormDescription>
                                  </FormItem>
                                )}
                              />
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveComparison(index)}
                            className="mt-2"
                          >
                            <Minus className="h-4 w-4 mr-2" />
                            Remove Comparison
                          </Button>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddComparison}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Comparison
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Blocking Rules
                  </CardTitle>
                  <CardDescription>
                    Define rules to group similar records together for faster processing.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Standard Blocking Columns</h4>
                      <ScrollArea className="h-[200px] rounded-md border p-4">
                        <div className="space-y-2">
                          {blockingFields.map((field, index) => (
                            <div key={field.id} className="flex items-center space-x-2">
                              <FormField
                                control={form.control}
                                name={`blockingColumns.${index}` as const}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select a column" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {mappedColumns.filter(col => col.include).map((column) => (
                                            <SelectItem key={column.originalName} value={column.mappedName || ''}>
                                              {column.mappedName}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveBlockingColumn(index)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddBlockingColumn}
                        className="mt-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Blocking Column
                      </Button>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div>
                      <h4 className="text-sm font-medium mb-2">Derived Blocking Rules</h4>
                      <div className="space-y-3">
                        {derivedBlockingFields.map((field, index) => (
                          <Card key={field.id} className="p-4 border">
                            <div className="grid gap-3">
                              <FormField
                                control={form.control}
                                name={`derivedBlockingRules.${index}.type` as const}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Rule Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select rule type" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="postcode-district">Postcode District</SelectItem>
                                        <SelectItem value="postcode-sector">Postcode Sector</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormDescription>
                                      Type of derived blocking rule to apply
                                    </FormDescription>
                                  </FormItem>
                                )}
                              />
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormField
                                  control={form.control}
                                  name={`derivedBlockingRules.${index}.sourceColumn` as const}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Source Column</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select source column" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {mappedColumns.filter(col => col.include).map((column) => (
                                            <SelectItem key={column.originalName} value={column.mappedName || ''}>
                                              {column.mappedName}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name={`derivedBlockingRules.${index}.targetColumn` as const}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Target Column Name</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Generated column name"
                                          {...field}
                                          value={field.value || `${form.watch(`derivedBlockingRules.${index}.sourceColumn`)}_${form.watch(`derivedBlockingRules.${index}.type`)}`}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                              
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveDerivedBlockingRule(index)}
                                className="w-full mt-2"
                              >
                                <Minus className="h-4 w-4 mr-2" />
                                Remove Rule
                              </Button>
                            </div>
                          </Card>
                        ))}
                        
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddDerivedBlockingRule}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Derived Blocking Rule
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="advanced">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Advanced Settings
                  </CardTitle>
                  <CardDescription>
                    Configure advanced options for the deduplication process.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="threshold"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Overall Similarity Threshold: {field.value.toFixed(2)}</FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-2">
                            <Slider
                              defaultValue={[field.value || 0.8]}
                              max={1}
                              step={0.05}
                              onValueChange={(value) => field.onChange(value[0])}
                            />
                            <span className="w-12 text-sm">{(field.value * 100).toFixed(0)}%</span>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Set the overall similarity threshold for considering records as duplicates.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  
                  {/* Removed useSplink toggle since we always use it now */}
                  <SplinkSettings form={form} onSettingsChange={() => {}} />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="performance">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    Performance Settings
                  </CardTitle>
                  <CardDescription>
                    Configure options to improve performance for large datasets
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="useWebWorker"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Use Web Worker
                          </FormLabel>
                          <FormDescription>
                            Process data in a background thread to prevent UI freezing
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="splinkParams.enableLargeDatasetMode"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Large Dataset Mode
                          </FormLabel>
                          <FormDescription>
                            Enable optimizations for datasets with more than 100,000 records
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="enableStreamProcessing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Stream Processing
                          </FormLabel>
                          <FormDescription>
                            Process data in chunks for very large datasets (recommended for 1M+ records)
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch('splinkParams.enableLargeDatasetMode') && (
                    <FormField
                      control={form.control}
                      name="splinkParams.maxChunkSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Chunk Size</FormLabel>
                          <FormDescription>
                            Number of records to process in each chunk (lower values reduce memory usage but increase processing time)
                          </FormDescription>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="50000"
                              min={1000}
                              max={100000}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 50000)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end gap-2 mt-6">
            <Button 
              type="button" 
              disabled={isProcessing}
              onClick={form.handleSubmit(onSaveConfig)}
            >
              {isProcessing ? (
                <>
                  <AlertCircle className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
            <Button type="submit" variant="outline" disabled={isProcessing}>
              <Play className="h-4 w-4 mr-2" />
              Start Deduplication
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default DedupeConfig;
