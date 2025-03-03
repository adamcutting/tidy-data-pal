
# Data HQ Dedupe: Windows Server Deployment Guide

This guide provides instructions for deploying the Data HQ Dedupe application on a Windows Server using Internet Information Services (IIS).

## Prerequisites

Before deploying Data HQ Dedupe on a Windows Server, ensure the following components are installed:

1. **Windows Server** (2016, 2019, or 2022)
2. **Internet Information Services (IIS)** with the following features:
   - Web Server Role
   - Application Development Features
   - .NET Extensibility
   - ASP.NET
   - ISAPI Extensions and Filters
   - WebSocket Protocol

3. **Database Connectivity**:
   - For Microsoft SQL Server: SQL Server Native Client
   - For MySQL: MySQL Connector for Windows

4. **Node.js and npm**:
   - Install the latest LTS version of Node.js from [nodejs.org](https://nodejs.org/)
   - Ensure Node.js is added to your system PATH

5. **Required Windows Features**:
   - Microsoft .NET Framework 4.8 (or later)
   - URL Rewrite Module for IIS
   - ARR (Application Request Routing) for IIS

## Installation Steps

### 1. Install Required Windows Features

1. Open **Server Manager** and click **Add Roles and Features**
2. Select **Role-based or feature-based installation**
3. Select your server from the server pool
4. Check **Web Server (IIS)** under Server Roles
5. In the Features section, ensure **.NET Framework 4.8** is selected
6. Complete the wizard to install the selected features

### 2. Install Additional IIS Modules

Download and install:
- [URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite)
- [Application Request Routing](https://www.iis.net/downloads/microsoft/application-request-routing)

### 3. Deploy the Data HQ Dedupe Application

#### Option 1: Static Build Deployment

1. On your development machine, build the React application:
   ```bash
   npm run build
   ```

2. Copy the contents of the `dist` folder to a folder on your Windows Server (e.g., `C:\inetpub\wwwroot\datahq-dedupe`)

3. In IIS Manager:
   - Create a new website or application pointing to the folder containing the build files
   - Configure the website with appropriate bindings (hostname, IP, port)
   - Set up URL Rewrite rules for the SPA (see below)

#### Option 2: Node.js with IIS Reverse Proxy

1. Copy the entire application to your server
2. Install dependencies:
   ```bash
   npm install --production
   ```

3. Install `iisnode` module from [GitHub](https://github.com/Azure/iisnode/releases)

4. Create a `web.config` file in your application root:
   ```xml
   <configuration>
     <system.webServer>
       <handlers>
         <add name="iisnode" path="server.js" verb="*" modules="iisnode" />
       </handlers>
       <rewrite>
         <rules>
           <rule name="API">
             <match url="api/*" />
             <action type="Rewrite" url="server.js" />
           </rule>
           <rule name="StaticContent">
             <action type="Rewrite" url="dist{REQUEST_URI}" />
           </rule>
           <rule name="DynamicContent">
             <conditions>
               <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True" />
             </conditions>
             <action type="Rewrite" url="dist/index.html" />
           </rule>
         </rules>
       </rewrite>
     </system.webServer>
   </configuration>
   ```

5. Create a `server.js` file to handle your API endpoints

### 4. Configure URL Rewrite Rules for SPA

For static deployments, create a `web.config` file in your application root:

```xml
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="True" />
            <add input="{REQUEST_URI}" pattern="^/api" negate="True" />
          </conditions>
          <action type="Rewrite" url="index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

## Database Connectivity Setup

### Microsoft SQL Server

1. Ensure SQL Server Native Client is installed
2. Configure firewall rules to allow connections to SQL Server
3. Create a dedicated SQL Server user with appropriate permissions
4. In your server-side implementation, use the connection details from your configuration

### MySQL

1. Install MySQL Connector for Windows
2. Configure firewall rules to allow connections to MySQL Server
3. Create a dedicated MySQL user with appropriate permissions
4. In your server-side implementation, use the connection details from your configuration

## Implementing the Server-side API

To implement the Data HQ Dedupe API on Windows Server, you'll need:

1. **Create an Express.js application** that handles the API endpoints defined in our API specification
2. **Implement database connectors** for MySQL and MSSQL
3. **Set up file system storage** for deduplication results

### Example Server Implementation

```javascript
// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const mssql = require('mssql');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Database connection handler
const connectToDatabase = async (req, res, next) => {
  const { databaseType, connectionConfig } = req.body;
  
  try {
    if (databaseType === 'mysql') {
      const connection = await mysql.createConnection(connectionConfig);
      req.dbConnection = connection;
    } else if (databaseType === 'mssql') {
      const pool = await mssql.connect(connectionConfig);
      req.dbConnection = pool;
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported database type' });
    }
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ success: false, message: 'Failed to connect to database', error: error.message });
  }
};

// API endpoints
app.post('/api/database/load', connectToDatabase, async (req, res) => {
  const { dbConnection } = req;
  const { databaseType, query, isTable } = req.body;
  
  try {
    let rows, columns;
    
    if (databaseType === 'mysql') {
      // Handle MySQL query
      const actualQuery = isTable ? `SELECT * FROM ${query}` : query;
      const [results, fields] = await dbConnection.execute(actualQuery);
      rows = results;
      columns = fields.map(field => field.name);
      await dbConnection.end();
    } else if (databaseType === 'mssql') {
      // Handle MSSQL query
      const actualQuery = isTable ? `SELECT * FROM ${query}` : query;
      const result = await dbConnection.request().query(actualQuery);
      rows = result.recordset;
      columns = Object.keys(rows[0] || {});
      await dbConnection.close();
    }
    
    res.json({ success: true, rows, columns });
  } catch (error) {
    console.error('Query execution error:', error);
    res.status(500).json({ success: false, message: 'Failed to execute query', error: error.message });
  }
});

// Additional API endpoints for deduplication
// ...

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Security Considerations

1. **Authentication and Authorization**:
   - Implement Windows Authentication or custom authentication mechanisms
   - Configure IIS to use appropriate authentication methods
   - Set up HTTPS with a valid SSL certificate

2. **File System Security**:
   - Create a dedicated service account with minimal permissions
   - Restrict access to the application folders
   - Implement proper file system permissions for result storage

3. **Database Security**:
   - Use dedicated database accounts with minimal permissions
   - Store connection strings securely (consider using Windows Credential Manager)
   - Implement connection pooling for efficient resource usage

## Troubleshooting

### Common Issues and Solutions

1. **404 Errors for SPA Routes**:
   - Verify URL Rewrite rules in web.config
   - Ensure the URL Rewrite module is installed

2. **Database Connection Issues**:
   - Check firewall settings
   - Verify SQL Server or MySQL services are running
   - Test credentials manually using SQL Server Management Studio or MySQL Workbench

3. **API Endpoint Errors**:
   - Check IIS logs in `%SystemDrive%\inetpub\logs\LogFiles`
   - Enable detailed error messages during development
   - Check Windows Event Viewer for application errors

## Performance Optimization

1. **IIS Configuration**:
   - Enable compression for static content
   - Configure application pool settings (recycling, idle timeout)
   - Tune thread and connection limits based on server specifications

2. **Database Optimization**:
   - Implement connection pooling
   - Create appropriate indexes on queried tables
   - Configure query timeouts

3. **File System Performance**:
   - Use local storage for temporary files
   - Consider implementing a cleanup job for old result files
   - Monitor disk space and I/O performance

## Maintenance and Updates

1. **Updating the Application**:
   - Build updated versions on your development machine
   - Deploy updated files to the server
   - Consider implementing a CI/CD pipeline

2. **Monitoring**:
   - Set up IIS logs monitoring
   - Configure Windows Performance Counters
   - Implement health check endpoints

3. **Backup and Recovery**:
   - Regularly backup configuration files
   - Document IIS settings and custom configurations
   - Create a disaster recovery plan
