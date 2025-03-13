
import { DatabaseLoadRequest, DatabaseType, MySQLConfig, MSSQLConfig, DedupeProgress } from './types';

// Mock polling interval in ms (in a real implementation this would call an actual backend API)
const POLLING_INTERVAL = 1500;

// Mock function to load data from a database
export const loadDatabaseData = async (
  dbType: DatabaseType,
  config: MySQLConfig | MSSQLConfig,
  query: string,
  isTable: boolean,
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<any[]> => {
  // In a real implementation, this would make an API call to a backend service
  // For now, we'll simulate the process with a delay

  // Set initial progress state
  onProgressUpdate({
    status: 'connecting',
    percentage: 10,
    statusMessage: `Connecting to ${dbType} database...`,
  });

  // Simulate connection delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Update progress to loading
  onProgressUpdate({
    status: 'loading',
    percentage: 30,
    statusMessage: isTable ? 
      `Loading data from table "${query}"...` : 
      'Executing query and loading results...',
  });

  // Simulate data loading delay
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Generate mock data based on the database type and config
  const mockData = generateMockData(query, 1000);

  // Final progress update
  onProgressUpdate({
    status: 'completed',
    percentage: 100,
    statusMessage: `Successfully loaded ${mockData.length} records from database.`,
    recordsProcessed: mockData.length,
    totalRecords: mockData.length
  });

  return mockData;
};

// Function to generate mock data for demonstration
const generateMockData = (tableOrQuery: string, count: number): any[] => {
  const data = [];
  
  // Generate column names based on the 'table name'
  const columns = ['id', 'company_name', 'address_line_1', 'address_line_2', 'city', 'state', 'postcode', 'phone'];

  // Generate mock data rows
  for (let i = 0; i < count; i++) {
    const row: Record<string, any> = {};
    
    // Add an ID
    row['id'] = i + 1;
    
    // Add company name (with some duplicates for testing)
    if (i % 10 === 0 && i > 0) {
      // Create near-duplicate with slight variation
      const prevIndex = i - (i % 5 === 0 ? 5 : 1);
      row['company_name'] = data[prevIndex]['company_name'] + (i % 3 === 0 ? ' Ltd' : '');
    } else {
      row['company_name'] = `Company ${i + 1}`;
    }
    
    // Add address fields
    row['address_line_1'] = `${i + 100} Main Street`;
    row['address_line_2'] = i % 3 === 0 ? `Suite ${i % 10 + 1}` : '';
    row['city'] = i % 5 === 0 ? 'London' : i % 5 === 1 ? 'Manchester' : i % 5 === 2 ? 'Birmingham' : i % 5 === 3 ? 'Edinburgh' : 'Glasgow';
    row['state'] = '';
    row['postcode'] = `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 1) % 26))}${i % 10}${i % 10} ${i % 10}${String.fromCharCode(65 + ((i + 2) % 26))}${String.fromCharCode(65 + ((i + 3) % 26))}`;
    row['phone'] = `+44 ${Math.floor(Math.random() * 1000).toString().padStart(3, '0')} ${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
    
    data.push(row);
  }
  
  return data;
};

// Polling function to check dedupe status
export const pollDedupeStatus = async (
  jobId: string, 
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<void> => {
  let isCompleted = false;
  let currentProgress = 0;
  const totalSteps = 6;
  
  // Mock stages of processing
  const stages = [
    { status: 'loading', message: 'Loading and preparing data...' },
    { status: 'processing', message: 'Creating comparison vectors...' },
    { status: 'processing', message: 'Calculating match probabilities...' },
    { status: 'blocked', message: 'Applying blocking rules...' },
    { status: 'clustering', message: 'Clustering similar records...' },
    { status: 'completed', message: 'Deduplication completed successfully.' }
  ];
  
  let currentStage = 0;
  
  while (!isCompleted) {
    // Calculate progress percentage
    const stageProgress = Math.min(100, (currentProgress * 100) / totalSteps);
    
    // Get current stage info
    const stage = stages[currentStage];
    
    // Update progress
    onProgressUpdate({
      status: stage.status as any,
      percentage: stageProgress,
      statusMessage: stage.message,
      recordsProcessed: Math.floor(1000 * (stageProgress / 100)),
      totalRecords: 1000,
      estimatedTimeRemaining: stageProgress < 100 ? 
        `${Math.ceil((totalSteps - currentProgress) * POLLING_INTERVAL / 1000)} seconds` : 
        undefined
    });
    
    // Increment progress
    currentProgress += 0.5;
    
    // Move to next stage if needed
    if (currentProgress >= (currentStage + 1) * (totalSteps / stages.length)) {
      currentStage = Math.min(currentStage + 1, stages.length - 1);
    }
    
    // Check if completed
    if (currentStage === stages.length - 1 && currentProgress >= totalSteps) {
      isCompleted = true;
    } else {
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }
  }
};
