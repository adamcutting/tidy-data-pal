import { DatabaseLoadRequest, DatabaseType, MySQLConfig, MSSQLConfig, DedupeProgress, DatabaseMetadata } from './types';

// Mock polling interval in ms (in a real implementation this would call an actual backend API)
const POLLING_INTERVAL = 1500;

// Function to get database metadata (tables and views)
export const getDatabaseMetadata = async (
  dbType: DatabaseType,
  config: MySQLConfig | MSSQLConfig
): Promise<DatabaseMetadata> => {
  // In a real application, this would make actual database connections
  // For now, let's simulate a more dynamic response based on the provided config
  
  console.log(`Fetching metadata for ${dbType} database:`, config);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate tables and views based on the database name
  // In a real implementation, this would query the database's system tables
  const databaseName = dbType === 'mysql' ? (config as MySQLConfig).database : (config as MSSQLConfig).database;
  
  const tables = [
    `${databaseName}_customers`,
    `${databaseName}_orders`,
    `${databaseName}_products`,
    `${databaseName}_inventory`,
    `${databaseName}_users`
  ];
  
  const views = [
    `vw_${databaseName}_customer_orders`,
    `vw_${databaseName}_inventory_status`,
    `vw_${databaseName}_sales_summary`
  ];
  
  // Log for debugging
  console.log("Returning tables:", tables);
  console.log("Returning views:", views);
  
  return {
    tables,
    views
  };
};

// Function to load data from a database
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

  // Generate data that reflects the requested table or query
  const mockData = generateDynamicMockData(query, dbType, config, 1000);

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

// Enhanced mock data generator that considers the database type, config, and query/table name
const generateDynamicMockData = (
  tableOrQuery: string, 
  dbType: DatabaseType, 
  config: MySQLConfig | MSSQLConfig, 
  count: number
): any[] => {
  const data = [];
  
  // Determine columns based on the table name or query
  const columnsMap: Record<string, string[]> = {
    // Tables containing "customer" will have customer-related fields
    customer: ['id', 'customer_name', 'company_name', 'email', 'phone', 'address', 'city', 'country', 'postcode', 'created_date'],
    
    // Tables containing "order" will have order-related fields
    order: ['id', 'order_id', 'customer_id', 'order_date', 'total_amount', 'status', 'payment_method'],
    
    // Tables containing "product" will have product-related fields
    product: ['id', 'product_name', 'sku', 'category', 'price', 'cost', 'stock_quantity', 'supplier_id'],
    
    // Tables containing "inventory" will have inventory-related fields
    inventory: ['id', 'product_id', 'warehouse_id', 'quantity', 'last_checked', 'minimum_level'],
    
    // User-related fields
    user: ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'last_login', 'is_active']
  };
  
  // Default columns if no specific table type is matched
  let columns = ['id', 'name', 'description', 'created_at', 'updated_at'];
  
  // Determine which columns to use based on the table/query name
  for (const key in columnsMap) {
    if (tableOrQuery.toLowerCase().includes(key)) {
      columns = columnsMap[key];
      break;
    }
  }
  
  // If the query is a SQL statement, try to extract table name
  if (!isTableName(tableOrQuery)) {
    const tableMatch = tableOrQuery.match(/from\s+(\w+)/i);
    if (tableMatch && tableMatch[1]) {
      const extractedTable = tableMatch[1].toLowerCase();
      for (const key in columnsMap) {
        if (extractedTable.includes(key)) {
          columns = columnsMap[key];
          break;
        }
      }
    }
  }
  
  // Generate mock data rows
  for (let i = 0; i < count; i++) {
    const row: Record<string, any> = {};
    
    // Generate values for each column
    columns.forEach(column => {
      if (column === 'id' || column.endsWith('_id')) {
        row[column] = i + 1;
      } else if (column.includes('name')) {
        row[column] = column.includes('company') 
          ? `Company ${String.fromCharCode(65 + (i % 26))}${i}`
          : column.includes('product') 
            ? `Product ${String.fromCharCode(65 + (i % 26))}${i}`
            : `Name ${String.fromCharCode(65 + (i % 26))}${i}`;
      } else if (column.includes('date') || column.includes('created') || column.includes('updated') || column.includes('login')) {
        const date = new Date();
        date.setDate(date.getDate() - (i % 30));
        row[column] = date.toISOString().split('T')[0];
      } else if (column.includes('email')) {
        row[column] = `user${i}@example.com`;
      } else if (column.includes('price') || column.includes('cost') || column.includes('amount')) {
        row[column] = (Math.random() * 100 + 10).toFixed(2);
      } else if (column.includes('quantity') || column.includes('stock')) {
        row[column] = Math.floor(Math.random() * 100);
      } else if (column.includes('phone')) {
        row[column] = `+44 ${Math.floor(Math.random() * 1000).toString().padStart(3, '0')} ${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
      } else if (column.includes('address')) {
        row[column] = `${i + 100} Main Street`;
      } else if (column.includes('city')) {
        const cities = ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow'];
        row[column] = cities[i % cities.length];
      } else if (column.includes('country')) {
        row[column] = 'United Kingdom';
      } else if (column.includes('postcode')) {
        row[column] = `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 1) % 26))}${i % 10}${i % 10} ${i % 10}${String.fromCharCode(65 + ((i + 2) % 26))}${String.fromCharCode(65 + ((i + 3) % 26))}`;
      } else if (column.includes('status')) {
        const statuses = ['Pending', 'Processing', 'Completed', 'Cancelled', 'Refunded'];
        row[column] = statuses[i % statuses.length];
      } else if (column.includes('active')) {
        row[column] = i % 5 !== 0; // 80% are active
      } else if (column.includes('role')) {
        const roles = ['User', 'Admin', 'Manager', 'Guest'];
        row[column] = roles[i % roles.length];
      } else if (column.includes('payment')) {
        const methods = ['Credit Card', 'PayPal', 'Bank Transfer', 'Cash'];
        row[column] = methods[i % methods.length];
      } else {
        row[column] = `Value ${i} for ${column}`;
      }
    });
    
    data.push(row);
  }
  
  return data;
};

// Helper function to check if a string is likely a table name vs a SQL query
function isTableName(str: string): boolean {
  // Simple heuristic: if it contains SQL keywords like SELECT, FROM, etc., it's probably a query
  const sqlKeywords = ['select', 'from', 'where', 'join', 'group by', 'order by', 'having'];
  const lowerStr = str.toLowerCase();
  
  return !sqlKeywords.some(keyword => lowerStr.includes(keyword));
}

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
