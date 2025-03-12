import { DatabaseLoadRequest, DatabaseType, MySQLConfig, MSSQLConfig, DedupeProgress } from './types';

// Polling interval in ms for checking job status
const POLLING_INTERVAL = 1500;

// Function to load data from a database
export const loadDatabaseData = async (
  dbType: DatabaseType,
  config: MySQLConfig | MSSQLConfig,
  query: string,
  isTable: boolean,
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<any[]> => {
  // Set initial progress state
  onProgressUpdate({
    status: 'connecting',
    percentage: 10,
    statusMessage: `Connecting to ${dbType} database...`,
  });

  try {
    let data: any[] = [];

    if (dbType === 'mssql') {
      // Since we're in a browser environment, we'll use a mock implementation
      // instead of the actual MSSQL connection
      data = await mockMSSQLData(config as MSSQLConfig, query, isTable, onProgressUpdate);
    } else if (dbType === 'mysql') {
      // For now, we'll use mock data for MySQL until we implement MySQL connectivity
      data = await mockMySQLData(query, onProgressUpdate);
    }

    // Final progress update
    onProgressUpdate({
      status: 'completed',
      percentage: 100,
      statusMessage: `Successfully loaded ${data.length} records from database.`,
      recordsProcessed: data.length,
      totalRecords: data.length
    });

    return data;
  } catch (error) {
    console.error('Database connection error:', error);
    onProgressUpdate({
      status: 'failed',
      percentage: 0,
      statusMessage: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};

// Mock implementation for MSSQL
const mockMSSQLData = async (
  config: MSSQLConfig,
  query: string,
  isTable: boolean,
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<any[]> => {
  // Simulate connection delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Update progress to loading
  onProgressUpdate({
    status: 'loading',
    percentage: 30,
    statusMessage: isTable ? 
      `Loading data from table "${query}"...` : 
      'Executing query and loading results...',
  });

  console.log(`Would connect to MSSQL server: ${config.server}:${config.port}`);
  console.log(`DB: ${config.database}, User: ${config.user}`);
  console.log(`Query/Table: ${isTable ? `SELECT * FROM ${query}` : query}`);
  
  // Simulate data loading delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Generate mock data
  const mockData = generateMockData(query, 1000);
  
  // Update progress
  onProgressUpdate({
    status: 'loading',
    percentage: 70,
    statusMessage: `Processing ${mockData.length} records...`,
    recordsProcessed: mockData.length,
    totalRecords: mockData.length
  });
  
  return mockData;
};

// Function to load data from MySQL (mock implementation)
const mockMySQLData = async (
  query: string,
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<any[]> => {
  // Simulate connection delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Update progress to loading
  onProgressUpdate({
    status: 'loading',
    percentage: 30,
    statusMessage: `Loading data from MySQL...`,
  });

  // Simulate data loading delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Generate mock data
  const mockData = generateMockData(query, 1000);
  
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
