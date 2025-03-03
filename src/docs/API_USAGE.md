
# Data HQ Dedupe API Usage Guide

This guide explains how to use the Data HQ Dedupe API for automating deduplication workflows and connecting to databases (MySQL and Microsoft SQL Server).

## Overview

The Data HQ Dedupe API allows you to:

1. Load data directly from MySQL or Microsoft SQL Server databases
2. Run automated deduplication using saved configurations
3. Store and retrieve deduplication results

## Prerequisites

Before using the API, you need to:

1. Set up and run the Data HQ Dedupe backend server
2. Create and save deduplication configurations through the UI

> **Note:** For detailed instructions on deploying on Windows Server with IIS, see the [Windows Deployment Guide](./WINDOWS_DEPLOYMENT.md).

## API Examples

### Loading Data from MySQL

```javascript
// Example using fetch API
const loadMySQLData = async () => {
  const response = await fetch('http://localhost:5000/api/database/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      databaseType: 'mysql',
      connectionConfig: {
        host: 'localhost',
        port: 3306,
        user: 'username',
        password: 'password',
        database: 'customers_db'
      },
      query: 'SELECT * FROM customers',
      isTable: false
    })
  });
  
  const data = await response.json();
  console.log(`Loaded ${data.rows.length} records from MySQL`);
  return data.rows;
};
```

### Loading Data from Microsoft SQL Server

```javascript
// Example using fetch API
const loadMSSQLData = async () => {
  const response = await fetch('http://localhost:5000/api/database/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      databaseType: 'mssql',
      connectionConfig: {
        server: 'localhost',
        port: 1433,
        user: 'username',
        password: 'password',
        database: 'customers_db',
        options: {
          encrypt: true,
          trustServerCertificate: true
        }
      },
      query: 'SELECT * FROM customers',
      isTable: false
    })
  });
  
  const data = await response.json();
  console.log(`Loaded ${data.rows.length} records from MSSQL`);
  return data.rows;
};
```

### Running Automated Deduplication

```javascript
// Example using fetch API
const runDedupe = async (data, configId) => {
  const response = await fetch('http://localhost:5000/api/dedupe/automated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: data,
      configId: configId,
      resultLocation: '/path/to/results'
    })
  });
  
  const result = await response.json();
  console.log(`Deduplication completed. Found ${result.stats.duplicateRows} duplicates`);
  return result;
};
```

### Retrieving Results

```javascript
// Example using fetch API
const getResults = async (resultId) => {
  const response = await fetch(`http://localhost:5000/api/dedupe/results/${resultId}`);
  const results = await response.json();
  return results;
};
```

## Implementing a Backend Workflow

Here's an example of how to set up a complete workflow:

1. **Create a scheduled task** that:
   - Connects to your database (MySQL or MSSQL)
   - Runs a specific query
   - Passes the data to the deduplication service
   - Saves the results
   - Logs the outcome

```javascript
const runScheduledDedupe = async () => {
  try {
    // 1. Load data from database (MSSQL in this example)
    const data = await loadMSSQLData();
    
    // 2. Run deduplication with saved config
    const dedupeResult = await runDedupe(data, 'your_config_id');
    
    // 3. Process the results (e.g., update your database)
    console.log(`Results saved to: ${dedupeResult.resultLocation}`);
    
    return dedupeResult;
  } catch (error) {
    console.error('Scheduled deduplication failed:', error);
  }
};
```

## Server-Side Implementation

To fully support these API features, you'll need to implement a backend server that can:

1. Connect to MySQL and/or MSSQL databases
2. Process deduplication requests
3. Store and manage results

Recommended technologies:
- Node.js + Express for the API server
- MySQL and MSSQL client libraries for database connections
- File system access for storing results

See the API specification documentation for detailed endpoint requirements.

## Windows Server Deployment

For detailed instructions on implementing the API on a Windows Server environment with IIS, please refer to our [Windows Deployment Guide](./WINDOWS_DEPLOYMENT.md).
