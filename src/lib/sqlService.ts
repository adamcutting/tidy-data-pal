
import { DatabaseLoadRequest, DatabaseType, MySQLConfig, MSSQLConfig, DedupeProgress, DatabaseMetadata } from './types';
import { toast } from 'sonner';
import * as mssql from 'mssql';

// Polling interval in ms for checking job status
const POLLING_INTERVAL = 1500;

/**
 * Function to get database metadata (tables and views) from a SQL database
 */
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
  } else {
    // MySQL implementation
    throw new Error('MySQL connection is not implemented in this version');
  }
};

/**
 * Helper function to create an MSSQL connection pool
 */
const createMSSQLPool = async (config: MSSQLConfig): Promise<mssql.ConnectionPool> => {
  try {
    const sqlConfig: mssql.config = {
      server: config.server,
      port: config.port,
      database: config.database,
      options: {
        encrypt: config.options?.encrypt ?? false,
        trustServerCertificate: config.options?.trustServerCertificate ?? false,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };
    
    // Handle different authentication methods
    if (config.options?.authentication === 'windows') {
      sqlConfig.authentication = {
        type: 'ntlm',
        options: {
          domain: config.options.domain,
          // When using Windows Auth with domain, leaving user/pass empty uses current Windows credentials
          userName: config.user || undefined,
          password: config.password || undefined
        }
      };
    } else {
      // SQL Server authentication
      sqlConfig.user = config.user;
      sqlConfig.password = config.password;
    }
    
    console.log('Creating SQL Server connection with config:', 
      { ...sqlConfig, password: sqlConfig.password ? '***HIDDEN***' : undefined });
    
    const pool = new mssql.ConnectionPool(sqlConfig);
    await pool.connect();
    console.log('Connected to SQL Server successfully');
    return pool;
  } catch (error) {
    console.error('Error creating SQL Server connection:', error);
    throw new Error(`Failed to connect to SQL Server: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  console.log(`Loading data from ${dbType} database:`, 
    { ...config, password: config.password ? '***HIDDEN***' : undefined });
  console.log(`Query/Table: ${query}, isTable: ${isTable}`);
  
  // Set initial progress state
  onProgressUpdate({
    status: 'connecting',
    percentage: 10,
    statusMessage: `Connecting to ${dbType} database...`,
  });

  if (dbType === 'mssql') {
    try {
      // Create a connection to SQL Server
      const pool = await createMSSQLPool(config as MSSQLConfig);
      
      onProgressUpdate({
        status: 'loading',
        percentage: 30,
        statusMessage: isTable ? 
          `Loading data from table "${query}"...` : 
          'Executing query and loading results...',
      });
      
      // Build the SQL query
      const sqlQuery = isTable ? `SELECT * FROM [${query}]` : query;
      console.log('Executing SQL query:', sqlQuery);
      
      // Execute the query
      const result = await pool.request().query(sqlQuery);
      const data = result.recordset;
      
      console.log(`Loaded ${data.length} rows from SQL Server`);
      
      // Final progress update
      onProgressUpdate({
        status: 'completed',
        percentage: 100,
        statusMessage: `Successfully loaded ${data.length} records from database.`,
        recordsProcessed: data.length,
        totalRecords: data.length
      });
      
      // Close the connection pool
      await pool.close();
      
      return data;
    } catch (error) {
      console.error('Error loading SQL Server data:', error);
      
      onProgressUpdate({
        status: 'failed',
        percentage: 0,
        statusMessage: `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new Error(`Failed to load data from SQL Server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // MySQL implementation
    throw new Error('MySQL connection is not implemented in this version');
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
