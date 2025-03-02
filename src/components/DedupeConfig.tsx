
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { DedupeConfig, MappedColumn } from '@/lib/types';
import { PlusCircle, XCircle, Settings2, Shield, Gauge } from 'lucide-react';

interface DedupeConfigProps {
  mappedColumns: MappedColumn[];
  onConfigComplete: (config: DedupeConfig) => void;
}

const DedupeConfigComponent: React.FC<DedupeConfigProps> = ({ mappedColumns, onConfigComplete }) => {
  const [blockingColumns, setBlockingColumns] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<DedupeConfig['comparisons']>([]);
  const [threshold, setThreshold] = useState<number>(0.8);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedMatchType, setSelectedMatchType] = useState<'exact' | 'fuzzy' | 'partial'>('exact');

  const includedColumns = mappedColumns
    .filter(col => col.include && col.mappedName)
    .map(col => col.mappedName as string);

  useEffect(() => {
    if (includedColumns.length > 0 && !selectedColumn) {
      setSelectedColumn(includedColumns[0]);
    }
  }, [includedColumns]);

  const handleAddComparison = () => {
    if (!selectedColumn) {
      toast.error('Please select a column');
      return;
    }

    // Check if comparison already exists
    if (comparisons.some(c => c.column === selectedColumn)) {
      toast.error('This column is already added to comparisons');
      return;
    }

    const newComparison = {
      column: selectedColumn,
      matchType: selectedMatchType,
      ...(selectedMatchType !== 'exact' && { threshold: 0.8 })
    };

    setComparisons([...comparisons, newComparison]);
    toast.success(`Added ${selectedColumn} to comparisons`);
  };

  const handleRemoveComparison = (column: string) => {
    setComparisons(comparisons.filter(c => c.column !== column));
  };

  const handleToggleBlockingColumn = (column: string) => {
    if (blockingColumns.includes(column)) {
      setBlockingColumns(blockingColumns.filter(c => c !== column));
    } else {
      setBlockingColumns([...blockingColumns, column]);
    }
  };

  const handleUpdateComparisonThreshold = (column: string, value: number) => {
    setComparisons(
      comparisons.map(c => c.column === column ? {...c, threshold: value} : c)
    );
  };

  const handleSaveConfig = () => {
    if (comparisons.length === 0) {
      toast.error('Please add at least one column for comparison');
      return;
    }

    const config: DedupeConfig = {
      comparisons,
      blockingColumns,
      threshold
    };

    onConfigComplete(config);
    toast.success('Deduplication configuration saved');
  };

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column */}
        <div className="space-y-6">
          <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-secondary/50 flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Comparison Settings</h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Add Column Comparison</label>
                <div className="flex gap-2">
                  <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {includedColumns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedMatchType} onValueChange={(val: any) => setSelectedMatchType(val)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Match type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact</SelectItem>
                      <SelectItem value="fuzzy">Fuzzy</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={handleAddComparison} 
                    size="icon" 
                    className="shrink-0 btn-transition"
                  >
                    <PlusCircle className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <label className="text-sm font-medium">Column Comparisons</label>
                {comparisons.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md text-center">
                    No comparisons added yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comparisons.map((comparison, index) => (
                      <div 
                        key={comparison.column} 
                        className="bg-secondary/50 rounded-md p-3 relative"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <Badge variant="outline" className="mb-2">
                              {comparison.matchType}
                            </Badge>
                            <h4 className="font-medium">{comparison.column}</h4>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 absolute right-2 top-2 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveComparison(comparison.column)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {comparison.matchType !== 'exact' && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Threshold: {comparison.threshold?.toFixed(2)}</span>
                              <span>{comparison.threshold && (comparison.threshold * 100).toFixed(0)}%</span>
                            </div>
                            <Slider
                              value={[comparison.threshold || 0.8]}
                              min={0}
                              max={1}
                              step={0.05}
                              onValueChange={(values) => handleUpdateComparisonThreshold(comparison.column, values[0])}
                              className="focus-ring"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right column */}
        <div className="space-y-6">
          <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-secondary/50 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Blocking Columns</h3>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Blocking columns are used to group records before comparison, significantly improving performance. 
                Only records in the same group will be compared.
              </p>
              
              <div className="space-y-2">
                {includedColumns.map(column => (
                  <div 
                    key={column}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-muted/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      id={`block-${column}`}
                      checked={blockingColumns.includes(column)}
                      onChange={() => handleToggleBlockingColumn(column)}
                      className="rounded text-primary"
                    />
                    <label 
                      htmlFor={`block-${column}`}
                      className="flex-grow cursor-pointer text-sm"
                    >
                      {column}
                    </label>
                  </div>
                ))}
              </div>
              
              {includedColumns.length === 0 && (
                <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md text-center">
                  No columns available
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-secondary/50 flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Overall Threshold</h3>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Set the minimum similarity score required for records to be considered duplicates.
              </p>
              
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Threshold: {threshold.toFixed(2)}</span>
                  <span>{(threshold * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[threshold]}
                  min={0.5}
                  max={1}
                  step={0.05}
                  onValueChange={(values) => setThreshold(values[0])}
                  className="focus-ring"
                />
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>More matches<br />(lower precision)</span>
                <span>Fewer matches<br />(higher precision)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex justify-end">
        <Button onClick={handleSaveConfig} className="btn-transition">
          Save Configuration
        </Button>
      </div>
    </div>
  );
};

export default DedupeConfigComponent;
