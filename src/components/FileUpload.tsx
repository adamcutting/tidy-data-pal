
import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileData } from '@/lib/types';
import { parseCSV } from '@/lib/dedupeService';

interface FileUploadProps {
  onFileLoaded: (fileData: FileData) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) {
      processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    setFile(file);

    const fileType = file.name.split('.').pop()?.toLowerCase() || '';
    const validTypes = ['csv', 'txt', 'xlsx', 'xls'];

    if (!validTypes.includes(fileType)) {
      toast.error('Please upload a CSV, TXT, or Excel file.');
      setFile(null);
      setIsLoading(false);
      return;
    }

    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result;
        
        // For demonstration, only handling CSV/TXT properly
        // In a real app, would need proper Excel parsing library
        if (fileType === 'csv' || fileType === 'txt') {
          const csvData = result as string;
          const parsedData = parseCSV(csvData);
          const columns = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
          
          onFileLoaded({
            fileName: file.name,
            fileType,
            data: parsedData,
            rawData: result,
            columns,
          });

          toast.success(`Successfully loaded ${parsedData.length} rows from ${file.name}`);
        } else {
          // Mock for Excel files
          toast.error('Excel parsing is not implemented in this demo. Please use CSV files.');
          setFile(null);
        }
        
        setIsLoading(false);
      };
      
      reader.onerror = () => {
        toast.error('Error reading file.');
        setFile(null);
        setIsLoading(false);
      };
      
      if (fileType === 'csv' || fileType === 'txt') {
        reader.readAsText(file);
      } else {
        // For Excel files - in a real app would use proper Excel parser
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process file.');
      setFile(null);
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div
        className={`
          relative h-64 border-2 border-dashed rounded-lg p-6
          flex flex-col items-center justify-center space-y-4
          transition-all duration-300 ease-in-out
          ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
          ${isLoading ? 'opacity-70 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleFileDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />

        {!file ? (
          <>
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center animate-float">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium mb-1">Drop your file here</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Supported formats: CSV, TXT or Excel
              </p>
            </div>
            <Button 
              onClick={triggerFileInput}
              className="btn-transition hover:scale-105"
            >
              Select File
            </Button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-secondary/80 rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium mb-1 flex items-center justify-center gap-2">
                {file.name}
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </h3>
              <p className="text-muted-foreground text-sm">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={triggerFileInput}
                className="btn-transition"
              >
                Change File
              </Button>
            </div>
          </>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-medium">Processing file...</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-sm text-muted-foreground">
        <div className="flex items-center mb-2 gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>Your data remains private and is processed locally in your browser.</span>
        </div>
        <p className="pl-6">For best results with large files, use CSV format.</p>
      </div>
    </div>
  );
};

export default FileUpload;
