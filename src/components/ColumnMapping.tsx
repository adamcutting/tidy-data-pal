
import React, { useState, useEffect } from 'react';
import { Check, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { MappedColumn, FileData } from '@/lib/types';

interface ColumnMappingProps {
  fileData: FileData;
  onMappingComplete: (mappedColumns: MappedColumn[]) => void;
}

const ColumnMapping: React.FC<ColumnMappingProps> = ({ fileData, onMappingComplete }) => {
  const [mappedColumns, setMappedColumns] = useState<MappedColumn[]>([]);
  const [allSelected, setAllSelected] = useState<boolean>(true);

  useEffect(() => {
    // Initialize with all columns from the file
    const initialMapping = fileData.columns.map(col => ({
      originalName: col,
      mappedName: col, // Default to the same name
      include: true
    }));
    
    setMappedColumns(initialMapping);
  }, [fileData]);

  const handleToggleColumn = (index: number) => {
    const newMappings = [...mappedColumns];
    newMappings[index].include = !newMappings[index].include;
    setMappedColumns(newMappings);
    updateAllSelected(newMappings);
  };

  const handleColumnNameChange = (index: number, value: string) => {
    const newMappings = [...mappedColumns];
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

    onMappingComplete(mappedColumns);
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
              className="grid grid-cols-12 gap-4 p-3 border-b last:border-b-0 hover:bg-secondary/30 transition-colors items-center"
            >
              <div className="col-span-1 flex items-center justify-center">
                <Switch
                  checked={col.include}
                  onCheckedChange={() => handleToggleColumn(index)}
                  className="focus-ring"
                />
              </div>
              <div className="col-span-5 truncate">
                <span className={`inline-block ${!col.include && 'text-muted-foreground'}`}>
                  {col.originalName}
                </span>
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
        </ul>
      </div>
    </div>
  );
};

export default ColumnMapping;
