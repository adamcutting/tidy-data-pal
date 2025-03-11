
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch"; // Add this import for the Switch component
import { DedupeConfig as DedupeConfigType } from '@/lib/types';
import { Spinner } from '@/components/ui/spinner';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListCheck, ListPlus, Key } from 'lucide-react';
import SplinkSettings from './SplinkSettings';

export interface DedupeConfigProps {
  mappedColumns: { originalName: string; mappedName: string | null; include: boolean }[];
  onConfigComplete: (config: DedupeConfigType) => Promise<void>;
  isProcessing?: boolean; // Make this prop optional
}

// Interface for blocking rules
interface BlockingRule {
  type: 'column' | 'postcode-district' | 'postcode-sector';
  column: string;
  sourceColumn?: string; // For derived rules like postcode district/sector
}

const DedupeConfig: React.FC<DedupeConfigProps> = ({ mappedColumns, onConfigComplete, isProcessing }) => {
  const [configName, setConfigName] = useState<string>('');
  const [comparisons, setComparisons] = useState<{ column: string; matchType: 'exact' | 'fuzzy' | 'partial'; threshold?: number }[]>([]);
  const [blockingRules, setBlockingRules] = useState<BlockingRule[]>([]);
  const [threshold, setThreshold] = useState<number>(0.8);
  const [uniqueIdColumn, setUniqueIdColumn] = useState<string | null>(null);
  
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

  const handleAddBlockingRule = (type: 'column' | 'postcode-district' | 'postcode-sector') => {
    // Get first available mapped column not already used in a similar blocking rule
    const availableColumn = mappedColumns.find(col => 
      col.include && 
      col.mappedName && 
      !blockingRules.some(rule => 
        rule.type === type && 
        (rule.column === col.mappedName || 
         (type !== 'column' && rule.sourceColumn === col.mappedName))
      )
    )?.mappedName || '';
    
    if (type === 'column') {
      setBlockingRules([...blockingRules, { type, column: availableColumn }]);
    } else {
      // For postcode district/sector, we need to select a source postcode column
      const possiblePostcodeColumn = mappedColumns.find(col => 
        col.include && 
        col.mappedName && 
        col.mappedName.toLowerCase().includes('postcode')
      )?.mappedName || availableColumn;
      
      setBlockingRules([...blockingRules, { 
        type, 
        column: `${type === 'postcode-district' ? 'PostcodeDistrict' : 'PostcodeSector'}`, 
        sourceColumn: possiblePostcodeColumn 
      }]);
    }
  };

  const handleRemoveBlockingRule = (index: number) => {
    setBlockingRules(blockingRules.filter((_, i) => i !== index));
  };

  const handleBlockingRuleChange = (index: number, field: string, value: string) => {
    const newBlockingRules = [...blockingRules];
    newBlockingRules[index][field] = value;
    setBlockingRules(newBlockingRules);
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
      // Convert blocking rules to the format expected by the existing code
      blockingColumns: blockingRules.map(rule => {
        if (rule.type === 'column') {
          return rule.column;
        } else {
          // For derived columns, we'll include information about the derivation
          return `${rule.type}:${rule.sourceColumn}`;
        }
      }),
      // Only include derived rules (postcode-district and postcode-sector) in derivedBlockingRules
      derivedBlockingRules: blockingRules
        .filter(rule => rule.type !== 'column')
        .map(rule => ({
          type: rule.type as 'postcode-district' | 'postcode-sector', // Safe because we filtered out 'column'
          sourceColumn: rule.sourceColumn || '',
          targetColumn: rule.column
        })),
      threshold,
      useSplink: true, // Always use Splink
      dataSource: 'file', // Default to file - will be overridden in parent component
      // Add Splink parameters including the unique ID column
      splinkParams: {
        termFrequencyAdjustments: advancedConfig.termFrequencyAdjustments,
        retainMatchingColumns: advancedConfig.retainMatchingColumns,
        retainIntermediateCalculations: advancedConfig.retainIntermediateCalculations,
        trainModel: advancedConfig.trainModel,
        clusteringThreshold: advancedConfig.clusteringThreshold,
        uniqueIdColumn: uniqueIdColumn || undefined
      }
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

        {/* Splink settings section - always shown now */}
        <SplinkSettings />
        
        <div className="space-y-2 p-3 border rounded-md bg-muted/40">
          <div className="flex items-center space-x-2 mb-1">
            <Key className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="unique-id-column">Unique ID Column</Label>
          </div>
          <Select 
            value={uniqueIdColumn || "none"} 
            onValueChange={setUniqueIdColumn}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a unique identifier column" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No unique ID (auto-generate)</SelectItem>
              {availableColumns.map(column => (
                <SelectItem key={column} value={column}>{column}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select a column that uniquely identifies each record. If none exists, Splink will generate IDs automatically.
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
          <h3 className="font-medium mb-2">Blocking Rules</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Define rules to filter which records should be compared. This improves performance but may miss some duplicates.
          </p>
          
          {blockingRules.length > 0 ? (
            <div className="mb-4 space-y-3">
              {blockingRules.map((rule, index) => (
                <div key={index} className="p-3 border rounded-md bg-muted/40">
                  <div className="grid grid-cols-1 sm:grid-cols-8 gap-4">
                    <div className="sm:col-span-2">
                      <Label>Rule Type</Label>
                      <Select 
                        value={rule.type} 
                        onValueChange={(value) => handleBlockingRuleChange(index, 'type', value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Rule type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="column">Direct Column</SelectItem>
                          <SelectItem value="postcode-district">Postcode District</SelectItem>
                          <SelectItem value="postcode-sector">Postcode Sector</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {rule.type === 'column' ? (
                      <div className="sm:col-span-4">
                        <Label>Column</Label>
                        <Select 
                          value={rule.column} 
                          onValueChange={(value) => handleBlockingRuleChange(index, 'column', value)}
                        >
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
                    ) : (
                      <>
                        <div className="sm:col-span-4">
                          <Label>Source Postcode Column</Label>
                          <Select 
                            value={rule.sourceColumn || ''} 
                            onValueChange={(value) => handleBlockingRuleChange(index, 'sourceColumn', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select postcode column" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableColumns.map(column => (
                                <SelectItem key={column} value={column}>
                                  {column}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            {rule.type === 'postcode-district' 
                              ? 'Will extract the first part of the postcode (e.g., "SW1A" from "SW1A 1AA")'
                              : 'Will extract the outcode plus first digit of incode (e.g., "SW1A1" from "SW1A 1AA")'}
                          </p>
                        </div>
                      </>
                    )}
                    
                    <div className="sm:col-span-2 flex items-end">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRemoveBlockingRule(index)}
                        className="w-full h-10"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-amber-500 mb-4">
              Warning: No blocking rules defined. This may result in very slow performance with large datasets.
            </p>
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="outline" onClick={() => handleAddBlockingRule('column')}>
              <ListCheck className="h-4 w-4 mr-2" />
              Add Column Rule
            </Button>
            <Button variant="outline" onClick={() => handleAddBlockingRule('postcode-district')}>
              <ListPlus className="h-4 w-4 mr-2" />
              Add Postcode District
            </Button>
            <Button variant="outline" onClick={() => handleAddBlockingRule('postcode-sector')}>
              <ListPlus className="h-4 w-4 mr-2" />
              Add Postcode Sector
            </Button>
          </div>
          
          <div className="rounded-md bg-amber-50 p-3 mb-4 border border-amber-200">
            <h4 className="text-sm font-medium text-amber-800 mb-1">About Postcode Rules</h4>
            <p className="text-xs text-amber-700">
              <strong>Postcode District:</strong> The first part of a UK postcode (outcode), e.g., "SW1A" from "SW1A 1AA".<br />
              <strong>Postcode Sector:</strong> Outcode plus first digit of incode, e.g., "SW1A1" from "SW1A 1AA".
            </p>
          </div>
        </div>

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
