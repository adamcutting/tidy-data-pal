import { DatabaseLoadRequest, DatabaseType, MySQLConfig, MSSQLConfig, DedupeProgress, DatabaseMetadata } from './types';
import { toast } from 'sonner';

// Polling interval in ms for checking job status
const POLLING_INTERVAL = 1500;

// Use a backend API endpoint for database operations
const API_ENDPOINT = '/api';

/**
 * Function to get database metadata (tables and views) from a SQL database
 */
export const getDatabaseMetadata = async (
  dbType: DatabaseType,
  config: MySQLConfig | MSSQLConfig
): Promise<DatabaseMetadata> => {
  console.log(`Fetching metadata for ${dbType} database:`, config);

  try {
    // For demo/testing, we'll use mock data
    // In production, this should be a real API call to a backend that handles the DB connection
    if (dbType === 'mssql') {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return mock data based on the database name to simulate real tables
      // In a real implementation, this would be an API call to your backend
      const mockMetadata = {
        tables: [
          'Customers', 'Orders', 'Products', 'Employees', 'Suppliers',
          'Categories', 'OrderDetails', 'Shippers', 'Regions', 'Territories'
        ],
        views: ['CustomerOrders', 'ProductInventory', 'EmployeeDirectory', 'SalesReport']
      };
      
      console.log("Fetched tables and views (mock):", mockMetadata);
      return mockMetadata;
    } else {
      // MySQL mock implementation
      console.warn('MySQL implementation using mock data');
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Return mock data for MySQL
      return {
        tables: ['customers', 'orders', 'products', 'employees', 'inventory'],
        views: ['customer_orders', 'product_inventory']
      };
    }
  } catch (error) {
    console.error('Error fetching database metadata:', error);
    throw new Error(`Failed to fetch database metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Function to load data from a database
 */
export const loadDatabaseData = async (
  dbType: DatabaseType,
  config: MySQLConfig | MSSQLConfig,
  query: string,
  isTable: boolean,
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<any[]> => {
  console.log(`Loading data from ${dbType} database:`, config);
  console.log(`Query/Table: ${query}, isTable: ${isTable}`);
  
  // Set initial progress state
  onProgressUpdate({
    status: 'connecting',
    percentage: 10,
    statusMessage: `Connecting to ${dbType} database...`,
  });

  try {
    // For demo/development purposes, we're using mock data
    // In production, this should be a real API call to a backend
    
    // Simulate connecting to database
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    onProgressUpdate({
      status: 'loading',
      percentage: 30,
      statusMessage: isTable ? 
        `Loading data from table "${query}"...` : 
        'Executing query and loading results...',
    });
    
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate mock data based on the selected table/query
    const mockData = generateMockDataForTable(query, 50);
    
    // Final progress update
    onProgressUpdate({
      status: 'completed',
      percentage: 100,
      statusMessage: `Successfully loaded ${mockData.length} records from database.`,
      recordsProcessed: mockData.length,
      totalRecords: mockData.length
    });
    
    return mockData;
  } catch (error) {
    console.error(`Error loading ${dbType} data:`, error);
    
    onProgressUpdate({
      status: 'failed',
      percentage: 0,
      statusMessage: `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw new Error(`Failed to load data from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper function to generate realistic mock data for different tables
const generateMockDataForTable = (tableName: string, count: number): any[] => {
  const data = [];
  
  // Different field sets based on common table names
  let fields: string[] = [];
  
  // Create different mock data based on table name
  if (/customer/i.test(tableName)) {
    fields = ['CustomerID', 'CompanyName', 'ContactName', 'ContactTitle', 'Address', 'City', 'Region', 'PostalCode', 'Country', 'Phone'];
  } else if (/order/i.test(tableName)) {
    fields = ['OrderID', 'CustomerID', 'EmployeeID', 'OrderDate', 'RequiredDate', 'ShippedDate', 'ShipVia', 'Freight', 'ShipName', 'ShipAddress'];
  } else if (/product/i.test(tableName)) {
    fields = ['ProductID', 'ProductName', 'SupplierID', 'CategoryID', 'QuantityPerUnit', 'UnitPrice', 'UnitsInStock', 'UnitsOnOrder', 'ReorderLevel', 'Discontinued'];
  } else if (/employee/i.test(tableName)) {
    fields = ['EmployeeID', 'LastName', 'FirstName', 'Title', 'TitleOfCourtesy', 'BirthDate', 'HireDate', 'Address', 'City', 'Region'];
  } else {
    // Default fields for any other table
    fields = ['ID', 'Name', 'Description', 'CreatedDate', 'ModifiedDate', 'IsActive'];
  }
  
  // Generate mock records
  for (let i = 0; i < count; i++) {
    const item: Record<string, any> = {};
    
    // Add values for each field
    fields.forEach(field => {
      if (field.includes('ID')) {
        item[field] = i + 1000;
      } else if (field.includes('Name')) {
        item[field] = `${field.replace('Name', '')} ${i + 1}`;
      } else if (field.includes('Date')) {
        const date = new Date(Date.now() - Math.random() * 31536000000);
        item[field] = date.toISOString().split('T')[0];
      } else if (field.includes('Price') || field.includes('Freight')) {
        item[field] = (Math.random() * 1000).toFixed(2);
      } else if (field.includes('Quantity') || field.includes('Units')) {
        item[field] = Math.floor(Math.random() * 100);
      } else if (field.includes('Address')) {
        item[field] = `${Math.floor(Math.random() * 1000) + 1} Main St`;
      } else if (field.includes('City')) {
        const cities = ['New York', 'London', 'Paris', 'Tokyo', 'Sydney', 'Berlin', 'Madrid', 'Rome'];
        item[field] = cities[Math.floor(Math.random() * cities.length)];
      } else if (field.includes('Country')) {
        const countries = ['USA', 'UK', 'France', 'Japan', 'Australia', 'Germany', 'Spain', 'Italy'];
        item[field] = countries[Math.floor(Math.random() * countries.length)];
      } else if (field.includes('Phone')) {
        item[field] = `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
      } else if (field === 'IsActive' || field === 'Discontinued') {
        item[field] = Math.random() > 0.8;
      } else {
        item[field] = `${field} value ${i + 1}`;
      }
    });
    
    data.push(item);
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
