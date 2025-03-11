import { DatabaseLoadRequest, DatabaseType, MySQLConfig, MSSQLConfig, DedupeProgress, DatabaseMetadata } from './types';
import { toast } from 'sonner';

// Polling interval in ms for checking job status
const POLLING_INTERVAL = 1500;

/**
 * Function to get database metadata (tables and views) from a database
 * This is a browser-compatible implementation
 */
export const getDatabaseMetadata = async (
  dbType: DatabaseType,
  config: MySQLConfig | MSSQLConfig
): Promise<DatabaseMetadata> => {
  console.log(`Fetching metadata for ${dbType} database:`, config);
  
  // In a browser environment, we'll use a mock implementation
  // In a real app, this would be a call to a backend API
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Log the connection attempt
    console.log(`Connected to ${dbType} database successfully (simulated)`);
    
    // Return mock data based on the database name to simulate real tables
    const dbName = dbType === 'mssql' 
      ? (config as MSSQLConfig).database 
      : (config as MySQLConfig).database;
    
    // Generate tables based on database name to make it seem realistic
    let tables: string[] = [];
    let views: string[] = [];
    
    // Common tables for any database
    tables = [
      'Customers', 
      'Orders', 
      'Products', 
      'Employees', 
      'Suppliers',
      'Categories',
      'Inventory',
      'Sales',
      'Transactions',
      'Users'
    ];
    
    // Common views
    views = [
      'CustomerOrders',
      'ProductInventory',
      'SalesSummary',
      'EmployeePerformance',
      'ActiveUsers'
    ];
    
    // Make it appear dynamic based on the database name
    if (dbName.toLowerCase().includes('sales')) {
      tables = [...tables, 'SalesRegions', 'SalesTargets', 'Commissions'];
      views = [...views, 'QuarterlySales', 'TopPerformers', 'RegionalPerformance'];
    } 
    else if (dbName.toLowerCase().includes('crm')) {
      tables = [...tables, 'Contacts', 'Leads', 'Opportunities', 'Activities'];
      views = [...views, 'LeadConversion', 'SalesOpportunities', 'CustomerInteractions'];
    }
    else if (dbName.toLowerCase().includes('hr')) {
      tables = [...tables, 'Departments', 'Positions', 'Salaries', 'Benefits', 'TimeOff'];
      views = [...views, 'EmployeeDirectory', 'DepartmentBudgets', 'VacationCalendar'];
    }
    
    console.log("Returning tables:", tables);
    console.log("Returning views:", views);
    
    return { tables, views };
  } catch (error) {
    console.error('Error fetching database metadata:', error);
    throw error;
  }
};

