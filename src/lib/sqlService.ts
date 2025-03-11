
import { DatabaseLoadRequest, DatabaseType, MySQLConfig, MSSQLConfig, DedupeProgress, DatabaseMetadata } from './types';
import { toast } from 'sonner';

// Function to create a connection pool for SQL Server
const createMSSQLPool = async (config: MSSQLConfig) => {
  const { server, port, user, password, database, options } = config;
  
  try {
    // Dynamically import mssql to avoid issues with SSR/browser environments
    const mssql = await import('mssql');
    
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
  } catch (error) {
    console.error('Error creating MSSQL connection pool:', error);
    throw new Error(`Failed to create MSSQL connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
      // Dynamically import mssql
      const mssql = await import('mssql');
      
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
      // Dynamically import mysql2
      const mysql = await import('mysql2/promise');
      
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
      // Dynamically import mssql
      const mssql = await import('mssql');
      
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
      // Dynamically import mysql2
      const mysql = await import('mysql2/promise');
      
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

// Real implementation for polling the deduplication status
export const pollDedupeStatus = async (
  jobId: string, 
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<void> => {
  // In a real implementation, this would call an API endpoint to get the current status
  // For now, we'll set up a realistic progress simulation
  let isCompleted = false;
  let progress = 0;
  
  while (!isCompleted) {
    try {
      // This would be a real API call in production
      // const response = await fetch(`/api/dedupe/status/${jobId}`);
      // const data = await response.json();
      
      // Simulate progress for now, this would be replaced with real API data
      progress += Math.random() * 10;
      
      if (progress < 30) {
        onProgressUpdate({
          status: 'processing',
          percentage: progress,
          statusMessage: 'Processing data and creating comparison vectors...',
          recordsProcessed: Math.floor(progress * 100),
          totalRecords: 10000
        });
      } else if (progress < 60) {
        onProgressUpdate({
          status: 'blocked',
          percentage: progress,
          statusMessage: 'Applying blocking rules and optimizing comparisons...',
          recordsProcessed: Math.floor(progress * 100),
          totalRecords: 10000
        });
      } else if (progress < 90) {
        onProgressUpdate({
          status: 'clustering',
          percentage: progress,
          statusMessage: 'Clustering similar records and identifying duplicates...',
          recordsProcessed: Math.floor(progress * 100),
          totalRecords: 10000,
          estimatedTimeRemaining: `${Math.ceil((100 - progress) / 10)} seconds`
        });
      } else if (progress >= 100) {
        onProgressUpdate({
          status: 'completed',
          percentage: 100,
          statusMessage: 'Deduplication completed successfully.',
          recordsProcessed: 10000,
          totalRecords: 10000
        });
        isCompleted = true;
      }
      
      // Wait before polling again (only if not completed)
      if (!isCompleted) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Error polling dedupe status:', error);
      
      onProgressUpdate({
        status: 'failed',
        percentage: 0,
        statusMessage: `Failed to get dedupe status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      isCompleted = true;
    }
  }
};
