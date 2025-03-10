
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

  const handleAddComparison = () => {
    setComparisons([...comparisons, { column: '', matchType: 'exact' }]);
  };

  const handleComparisonChange = (index: number, field: string, value: any) => {
    const newComparisons = [...comparisons];
    newComparisons[index][field] = value;
    setComparisons(newComparisons);
  };

  const handleSubmit = async () => {
    const config: DedupeConfigType = {
      name: configName,
      comparisons,
      blockingColumns,
      threshold,
      useSplink,
    };
    await onConfigComplete(config);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dedupe Configuration</CardTitle>
        <CardDescription>Set up your deduplication configuration below.</CardDescription>
      </CardHeader>
      <CardContent>
        <Label>Name</Label>
        <Input value={configName} onChange={(e) => setConfigName(e.target.value)} />
        
        <Label>Threshold</Label>
        <Slider value={[threshold]} onValueChange={(value) => setThreshold(value[0])} min={0} max={1} step={0.01} />

        <Label>Use Splink</Label>
        <Switch checked={useSplink} onCheckedChange={setUseSplink} />

        {comparisons.map((comparison, index) => (
          <div key={index}>
            <Label>Column</Label>
            <Input value={comparison.column} onChange={(e) => handleComparisonChange(index, 'column', e.target.value)} />
            <Label>Match Type</Label>
            <select value={comparison.matchType} onChange={(e) => handleComparisonChange(index, 'matchType', e.target.value)}>
              <option value="exact">Exact</option>
              <option value="fuzzy">Fuzzy</option>
              <option value="partial">Partial</option>
            </select>
          </div>
        ))}
        <Button onClick={handleAddComparison}>Add Comparison</Button>
        <Button onClick={handleSubmit} disabled={isProcessing}>
          {isProcessing ? <Spinner /> : 'Save Configuration'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DedupeConfig;