/**
 * Function to load data from a database
 * This is a browser-compatible implementation
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
    // Simulate a database connection
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    onProgressUpdate({
      status: 'loading',
      percentage: 30,
      statusMessage: isTable ? 
        `Loading data from table "${query}"...` : 
        'Executing query and loading results...',
    });
    
    // Generate sample data based on table name or query
    let data: any[] = [];
    const recordCount = Math.floor(Math.random() * 100) + 20; // Generate 20-120 records
    
    if (isTable) {
      // Generate data based on table name
      if (query.toLowerCase().includes('customer')) {
        data = generateCustomerData(recordCount);
      } else if (query.toLowerCase().includes('order')) {
        data = generateOrderData(recordCount);
      } else if (query.toLowerCase().includes('product')) {
        data = generateProductData(recordCount);
      } else if (query.toLowerCase().includes('employee')) {
        data = generateEmployeeData(recordCount);
      } else if (query.toLowerCase().includes('sales')) {
        data = generateSalesData(recordCount);
      } else {
        // Generic data for any other table
        data = generateGenericData(query, recordCount);
      }
    } else {
      // For SQL queries, generate generic data
      data = generateGenericData('QueryResult', recordCount);
    }
    
    // Simulate loading time based on record count
    await new Promise(resolve => setTimeout(resolve, Math.min(data.length * 10, 2000)));
    
    console.log(`Loaded ${data.length} rows from database (simulated)`);
    
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
    console.error('Error loading database data:', error);
    
    onProgressUpdate({
      status: 'failed',
      percentage: 0,
      statusMessage: `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
};

// Helper functions to generate mock data
const generateCustomerData = (count: number): any[] => {
  const data = [];
  const countries = ['USA', 'UK', 'Canada', 'Germany', 'France', 'Australia', 'Japan'];
  
  for (let i = 0; i < count; i++) {
    data.push({
      CustomerID: `CUST${1000 + i}`,
      CompanyName: `Company ${i}`,
      ContactName: `Contact ${i}`,
      ContactTitle: ['Owner', 'Manager', 'Assistant', 'Representative'][Math.floor(Math.random() * 4)],
      Address: `${1000 + i} Main St`,
      City: ['New York', 'London', 'Toronto', 'Berlin', 'Paris'][Math.floor(Math.random() * 5)],
      Region: ['North', 'South', 'East', 'West'][Math.floor(Math.random() * 4)],
      PostalCode: `${10000 + Math.floor(Math.random() * 90000)}`,
      Country: countries[Math.floor(Math.random() * countries.length)],
      Phone: `(555) ${100 + Math.floor(Math.random() * 900)}-${1000 + Math.floor(Math.random() * 9000)}`,
      EmailAddress: `contact${i}@company${i}.com`
    });
  }
  return data;
};

const generateOrderData = (count: number): any[] => {
  const data = [];
  const statuses = ['New', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  
  for (let i = 0; i < count; i++) {
    const orderDate = new Date(Date.now() - Math.random() * 31536000000); // Random date within last year
    
    data.push({
      OrderID: `ORD${10000 + i}`,
      CustomerID: `CUST${1000 + Math.floor(Math.random() * 100)}`,
      OrderDate: orderDate.toISOString().split('T')[0],
      RequiredDate: new Date(orderDate.getTime() + 1209600000).toISOString().split('T')[0], // OrderDate + 14 days
      ShippedDate: Math.random() > 0.2 ? new Date(orderDate.getTime() + 172800000).toISOString().split('T')[0] : null, // OrderDate + 2 days, or null (20% chance)
      Status: statuses[Math.floor(Math.random() * statuses.length)],
      ShipVia: ['Fedex', 'UPS', 'DHL', 'USPS'][Math.floor(Math.random() * 4)],
      Freight: parseFloat((Math.random() * 100).toFixed(2)),
      TotalAmount: parseFloat((Math.random() * 1000 + 50).toFixed(2))
    });
  }
  return data;
};

const generateProductData = (count: number): any[] => {
  const data = [];
  const categories = ['Electronics', 'Clothing', 'Food', 'Furniture', 'Books'];
  
  for (let i = 0; i < count; i++) {
    data.push({
      ProductID: `PROD${10000 + i}`,
      ProductName: `Product ${i}`,
      SupplierID: `SUPP${100 + Math.floor(Math.random() * 20)}`,
      CategoryID: Math.floor(Math.random() * 5) + 1,
      CategoryName: categories[Math.floor(Math.random() * categories.length)],
      QuantityPerUnit: `${Math.floor(Math.random() * 10) + 1} units`,
      UnitPrice: parseFloat((Math.random() * 100 + 5).toFixed(2)),
      UnitsInStock: Math.floor(Math.random() * 100),
      UnitsOnOrder: Math.floor(Math.random() * 20),
      ReorderLevel: Math.floor(Math.random() * 10) + 5,
      Discontinued: Math.random() > 0.9 // 10% chance of being discontinued
    });
  }
  return data;
};

const generateEmployeeData = (count: number): any[] => {
  const data = [];
  const titles = ['Sales Representative', 'Sales Manager', 'Marketing Specialist', 'CEO', 'CTO', 'CFO', 'HR Manager'];
  
  for (let i = 0; i < count; i++) {
    const hireDate = new Date(Date.now() - Math.random() * 157680000000); // Random date within last 5 years
    
    data.push({
      EmployeeID: `EMP${1000 + i}`,
      FirstName: `First${i}`,
      LastName: `Last${i}`,
      Title: titles[Math.floor(Math.random() * titles.length)],
      BirthDate: new Date(Date.now() - Math.random() * 1576800000000 - 662256000000).toISOString().split('T')[0], // 21-50 years ago
      HireDate: hireDate.toISOString().split('T')[0],
      Address: `${1000 + i} Main St`,
      City: ['New York', 'London', 'Toronto', 'Berlin', 'Paris'][Math.floor(Math.random() * 5)],
      Region: ['North', 'South', 'East', 'West'][Math.floor(Math.random() * 4)],
      PostalCode: `${10000 + Math.floor(Math.random() * 90000)}`,
      Country: ['USA', 'UK', 'Canada', 'Germany', 'France'][Math.floor(Math.random() * 5)],
      HomePhone: `(555) ${100 + Math.floor(Math.random() * 900)}-${1000 + Math.floor(Math.random() * 9000)}`,
      Salary: Math.floor(Math.random() * 50000) + 30000
    });
  }
  return data;
};

const generateSalesData = (count: number): any[] => {
  const data = [];
  
  for (let i = 0; i < count; i++) {
    const saleDate = new Date(Date.now() - Math.random() * 31536000000); // Random date within last year
    
    data.push({
      SaleID: `SALE${10000 + i}`,
      ProductID: `PROD${10000 + Math.floor(Math.random() * 100)}`,
      CustomerID: `CUST${1000 + Math.floor(Math.random() * 100)}`,
      EmployeeID: `EMP${1000 + Math.floor(Math.random() * 20)}`,
      SaleDate: saleDate.toISOString().split('T')[0],
      Quantity: Math.floor(Math.random() * 10) + 1,
      UnitPrice: parseFloat((Math.random() * 100 + 5).toFixed(2)),
      Discount: parseFloat((Math.random() * 0.2).toFixed(2)), // 0-20% discount
      TotalAmount: parseFloat((Math.random() * 1000 + 50).toFixed(2))
    });
  }
  return data;
};

const generateGenericData = (tableName: string, count: number): any[] => {
  const data = [];
  
  // Create field names based on the table name
  const fields = ['ID', 'Name', 'Description', 'CreatedDate', 'ModifiedDate', 'IsActive'];
  
  // Add some table-specific fields
  if (tableName.toLowerCase().includes('user')) {
    fields.push('Username', 'Email', 'LastLogin');
  } else if (tableName.toLowerCase().includes('transaction')) {
    fields.push('Amount', 'Currency', 'Status');
  } else if (tableName.toLowerCase().includes('inventory')) {
    fields.push('SKU', 'Quantity', 'Location');
  }
  
  for (let i = 0; i < count; i++) {
    const item: Record<string, any> = {};
    
    // Add values for each field
    fields.forEach(field => {
      if (field === 'ID') {
        item[field] = `${tableName.charAt(0)}${1000 + i}`;
      } else if (field === 'Name') {
        item[field] = `${tableName} ${i}`;
      } else if (field === 'Description') {
        item[field] = `This is a sample ${tableName.toLowerCase()} record.`;
      } else if (field === 'CreatedDate' || field === 'ModifiedDate') {
        const date = new Date(Date.now() - Math.random() * 31536000000);
        item[field] = date.toISOString().split('T')[0];
      } else if (field === 'IsActive') {
        item[field] = Math.random() > 0.1; // 90% chance of being active
      } else if (field === 'Username') {
        item[field] = `user${i}`;
      } else if (field === 'Email') {
        item[field] = `user${i}@example.com`;
      } else if (field === 'LastLogin') {
        const date = new Date(Date.now() - Math.random() * 2592000000);
        item[field] = date.toISOString();
      } else if (field === 'Amount') {
        item[field] = parseFloat((Math.random() * 1000 + 10).toFixed(2));
      } else if (field === 'Currency') {
        item[field] = ['USD', 'EUR', 'GBP', 'JPY'][Math.floor(Math.random() * 4)];
      } else if (field === 'Status') {
        item[field] = ['Pending', 'Completed', 'Failed', 'Refunded'][Math.floor(Math.random() * 4)];
      } else if (field === 'SKU') {
        item[field] = `SKU-${10000 + i}`;
      } else if (field === 'Quantity') {
        item[field] = Math.floor(Math.random() * 100) + 1;
      } else if (field === 'Location') {
        item[field] = ['Warehouse A', 'Warehouse B', 'Store 1', 'Store 2'][Math.floor(Math.random() * 4)];
      }
    });
    
    data.push(item);
  }
  
  return data;
};

// Polling function to check dedupe status (keeping this for backward compatibility)
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
