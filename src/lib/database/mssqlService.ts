
import { MSSQLConfig, DedupeProgress, DatabaseMetadata } from '../types';

// Function to create a connection pool for SQL Server
export const createMSSQLPool = async (config: MSSQLConfig) => {
  const { server, port, user, password, database, options } = config;
  
  try {
    // Dynamically import mssql to avoid issues with SSR/browser environments
    const sql = await import('mssql');
    
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
    
    return await new sql.ConnectionPool(poolConfig).connect();
  } catch (error) {
    console.error('Error creating MSSQL connection pool:', error);
    throw new Error(`Failed to create MSSQL connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Function to get database metadata from SQL Server
export const getMSSQLMetadata = async (config: MSSQLConfig): Promise<DatabaseMetadata> => {
  try {
    // Get database metadata for SQL Server
    const sql = await import('mssql');
    
    // Create a connection to SQL Server
    const pool = await createMSSQLPool(config);
    
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
};

// Function to load data from a SQL Server database
export const loadMSSQLData = async (
  config: MSSQLConfig,
  query: string,
  isTable: boolean,
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<any[]> => {
  try {
    // MSSQL Implementation
    const sql = await import('mssql');
    
    const pool = await createMSSQLPool(config);
    
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
    const data = result.recordset;
    
    // Close the connection pool
    await pool.close();
    
    return data;
  } catch (error) {
    console.error('Error loading SQL Server data:', error);
    throw error;
  }
};
