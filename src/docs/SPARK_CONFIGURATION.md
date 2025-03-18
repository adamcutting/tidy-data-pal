
# Spark Configuration with Data HQ Match and Dedupe

This document explains how to configure and use Apache Spark with the Data HQ Match and Dedupe application.

## Overview

The application now supports Apache Spark for processing large datasets more efficiently. Spark provides distributed computing capabilities that can significantly improve performance for deduplication tasks on large datasets.

## Backend Configuration

The Flask backend has been updated to support Spark integration. The `app.py` file now includes:

- Spark configuration processing
- Status tracking for Spark jobs
- Asynchronous processing for large datasets

## Frontend Configuration

The frontend application has been updated to:

1. Display Spark usage indicators in the UI
2. Allow configuration of Spark settings
3. Track Spark job progress

## How to Use Spark

### 1. Enable Spark in the Deduplication Configuration

When setting up a deduplication job:

1. Go to the "Config" step in the application
2. Enable "Use Apache Spark for processing"
3. Configure Spark settings:
   - Master URL: The Spark master URL (e.g., `local[*]`, `spark://master:7077`)
   - Number of executors: Number of Spark executors to use
   - Executor memory: Memory allocation per executor (e.g., `4g`)
   - Driver memory: Memory allocation for the driver (e.g., `2g`)

### 2. Monitor Spark Jobs

When a job is running with Spark:

1. The job list will display a Spark indicator (✨) next to jobs that use Spark
2. The job details will show Spark-specific information
3. Progress indicators will reflect the distributed nature of Spark processing

### 3. Large Dataset Processing

For large datasets:

1. The application automatically chunks data for processing
2. Progress is tracked across chunks
3. Spark efficiently distributes processing across available resources

## Spark Configuration Options

### Basic Configuration

- **Master URL** (`masterUrl`): Spark master URL
  - `local[*]`: For local mode using all available cores
  - `spark://hostname:port`: For connecting to a Spark standalone cluster
  - `yarn`: For YARN cluster manager

### Resource Configuration

- **Executor Memory** (`executorMemory`): Memory per executor (e.g., `4g`)
- **Driver Memory** (`driverMemory`): Memory for driver (e.g., `2g`)
- **Number of Executors** (`numExecutors`): Number of executors to use
- **Executor Cores** (`executorCores`): Number of cores per executor

### Advanced Configuration

- **Shuffle Partitions** (`shufflePartitions`): Number of partitions for shuffling
- **Local Directory** (`localDir`): Directory for Spark temporary files

## Example Configuration

```json
{
  "sparkConfig": {
    "enabled": true,
    "masterUrl": "local[*]",
    "executorMemory": "4g",
    "driverMemory": "2g",
    "numExecutors": 2,
    "executorCores": 2,
    "shufflePartitions": 100
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check that Spark master is running and accessible
2. **Out of Memory**: Increase executor and driver memory
3. **Slow Performance**: Adjust executor cores and shuffle partitions

### Logs

Check the application logs for Spark-related messages. The Flask backend logs detailed information about Spark configuration and execution.

## Performance Optimization

For optimal performance with Spark:

1. Use appropriate blocking fields to reduce comparisons
2. Configure memory based on available system resources
3. For very large datasets, increase the number of executors and cores
4. Use SSD storage for Spark temp directories when possible
