
import { DatabaseType, MySQLConfig, MSSQLConfig, DedupeProgress, DatabaseMetadata, DatabaseLoadRequest } from './types';
import { getMSSQLMetadata, loadMSSQLData } from './database/mssqlService';
import { getMySQLMetadata, loadMySQLData } from './database/mysqlService';
import { pollDedupeStatus } from './database/progressService';

// Function to get database metadata (tables and views)
export const getDatabaseMetadata = async (
  dbType: DatabaseType,
  config: MySQLConfig | MSSQLConfig
): Promise<DatabaseMetadata> => {
  console.log(`Fetching metadata for ${dbType} database:`, 
    { ...config, password: config.password ? '***HIDDEN***' : undefined });

  if (dbType === 'mssql') {
    return await getMSSQLMetadata(config as MSSQLConfig);
  } else if (dbType === 'mysql') {
    return await getMySQLMetadata(config as MySQLConfig);
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
      data = await loadMSSQLData(config as MSSQLConfig, query, isTable, onProgressUpdate);
    } 
    else if (dbType === 'mysql') {
      data = await loadMySQLData(config as MySQLConfig, query, isTable, onProgressUpdate);
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

// Re-export the polling function
export { pollDedupeStatus };
