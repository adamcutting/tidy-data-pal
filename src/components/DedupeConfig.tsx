
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DedupeConfig as DedupeConfigType } from '@/lib/types';
import { Spinner } from '@/components/ui/spinner';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface DedupeConfigProps {
  mappedColumns: { originalName: string; mappedName: string | null; include: boolean }[];
  onConfigComplete: (config: DedupeConfigType) => Promise<void>;
  isProcessing?: boolean; // Make this prop optional
}

const DedupeConfig: React.FC<DedupeConfigProps> = ({ mappedColumns, onConfigComplete, isProcessing }) => {
  const [configName, setConfigName] = useState<string>('');
  const [comparisons, setComparisons] = useState<{ column: string; matchType: 'exact' | 'fuzzy' | 'partial'; threshold?: number }[]>([]);
  const [blockingColumns, setBlockingColumns] = useState<string[]>([]);
  const [threshold, setThreshold] = useState<number>(0.8);
  const [useSplink, setUseSplink] = useState<boolean>(false);
  
  // Advanced Splink configuration options
  const [advancedConfig, setAdvancedConfig] = useState({
    termFrequencyAdjustments: true,
    retainMatchingColumns: true,
    retainIntermediateCalculations: false,
    trainModel: true,
    clusteringThreshold: 0.95
  });

  const handleAddComparison = () => {
    // Get first available mapped column
    const availableColumn = mappedColumns.find(col => col.include && col.mappedName)?.mappedName || '';
    setComparisons([...comparisons, { column: availableColumn, matchType: 'exact' }]);
  };

  const handleComparisonChange = (index: number, field: string, value: any) => {
    const newComparisons = [...comparisons];
    newComparisons[index][field] = value;
    setComparisons(newComparisons);
  };

  const handleAddBlockingColumn = () => {
    // Get first available mapped column not already in blocking columns
    const availableColumn = mappedColumns.find(col => 
      col.include && 
      col.mappedName && 
      !blockingColumns.includes(col.mappedName)
    )?.mappedName;
    
    if (availableColumn) {
      setBlockingColumns([...blockingColumns, availableColumn]);
    }
  };

  const handleRemoveBlockingColumn = (index: number) => {
    setBlockingColumns(blockingColumns.filter((_, i) => i !== index));
  };

  const handleAdvancedConfigChange = (field: keyof typeof advancedConfig, value: any) => {
    setAdvancedConfig({
      ...advancedConfig,
      [field]: value
    });
  };

  const handleSubmit = async () => {
    const config: DedupeConfigType = {
      name: configName || `Config_${new Date().toISOString().slice(0, 10)}`,
      comparisons,
      blockingColumns,
      threshold,
      useSplink,
      dataSource: 'file', // Default to file - will be overridden in parent component
      // Add advanced Splink configuration if enabled
      splinkParams: useSplink ? {
        termFrequencyAdjustments: advancedConfig.termFrequencyAdjustments,
        retainMatchingColumns: advancedConfig.retainMatchingColumns,
        retainIntermediateCalculations: advancedConfig.retainIntermediateCalculations,
        trainModel: advancedConfig.trainModel,
        clusteringThreshold: advancedConfig.clusteringThreshold
      } : undefined
    };
    await onConfigComplete(config);
  };

  const handleRemoveComparison = (index: number) => {
    setComparisons(comparisons.filter((_, i) => i !== index));
  };

  // Get active mapped column names
  const availableColumns = mappedColumns
    .filter(col => col.include && col.mappedName)
    .map(col => col.mappedName as string);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dedupe Configuration</CardTitle>
        <CardDescription>Set up your deduplication configuration below.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="config-name">Configuration Name</Label>
          <Input 
            id="config-name"
            value={configName} 
            onChange={(e) => setConfigName(e.target.value)} 
            placeholder="My Deduplication Config"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="threshold-slider">Matching Threshold ({threshold.toFixed(2)})</Label>
            <span className="text-xs text-muted-foreground">
              {threshold < 0.5 ? 'Low' : threshold < 0.8 ? 'Medium' : 'High'} stringency
            </span>
          </div>
          <Slider 
            id="threshold-slider"
            value={[threshold]} 
            onValueChange={(value) => setThreshold(value[0])} 
            min={0} 
            max={1} 
            step={0.01} 
            className="py-4"
          />
          <p className="text-xs text-muted-foreground">
            Higher values require closer matches, reducing false positives but potentially missing duplicates.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Label htmlFor="use-splink" className="cursor-pointer">Use Splink for Advanced Matching</Label>
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                Recommended
              </span>
            </div>
            <Switch id="use-splink" checked={useSplink} onCheckedChange={setUseSplink} />
          </div>
          <p className="text-xs text-muted-foreground">
            Splink provides more accurate results using machine learning and probabilistic matching.
          </p>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Column Comparisons</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Define how columns should be compared when looking for duplicates.
          </p>
          
          {comparisons.map((comparison, index) => (
            <div key={index} className="mb-4 p-3 border rounded-md bg-muted/40">
              <div className="grid grid-cols-1 sm:grid-cols-8 gap-4">
                <div className="sm:col-span-3">
                  <Label>Column</Label>
                  <Select value={comparison.column} onValueChange={(value) => handleComparisonChange(index, 'column', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.map(column => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="sm:col-span-3">
                  <Label>Match Type</Label>
                  <Select value={comparison.matchType} onValueChange={(value) => 
                    handleComparisonChange(index, 'matchType', value as 'exact' | 'fuzzy' | 'partial')
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select match type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact</SelectItem>
                      <SelectItem value="fuzzy">Fuzzy</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {comparison.matchType !== 'exact' && (
                  <div className="sm:col-span-2">
                    <Label>Threshold</Label>
                    <Input 
                      type="number" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={comparison.threshold || 0.8} 
                      onChange={(e) => handleComparisonChange(index, 'threshold', parseFloat(e.target.value))} 
                    />
                  </div>
                )}
                
                <div className="sm:col-span-2 flex items-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleRemoveComparison(index)}
                    className="w-full h-10"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
          
          <Button onClick={handleAddComparison} className="mb-4">
            Add Comparison
          </Button>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Blocking Columns</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Records will only be compared if they have matching values in the blocking columns.
            This improves performance but may miss some duplicates.
          </p>
          
          {blockingColumns.length > 0 ? (
            <div className="mb-4 space-y-2">
              {blockingColumns.map((column, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                  <span>{column}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRemoveBlockingColumn(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-amber-500 mb-4">
              Warning: No blocking columns defined. This may result in very slow performance with large datasets.
            </p>
          )}
          
          <Button onClick={handleAddBlockingColumn} variant="outline" className="mb-4">
            Add Blocking Column
          </Button>
        </div>

        {useSplink && (
          <Accordion type="single" collapsible className="border-t pt-4">
            <AccordionItem value="advanced">
              <AccordionTrigger>Advanced Splink Configuration</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="term-freq">Term Frequency Adjustments</Label>
                      <p className="text-xs text-muted-foreground">Adjust for common values like "Smith" or "Ltd"</p>
                    </div>
                    <Switch 
                      id="term-freq" 
                      checked={advancedConfig.termFrequencyAdjustments} 
                      onCheckedChange={(checked) => handleAdvancedConfigChange('termFrequencyAdjustments', checked)} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="retain-cols">Retain Matching Columns</Label>
                      <p className="text-xs text-muted-foreground">Keep all columns in the output for reference</p>
                    </div>
                    <Switch 
                      id="retain-cols" 
                      checked={advancedConfig.retainMatchingColumns} 
                      onCheckedChange={(checked) => handleAdvancedConfigChange('retainMatchingColumns', checked)} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="train-model">Train Model</Label>
                      <p className="text-xs text-muted-foreground">Use machine learning to improve matching</p>
                    </div>
                    <Switch 
                      id="train-model" 
                      checked={advancedConfig.trainModel} 
                      onCheckedChange={(checked) => handleAdvancedConfigChange('trainModel', checked)} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Clustering Threshold ({advancedConfig.clusteringThreshold.toFixed(2)})</Label>
                    <Slider 
                      value={[advancedConfig.clusteringThreshold]} 
                      onValueChange={(value) => handleAdvancedConfigChange('clusteringThreshold', value[0])} 
                      min={0.5} 
                      max={1} 
                      step={0.01} 
                    />
                    <p className="text-xs text-muted-foreground">
                      Threshold used for grouping similar records into clusters
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        <div className="border-t pt-4">
          <Button 
            onClick={handleSubmit} 
            disabled={isProcessing || comparisons.length === 0} 
            className="w-full"
          >
            {isProcessing ? <Spinner /> : 'Run Deduplication'}
          </Button>
          
          {comparisons.length === 0 && (
            <p className="text-xs text-destructive mt-2">
              Please add at least one column comparison.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DedupeConfig;
