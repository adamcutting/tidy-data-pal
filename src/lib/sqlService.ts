import { DatabaseLoadRequest, DatabaseType, MySQLConfig, MSSQLConfig, DedupeProgress, DatabaseMetadata } from './types';
import { toast } from 'sonner';
import * as mssql from 'mssql';
import * as mysql from 'mysql2/promise';

// Mock polling interval in ms (in a real implementation this would call an actual backend API)
const POLLING_INTERVAL = 1500;

// Function to create a connection pool for SQL Server
const createMSSQLPool = async (config: MSSQLConfig) => {
  const { server, port, user, password, database, options } = config;
  
  const poolConfig = {
    server,
    port,
    user,
    password,
    database,
    options: {
      encrypt: options?.encrypt ?? true,
      trustServerCertificate: options?.trustServerCertificate ?? false,
      ...options
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  console.log('Creating MSSQL connection pool with config:', 
    { ...poolConfig, password: password ? '***HIDDEN***' : undefined });
  
  return await new mssql.ConnectionPool(poolConfig).connect();
};

// Function to get database metadata (tables and views)
export const getDatabaseMetadata = async (
  dbType: DatabaseType,
  config: MySQLConfig | MSSQLConfig
): Promise<DatabaseMetadata> => {
  console.log(`Fetching metadata for ${dbType} database:`, 
    { ...config, password: config.password ? '***HIDDEN***' : undefined });

  if (dbType === 'mssql') {
    try {
      // Create a connection to SQL Server
      const pool = await createMSSQLPool(config as MSSQLConfig);
      
      console.log("Connected to SQL Server, now fetching tables and views...");
      
      // Query to get all user tables
      const tablesResult = await pool.request().query(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'
        ORDER BY TABLE_NAME
      `);
      
      // Query to get all views
      const viewsResult = await pool.request().query(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.VIEWS
        WHERE TABLE_SCHEMA = 'dbo'
        ORDER BY TABLE_NAME
      `);
      
      // Process results
      const tables = tablesResult.recordset.map((row: any) => row.TABLE_NAME);
      const views = viewsResult.recordset.map((row: any) => row.TABLE_NAME);
      
      console.log("Fetched tables:", tables);
      console.log("Fetched views:", views);
      
      // Close the connection pool
      await pool.close();
      
      return { tables, views };
    } catch (error) {
      console.error('Error fetching SQL Server metadata:', error);
      throw new Error(`Failed to fetch database metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else if (dbType === 'mysql') {
    try {
      const { host, port, user, password, database } = config as MySQLConfig;
      
      console.log("Connecting to MySQL...");
      
      // Create MySQL connection
      const connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database
      });
      
      console.log("Connected to MySQL, now fetching tables and views...");
      
      // Query to get tables
      const [tablesRows] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `, [database]);
      
      // Query to get views
      const [viewsRows] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.VIEWS 
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME
      `, [database]);
      
      // Process results
      const tables = (tablesRows as any[]).map(row => row.TABLE_NAME);
      const views = (viewsRows as any[]).map(row => row.TABLE_NAME);
      
      console.log("Fetched MySQL tables:", tables);
      console.log("Fetched MySQL views:", views);
      
      // Close the connection
      await connection.end();
      
      return { tables, views };
    } catch (error) {
      console.error('Error fetching MySQL metadata:', error);
      throw new Error(`Failed to fetch MySQL database metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    throw new Error(`Unsupported database type: ${dbType}`);
  }
};

// Function to load data from a database
export const loadDatabaseData = async (
  dbType: DatabaseType,
  config: MySQLConfig | MSSQLConfig,
  query: string,
  isTable: boolean,
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<any[]> => {
  console.log(`Loading data from ${dbType} database:`, 
    { ...config, password: config.password ? '***HIDDEN***' : undefined });
  console.log(`Query/Table: ${query}, isTable: ${isTable}`);
  
  // Set initial progress state
  onProgressUpdate({
    status: 'connecting',
    percentage: 10,
    statusMessage: `Connecting to ${dbType} database...`,
  });

  try {
    let data: any[] = [];
    
    if (dbType === 'mssql') {
      // MSSQL Implementation
      const pool = await createMSSQLPool(config as MSSQLConfig);
      
      onProgressUpdate({
        status: 'loading',
        percentage: 30,
        statusMessage: isTable ? 
          `Loading data from table "${query}"...` : 
          'Executing query and loading results...',
      });
      
      // Execute query or select from table
      const sqlQuery = isTable ? `SELECT * FROM [${query}]` : query;
      const result = await pool.request().query(sqlQuery);
      
      // Get result data
      data = result.recordset;
      
      // Close the connection pool
      await pool.close();
    } 
    else if (dbType === 'mysql') {
      // MySQL Implementation
      const { host, port, user, password, database } = config as MySQLConfig;
      
      // Create MySQL connection
      const connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database
      });
      
      onProgressUpdate({
        status: 'loading',
        percentage: 30,
        statusMessage: isTable ? 
          `Loading data from table "${query}"...` : 
          'Executing query and loading results...',
      });
      
      // Execute query or select from table
      const sqlQuery = isTable ? `SELECT * FROM \`${query}\`` : query;
      const [rows] = await connection.execute(sqlQuery);
      
      // Get result data
      data = rows as any[];
      
      // Close the connection
      await connection.end();
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

// Remove the mock data polling function and replace with real implementation
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
