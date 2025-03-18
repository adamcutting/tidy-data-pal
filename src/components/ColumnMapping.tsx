
import React, { useState, useEffect } from 'react';
import { Check, X, ArrowRight, Key, Plus, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { MappedColumn, FileData } from '@/lib/types';

interface ColumnMappingProps {
  fileData: FileData;
  onMappingComplete: (mappedColumns: MappedColumn[], uniqueIdColumn?: string) => void;
}

const ColumnMapping: React.FC<ColumnMappingProps> = ({ fileData, onMappingComplete }) => {
  const [mappedColumns, setMappedColumns] = useState<MappedColumn[]>([]);
  const [allSelected, setAllSelected] = useState<boolean>(true);
  const [uniqueIdColumn, setUniqueIdColumn] = useState<string | null>(null);
  const [generateNewId, setGenerateNewId] = useState<boolean>(false);

  useEffect(() => {
    // Initialize with all columns from the file
    const initialMapping = fileData.columns.map(col => ({
      originalName: col,
      mappedName: col, // Default to the same name
      include: true
    }));
    
    setMappedColumns(initialMapping);
    
    // Try to automatically find a unique ID column
    const possibleIdColumns = fileData.columns.filter(col => 
      col.toLowerCase().includes('id') && 
      !col.toLowerCase().includes('hidden') && 
      !col.toLowerCase().includes('middle')
    );
    
    if (possibleIdColumns.length > 0) {
      setUniqueIdColumn(possibleIdColumns[0]);
    }
  }, [fileData]);

  const handleToggleColumn = (index: number) => {
    const newMappings = [...mappedColumns];
    newMappings[index].include = !newMappings[index].include;
    setMappedColumns(newMappings);
    updateAllSelected(newMappings);
    
    // If toggling off the unique ID column, reset it
    if (uniqueIdColumn === newMappings[index].originalName && !newMappings[index].include) {
      setUniqueIdColumn(null);
    }
  };

  const handleColumnNameChange = (index: number, value: string) => {
    const newMappings = [...mappedColumns];
    
    // If changing the unique ID column name, update the uniqueIdColumn reference
    if (uniqueIdColumn === newMappings[index].originalName || uniqueIdColumn === newMappings[index].mappedName) {
      setUniqueIdColumn(value);
    }
    
    newMappings[index].mappedName = value;
    setMappedColumns(newMappings);
  };

  const updateAllSelected = (mappings: MappedColumn[]) => {
    setAllSelected(mappings.every(col => col.include));
  };

  const toggleSelectAll = () => {
    const newValue = !allSelected;
    const newMappings = mappedColumns.map(col => ({
      ...col,
      include: newValue
    }));
    setMappedColumns(newMappings);
    setAllSelected(newValue);
    
    // Reset unique ID column if deselecting all
    if (!newValue) {
      setUniqueIdColumn(null);
    }
  };

  const handleUniqueIdSelect = (columnName: string) => {
    setUniqueIdColumn(columnName);
    setGenerateNewId(false);
    
    // Make sure the column is included
    const index = mappedColumns.findIndex(col => 
      col.originalName === columnName || col.mappedName === columnName
    );
    
    if (index !== -1 && !mappedColumns[index].include) {
      const newMappings = [...mappedColumns];
      newMappings[index].include = true;
      setMappedColumns(newMappings);
      updateAllSelected(newMappings);
    }
  };

  const handleGenerateNewId = () => {
    setUniqueIdColumn('generated_unique_id');
    setGenerateNewId(true);
    toast.info('A new unique ID column will be generated for your data');
  };

  const handleSaveMapping = () => {
    // Check if at least one column is selected
    if (!mappedColumns.some(col => col.include)) {
      toast.error('Please select at least one column to continue.');
      return;
    }

    // Check if all selected columns have names
    const hasEmptyNames = mappedColumns.some(col => col.include && (!col.mappedName || col.mappedName.trim() === ''));
    if (hasEmptyNames) {
      toast.error('All selected columns must have names.');
      return;
    }

    // Check for duplicate names
    const selectedNames = mappedColumns
      .filter(col => col.include && col.mappedName)
      .map(col => col.mappedName);
    const uniqueNames = new Set(selectedNames);
    
    if (uniqueNames.size !== selectedNames.length) {
      toast.error('Column names must be unique.');
      return;
    }

    // Pass the unique ID column to the parent component
    onMappingComplete(mappedColumns, generateNewId ? 'generated_unique_id' : uniqueIdColumn || undefined);
    toast.success('Column mapping saved successfully!');
  };

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in">
      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-secondary/50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Map Columns</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className="text-xs h-8"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Select which columns to include and rename them if needed.
          </p>
        </div>

        <div className="p-4 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Unique ID Column</h4>
              <p className="text-xs text-muted-foreground">
                Select a column to use as the unique identifier or generate a new one
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    {uniqueIdColumn || 'Select ID column'}
                    <ArrowDown className="h-4 w-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-2">
                  <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
                    {mappedColumns
                      .filter(col => col.include)
                      .map(col => (
                        <Button 
                          key={col.originalName}
                          variant="ghost" 
                          size="sm"
                          className={`justify-start ${uniqueIdColumn === (col.mappedName || col.originalName) ? 'bg-primary/10' : ''}`}
                          onClick={() => handleUniqueIdSelect(col.mappedName || col.originalName)}
                        >
                          <Key className="h-3.5 w-3.5 mr-2" />
                          {col.mappedName || col.originalName}
                        </Button>
                      ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button 
                variant={generateNewId ? "default" : "outline"} 
                size="sm"
                onClick={handleGenerateNewId}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Generate ID
              </Button>
            </div>
          </div>
        </div>

        <div className="p-1 max-h-[400px] overflow-y-auto">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-4 p-3 border-b text-sm font-medium text-muted-foreground">
            <div className="col-span-1 flex items-center justify-center">
              Use
            </div>
            <div className="col-span-5">Original Name</div>
            <div className="col-span-1 flex items-center justify-center">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div className="col-span-5">New Name</div>
          </div>

          {/* Mapping rows */}
          {mappedColumns.map((col, index) => (
            <div 
              key={col.originalName} 
              className={`grid grid-cols-12 gap-4 p-3 border-b last:border-b-0 hover:bg-secondary/30 transition-colors items-center ${
                uniqueIdColumn === (col.mappedName || col.originalName) ? 'bg-primary/5' : ''
              }`}
            >
              <div className="col-span-1 flex items-center justify-center">
                <Switch
                  checked={col.include}
                  onCheckedChange={() => handleToggleColumn(index)}
                  className="focus-ring"
                />
              </div>
              <div className="col-span-5 truncate flex items-center">
                <span className={`inline-block ${!col.include && 'text-muted-foreground'}`}>
                  {col.originalName}
                </span>
                {uniqueIdColumn === (col.mappedName || col.originalName) && (
                  <Key className="h-3.5 w-3.5 ml-2 text-primary" />
                )}
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <ArrowRight className={`h-4 w-4 ${!col.include && 'text-muted-foreground'}`} />
              </div>
              <div className="col-span-5">
                <Input
                  value={col.mappedName || ''}
                  onChange={(e) => handleColumnNameChange(index, e.target.value)}
                  disabled={!col.include}
                  className="h-9 focus-ring"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t bg-secondary/50 flex justify-end">
          <Button onClick={handleSaveMapping} className="btn-transition">
            Save Mapping
          </Button>
        </div>
      </div>

      <div className="mt-6 bg-muted/50 rounded-lg p-4 text-sm">
        <h4 className="font-medium mb-2">Column Mapping Tips</h4>
        <ul className="space-y-1 text-muted-foreground list-disc pl-5">
          <li>Rename columns to standardize field names</li>
          <li>Exclude columns with sensitive or irrelevant data</li>
          <li>Include all potential matching fields for better deduplication results</li>
          <li>Select a unique ID column or generate one for better tracking of results</li>
        </ul>
      </div>
    </div>
  );
};

export default ColumnMapping;
