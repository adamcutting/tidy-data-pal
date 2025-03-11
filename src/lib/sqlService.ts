import { DatabaseLoadRequest, DatabaseType, MySQLConfig, MSSQLConfig, DedupeProgress, DatabaseMetadata } from './types';
import * as mssql from 'mssql';
import { toast } from 'sonner';

// Polling interval in ms for checking job status
const POLLING_INTERVAL = 1500;

/**
 * Function to get database metadata (tables and views) from a real database
 */
export const getDatabaseMetadata = async (
  dbType: DatabaseType,
  config: MySQLConfig | MSSQLConfig
): Promise<DatabaseMetadata> => {
  console.log(`Fetching metadata for ${dbType} database:`, config);
  
  if (dbType === 'mssql') {
    return getMSSQLMetadata(config as MSSQLConfig);
  } else {
    // For future implementation
    console.error('MySQL connection not yet implemented');
    throw new Error('MySQL connection not yet implemented');
  }
};

/**
 * Get metadata (tables and views) from a SQL Server database
 */
const getMSSQLMetadata = async (config: MSSQLConfig): Promise<DatabaseMetadata> => {
  let pool: mssql.ConnectionPool | null = null;
  
  try {
    // Create connection configuration
    const sqlConfig: mssql.config = {
      user: config.user,
      password: config.password,
      server: config.server,
      port: config.port,
      database: config.database,
      options: {
        encrypt: config.options?.encrypt ?? true,
        trustServerCertificate: config.options?.trustServerCertificate ?? false,
      },
      authentication: config.options?.authentication as any,
      domain: config.options?.domain,
    };
    
    // Connect to database
    pool = await mssql.connect(sqlConfig);
    console.log('Connected to SQL Server database successfully');
    
    // Query for tables
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = '${config.database}'
      ORDER BY TABLE_NAME
    `);
    
    // Query for views
    const viewsResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.VIEWS 
      WHERE TABLE_CATALOG = '${config.database}'
      ORDER BY TABLE_NAME
    `);
    
    // Extract table and view names
    const tables = tablesResult.recordset.map((row: any) => row.TABLE_NAME);
    const views = viewsResult.recordset.map((row: any) => row.TABLE_NAME);
    
    console.log("Returning tables:", tables);
    console.log("Returning views:", views);
    
    return { tables, views };
  } catch (error) {
    console.error('Error fetching database metadata:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
      console.log('Database connection closed');
    }
  }
};

/**
 * Function to load data from a real database
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

  if (dbType === 'mssql') {
    return loadMSSQLData(config as MSSQLConfig, query, isTable, onProgressUpdate);
  } else {
    // For future implementation
    console.error('MySQL connection not yet implemented');
    onProgressUpdate({
      status: 'failed',
      percentage: 0,
      statusMessage: 'MySQL connection not yet implemented',
      error: 'MySQL connection not yet implemented'
    });
    throw new Error('MySQL connection not yet implemented');
  }
};

/**
 * Load data from a SQL Server database
 */
const loadMSSQLData = async (
  config: MSSQLConfig,
  query: string,
  isTable: boolean,
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<any[]> => {
  let pool: mssql.ConnectionPool | null = null;
  
  try {
    // Create connection configuration
    const sqlConfig: mssql.config = {
      user: config.user,
      password: config.password,
      server: config.server,
      port: config.port,
      database: config.database,
      options: {
        encrypt: config.options?.encrypt ?? true,
        trustServerCertificate: config.options?.trustServerCertificate ?? false,
      },
      authentication: config.options?.authentication as any,
      domain: config.options?.domain,
    };
    
    // Connect to database
    pool = await mssql.connect(sqlConfig);
    console.log('Connected to SQL Server database successfully');
    
    onProgressUpdate({
      status: 'loading',
      percentage: 30,
      statusMessage: isTable ? 
        `Loading data from table "${query}"...` : 
        'Executing query and loading results...',
    });
    
    // Execute query (either from direct SQL or table name)
    const sql = isTable ? `SELECT * FROM ${query}` : query;
    const result = await pool.request().query(sql);
    
    console.log(`Loaded ${result.recordset.length} rows from database`);
    
    // Final progress update
    onProgressUpdate({
      status: 'completed',
      percentage: 100,
      statusMessage: `Successfully loaded ${result.recordset.length} records from database.`,
      recordsProcessed: result.recordset.length,
      totalRecords: result.recordset.length
    });
    
    return result.recordset;
  } catch (error) {
    console.error('Error loading database data:', error);
    
    onProgressUpdate({
      status: 'failed',
      percentage: 0,
      statusMessage: `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  } finally {
    if (pool) {
      await pool.close();
      console.log('Database connection closed');
    }
  }
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
