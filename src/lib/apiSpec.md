
# Data HQ Dedupe API Specification

This document outlines the API requirements for the Data HQ Dedupe application to support MySQL data loading and automated deduplication.

## Base URL

- Development: `http://localhost:5000/api`
- Production: Relative to the application host at `/api`

## Endpoints

### 1. Database Connection

#### Load data from MySQL

```
POST /database/load
```

Request body:
```json
{
  "connectionConfig": {
    "host": "localhost",
    "port": 3306,
    "user": "username",
    "password": "password",
    "database": "database_name"
  },
  "query": "SELECT * FROM customers",
  "isTable": false
}
```

Response (200 OK):
```json
{
  "success": true,
  "rows": [
    { "id": 1, "name": "John Doe", "email": "john@example.com" },
    { "id": 2, "name": "Jane Smith", "email": "jane@example.com" }
  ],
  "columns": ["id", "name", "email"]
}
```

### 2. Automated Deduplication

#### Run deduplication using saved configuration

```
POST /dedupe/automated
```

Request body:
```json
{
  "data": [
    { "id": 1, "name": "John Doe", "email": "john@example.com" },
    { "id": 2, "name": "Jane Smith", "email": "jane@example.com" }
  ],
  "configId": "abc123",
  "resultLocation": "/path/to/results/folder" 
}
```

Response (200 OK):
```json
{
  "success": true,
  "resultId": "result_xyz789",
  "message": "Deduplication completed successfully",
  "stats": {
    "originalRows": 100,
    "uniqueRows": 85,
    "duplicateRows": 15
  },
  "resultLocation": "/path/to/results/folder/result_xyz789.json"
}
```

#### Get deduplication result

```
GET /dedupe/results/:resultId
```

Response (200 OK):
```json
{
  "originalRows": 100,
  "uniqueRows": 85,
  "duplicateRows": 15,
  "clusters": [...],
  "processedData": [...],
  "flaggedData": [...]
}
```

#### Get deduplication jobs

```
GET /dedupe/jobs
```

Response (200 OK):
```json
[
  {
    "id": "job_abc123",
    "configId": "config_xyz789",
    "timestamp": 1612345678910,
    "status": "completed",
    "stats": {
      "originalRows": 100,
      "uniqueRows": 85,
      "duplicateRows": 15
    },
    "resultLocation": "/path/to/results/folder/result_xyz789.json"
  }
]
```

## Implementation Requirements

### Server-side Implementation

The server needs to:

1. Connect to MySQL databases using provided credentials
2. Execute SQL queries or retrieve table data
3. Run deduplication using saved configurations
4. Store results in specified locations
5. Track deduplication jobs and their status
6. Provide API endpoints for retrieving results

### Security Considerations

- Database credentials should be encrypted in transit
- API should implement authentication for production use
- File paths should be validated to prevent directory traversal attacks
- Rate limiting should be implemented to prevent abuse

## File Storage

Results should be stored in JSON format with the following structure:

```
/results
  /[job_id]
    - metadata.json     (Contains job information and statistics)
    - deduplicated.json (Contains deduplicated data)
    - flagged.json      (Contains original data with duplicate flags)
```
