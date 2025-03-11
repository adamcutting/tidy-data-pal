
import { MySQLConfig, DedupeProgress, DatabaseMetadata } from '../types';

// Function to get database metadata from MySQL
export const getMySQLMetadata = async (config: MySQLConfig): Promise<DatabaseMetadata> => {
  try {
    // Get database metadata for MySQL
    const mysql = await import('mysql2/promise');
    
    const { host, port, user, password, database } = config;
    
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
};

// Function to load data from a MySQL database
export const loadMySQLData = async (
  config: MySQLConfig,
  query: string,
  isTable: boolean,
  onProgressUpdate: (progress: DedupeProgress) => void
): Promise<any[]> => {
  try {
    // MySQL Implementation
    const mysql = await import('mysql2/promise');
    
    const { host, port, user, password, database } = config;
    
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
    const data = rows as any[];
    
    // Close the connection
    await connection.end();
    
    return data;
  } catch (error) {
    console.error('Error loading MySQL data:', error);
    throw error;
  }
};
