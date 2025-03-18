
# Splink with Apache Spark Integration Guide

This document explains how to set up and configure Apache Spark to work with Splink for distributed data deduplication at scale.

## Prerequisites

- Python 3.8 or higher
- Splink library and its dependencies
- Apache Spark 3.1+ (PySpark)
- Flask for the web API

## Installation

1. Install required Python packages:

```bash
pip install flask splink pandas flask-cors pyspark
```

2. Set up Apache Spark:
   - Download and extract Spark from [spark.apache.org](https://spark.apache.org/downloads.html)
   - Add Spark bin directory to your PATH
   - Set SPARK_HOME environment variable to your Spark installation directory

## API Changes for Spark Integration

The following changes need to be made to the Splink API to support Spark integration:

### 1. Update the API to support Spark configuration

Modify `api.py` to include Spark integration:

```python
import splink.comparison_library as cl
from splink import SparkAPI, Linker, splink_datasets
import pandas as pd
import json
import logging
import os
import sys
import time
import threading
from pyspark.sql import SparkSession
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global job tracking
job_status = {}

def create_spark_session(spark_config):
    """Create a Spark session with the specified configuration"""
    try:
        # Extract configuration from request
        master_url = spark_config.get("master_url", "local[*]")
        app_name = spark_config.get("app_name", "SplinkDedupe")
        executor_memory = spark_config.get("executor_memory", "4g")
        driver_memory = spark_config.get("driver_memory", "4g")
        num_executors = spark_config.get("num_executors", 2)
        executor_cores = spark_config.get("executor_cores", 2)
        shuffle_partitions = spark_config.get("shuffle_partitions", 200)
        local_dir = spark_config.get("local_dir")
        
        # Create the Spark session builder
        builder = SparkSession.builder \
            .appName(app_name) \
            .master(master_url) \
            .config("spark.executor.memory", executor_memory) \
            .config("spark.driver.memory", driver_memory) \
            .config("spark.executor.instances", num_executors) \
            .config("spark.executor.cores", executor_cores) \
            .config("spark.sql.shuffle.partitions", shuffle_partitions)
        
        # Add local directory config if specified
        if local_dir:
            builder = builder.config("spark.local.dir", local_dir)
        
        # Add any additional Spark configurations
        # TODO: Add other configurations as needed
        
        # Create and return the Spark session
        spark = builder.getOrCreate()
        logger.info(f"Created Spark session with master: {master_url}, app name: {app_name}")
        
        # Log Spark configuration
        logger.info(f"Spark configuration: {spark.sparkContext.getConf().getAll()}")
        
        return spark
    except Exception as e:
        logger.error(f"Error creating Spark session: {str(e)}")
        raise RuntimeError(f"Failed to create Spark session: {str(e)}")

def deduplicate_with_splink(unique_id_column, blocking_fields, match_fields, input_data, 
                           job_id=None, chunk_size=None, total_rows=None, spark_config=None):
    try:
        # Determine if we should use Spark
        use_spark = spark_config and spark_config.get("enabled", False)
        is_large_dataset = chunk_size is not None and total_rows is not None and total_rows > chunk_size
        
        # Update job status if tracking a job
        if is_large_dataset and job_id:
            if job_id not in job_status:
                job_status[job_id] = {
                    "status": "initializing",
                    "progress": 5,
                    "message": "Initializing deduplication environment",
                    "is_large_dataset": True,
                    "current_chunk": 1,
                    "total_chunks": (total_rows // chunk_size) + (1 if total_rows % chunk_size > 0 else 0),
                    "start_time": time.time(),
                    "use_spark": use_spark
                }
        
        # Create the appropriate API based on configuration
        if use_spark:
            logger.info("Using Spark API for deduplication")
            
            if job_id and job_id in job_status:
                job_status[job_id]["status"] = "creating_spark_session"
                job_status[job_id]["progress"] = 10
                job_status[job_id]["message"] = "Creating Spark session"
            
            # Create Spark session
            spark = create_spark_session(spark_config)
            
            # Create Spark API
            db_api = SparkAPI(spark)
            
            if job_id and job_id in job_status:
                job_status[job_id]["status"] = "loading_data"
                job_status[job_id]["progress"] = 20
                job_status[job_id]["message"] = "Loading data into Spark"
        else:
            logger.info("Using DuckDB API for deduplication")
            from splink import DuckDBAPI
            db_api = DuckDBAPI()

        # Convert input_data (JSON string or dict) to pandas DataFrame
        if isinstance(input_data, str):
            input_data = json.loads(input_data)
        df = pd.DataFrame(input_data)
        
        # Build comparisons based on match_fields with types
        comparisons = []
        for match in match_fields:
            field = match.get('field')
            match_type = match.get('type')

            if not field or not match_type:
                raise ValueError(f"Invalid match field format: {match}")

            if match_type == "exact":
                comparisons.append(cl.exact_match(field))
            elif match_type == "levenshtein":
                comparisons.append(cl.levenshtein_at_thresholds(field, [2, 4]))
            elif match_type == "jaro_winkler":
                comparisons.append(cl.jaro_winkler_at_thresholds(field, [0.9, 0.7]))
            else:
                logger.warning(f"Unsupported match type '{match_type}' for field '{field}', defaulting to exact match")
                comparisons.append(cl.exact_match(field))

        # Define settings
        settings = {
            "link_type": "dedupe_only",
            "unique_id_column_name": unique_id_column,
            "comparisons": comparisons,
            "blocking_rules_to_generate_predictions": [
                f"l.{field} = r.{field}" for field in blocking_fields
            ],
        }
        
        if job_id and job_id in job_status:
            job_status[job_id]["status"] = "initializing_linker"
            job_status[job_id]["progress"] = 30
            job_status[job_id]["message"] = "Initializing Splink Linker"
        
        # Initialize linker
        linker = Linker(df, settings, db_api)

        # Train model and predict matches
        if job_id and job_id in job_status:
            job_status[job_id]["status"] = "estimating_u"
            job_status[job_id]["progress"] = 40
            job_status[job_id]["message"] = "Estimating parameters"
        
        # For large datasets or Spark, use smaller sampling to speed up estimation
        sample_size = min(1e5, total_rows * 0.1) if (is_large_dataset or use_spark) else 1e6
        linker.estimate_u_using_random_sampling(max_pairs=sample_size)
        
        if job_id and job_id in job_status:
            job_status[job_id]["status"] = "predicting"
            job_status[job_id]["progress"] = 60
            job_status[job_id]["message"] = "Predicting matches"
        
        # Spark typically needs a lower threshold to function well
        match_threshold = 0.8 if use_spark else 0.95
        predictions = linker.predict(threshold_match_probability=match_threshold)
        
        if job_id and job_id in job_status:
            job_status[job_id]["status"] = "clustering"
            job_status[job_id]["progress"] = 80
            job_status[job_id]["message"] = "Clustering records"
        
        clusters = linker.cluster_pairwise_predictions_at_threshold(predictions, match_threshold)

        # Convert clusters to pandas DataFrame
        df_clusters = clusters.as_pandas_dataframe()
        
        if job_id and job_id in job_status:
            job_status[job_id]["status"] = "completed"
            job_status[job_id]["progress"] = 100
            job_status[job_id]["message"] = "Processing completed"
            job_status[job_id]["estimated_time_remaining"] = "0:00"
            job_status[job_id]["records_processed"] = len(df)
            job_status[job_id]["total_records"] = total_rows or len(df)
        
        # Clean up Spark session if used
        if use_spark:
            try:
                spark.stop()
                logger.info("Spark session stopped")
            except Exception as e:
                logger.warning(f"Error stopping Spark session: {str(e)}")

        return df_clusters

    except Exception as e:
        logger.error(f"Error in deduplication: {str(e)}")
        if job_id and job_id in job_status:
            job_status[job_id]["status"] = "failed"
            job_status[job_id]["message"] = f"Error: {str(e)}"
            job_status[job_id]["progress"] = 0
        raise
```

### 2. Update the Flask app to handle Spark configuration

Update `app.py` to accept and process Spark configurations:

```python
@app.route('/deduplicate', methods=['POST'])
def deduplicate():
    try:
        # Parse JSON request
        data = request.get_json()

        # Extract parameters
        unique_id_column = data.get('unique_id_column')
        blocking_fields = data.get('blocking_fields')
        match_fields = data.get('match_fields')
        input_data = data.get('input_data')
        output_dir = data.get('output_dir', "D:/SplinkProjects/deduped_results_single")
        job_id = data.get('job_id')
        chunk_size = data.get('chunk_size')
        total_rows = data.get('total_rows')
        spark_config = data.get('spark_config')  # New parameter for Spark

        # Validate required fields
        if not all([unique_id_column, blocking_fields, match_fields, input_data]):
            return jsonify({"error": "Missing required parameters"}), 400

        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"deduped_results_{job_id or 'latest'}.csv")

        # Check if Spark is requested
        use_spark = spark_config and spark_config.get("enabled", True)
        
        # Log configuration
        logger.info(f"Starting deduplication job: {job_id}")
        logger.info(f"Using Spark: {use_spark}")
        if use_spark:
            logger.info(f"Spark config: {spark_config}")

        # Check if this is a large dataset request
        is_large_dataset = chunk_size is not None and total_rows is not None and total_rows > chunk_size

        if is_large_dataset:
            logger.info(f"Large dataset detected: {total_rows} total rows with chunk size {chunk_size}")
            
            # Initialize job status
            if job_id not in job_status:
                job_status[job_id] = {
                    "status": "processing",
                    "progress": 5,
                    "message": "Starting large dataset processing",
                    "is_large_dataset": True,
                    "current_chunk": 0,
                    "total_chunks": (total_rows // chunk_size) + (1 if total_rows % chunk_size > 0 else 0),
                    "start_time": pd.Timestamp.now().timestamp(),
                    "records_processed": 0,
                    "total_records": total_rows,
                    "use_spark": use_spark
                }
            
            # Process data asynchronously
            threading.Thread(
                target=process_data_async,
                args=(
                    unique_id_column, 
                    blocking_fields, 
                    match_fields, 
                    input_data,
                    job_id,
                    chunk_size,
                    total_rows,
                    output_dir,
                    spark_config
                )
            ).start()
            
            # Prepare response for large dataset
            response = {
                "message": f"Large dataset processing started {' with Spark' if use_spark else ''}",
                "job_id": job_id,
                "output_path": output_path,
                "is_large_dataset": True,
                "total_rows": total_rows,
                "use_spark": use_spark,
                "statistics": {
                    "total_records": total_rows,
                    "processed_records": len(input_data),
                    "remaining_records": total_rows - len(input_data)
                }
            }
            
            return jsonify(response), 202  # Accepted, processing will continue
            
        else:
            # Regular processing for smaller datasets
            df_clusters = deduplicate_with_splink(
                unique_id_column, 
                blocking_fields, 
                match_fields, 
                input_data,
                job_id,
                None,
                None,
                spark_config
            )

            # Save results to CSV
            df_clusters.to_csv(output_path, index=False)
            logger.info(f"Results saved to {output_path}")

            # Compute statistics
            total_records = len(input_data)
            num_clusters = df_clusters['cluster_id'].nunique() if 'cluster_id' in df_clusters.columns else 0
            avg_cluster_size = df_clusters.groupby('cluster_id').size().mean() if num_clusters > 0 else 0

            # Prepare detailed response
            response = {
                "message": f"Deduplication successful{' with Spark' if use_spark else ''}",
                "output_path": output_path,
                "use_spark": use_spark,
                "cluster_data": df_clusters.to_dict(orient='records'),  # Return cluster data as JSON
                "statistics": {
                    "total_records": total_records,
                    "num_clusters": int(num_clusters),
                    "avg_cluster_size": float(avg_cluster_size)
                }
            }

            return jsonify(response), 200

    except Exception as e:
        logger.error(f"Error in deduplication endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

def process_data_async(unique_id_column, blocking_fields, match_fields, input_data, 
                      job_id, chunk_size, total_rows, output_dir, spark_config=None):
    """Process data asynchronously for large datasets or Spark processing"""
    try:
        # Update job status
        if job_id in job_status:
            job_status[job_id]["status"] = "processing"
            job_status[job_id]["progress"] = 10
            job_status[job_id]["message"] = "Starting data processing"
        
        # Process data with Splink
        df_clusters = deduplicate_with_splink(
            unique_id_column, 
            blocking_fields, 
            match_fields, 
            input_data,
            job_id,
            chunk_size,
            total_rows,
            spark_config
        )
        
        # Save results to CSV
        output_path = os.path.join(output_dir, f"deduped_results_{job_id}.csv")
        df_clusters.to_csv(output_path, index=False)
        logger.info(f"Results saved to {output_path}")
        
        # Update job status
        if job_id in job_status:
            job_status[job_id]["status"] = "completed"
            job_status[job_id]["progress"] = 100
            job_status[job_id]["message"] = "Processing completed"
            job_status[job_id]["estimated_time_remaining"] = "0:00"
            job_status[job_id]["records_processed"] = total_rows
            job_status[job_id]["total_records"] = total_rows
            
    except Exception as e:
        logger.error(f"Error in async processing: {str(e)}")
        if job_id in job_status:
            job_status[job_id]["status"] = "failed"
            job_status[job_id]["message"] = f"Error: {str(e)}"
            job_status[job_id]["progress"] = 0
```

## Running the API with Spark Support

1. Ensure Apache Spark is properly installed and configured on your system
2. Start the API server:

```bash
python app.py
```

3. The API will be available at the same endpoints as before

## Setting Up a Spark Cluster

For production use, you should set up a proper Spark cluster:

### 1. Standalone Cluster Setup

1. Start the Spark master:
```bash
$SPARK_HOME/sbin/start-master.sh
```

2. Start one or more workers:
```bash
$SPARK_HOME/sbin/start-worker.sh spark://master-hostname:7077
```

3. View the Spark UI (by default at http://master-hostname:8080)

### 2. Using YARN Cluster Manager

If you're using Hadoop YARN:

1. Ensure your Hadoop cluster is running
2. Specify `yarn` as the master URL in your Spark configuration
3. Set appropriate YARN-specific configurations

## Configuring the Web Application

1. In the web application, go to "Splink API Settings"
2. Navigate to the "Spark Configuration" tab
3. Enable Spark and configure:
   - Master URL (e.g., `spark://localhost:7077` for standalone cluster)
   - Application Name
   - Executor and Driver Memory
   - Number of Executors and Cores
   - Shuffle Partitions

## Performance Tuning

When using Spark with Splink, consider these performance tuning options:

1. **Memory Configuration**:
   - Increase executor memory for large datasets
   - Adjust driver memory based on result size

2. **Parallelism**:
   - Increase executor count for more parallelism
   - Adjust executor cores based on your hardware

3. **Shuffle Tuning**:
   - Adjust shuffle partitions based on data size (generally 2-3x the total number of cores)
   - Consider local storage location for shuffle files

4. **Splink-Specific Settings**:
   - Use fewer blocking rules with very large datasets
   - Consider lower match thresholds (0.8 instead of 0.95) with Spark
   - Limit the number of comparisons when possible

## Troubleshooting

1. **"No space left on device" errors**:
   - Set a different local directory for Spark temporary files
   - Clean up old Spark work directories

2. **Out of Memory Errors**:
   - Increase executor and driver memory
   - Enable off-heap memory with `spark.memory.offHeap.enabled=true`
   - Reduce the size of data batches

3. **Slow Performance**:
   - Check Spark UI for skewed tasks
   - Adjust partitioning strategy
   - Optimize blocking rules to reduce comparison pairs

4. **Driver Crashes**:
   - Increase driver memory
   - Reduce the amount of data returned to the driver

## Monitoring Spark Jobs

1. Use the Spark UI (typically on port 4040 for the application, 8080 for the master)
2. Check executor logs for detailed information
3. Monitor memory usage using the Spark UI metrics

## Example API Request with Spark Configuration

```json
{
  "unique_id_column": "id",
  "blocking_fields": ["postcode", "surname"],
  "match_fields": [
    {"field": "first_name", "type": "jaro_winkler"},
    {"field": "surname", "type": "exact"},
    {"field": "address", "type": "levenshtein"}
  ],
  "input_data": [...],
  "output_dir": "D:/SplinkProjects/deduped_results_single",
  "job_id": "job_1234567890abcdef",
  "chunk_size": 50000,
  "total_rows": 1000000,
  "spark_config": {
    "enabled": true,
    "master_url": "spark://localhost:7077",
    "app_name": "SplinkDedupe",
    "executor_memory": "4g",
    "driver_memory": "4g",
    "num_executors": 2,
    "executor_cores": 2,
    "shuffle_partitions": 200,
    "local_dir": "/tmp/spark"
  }
}
```
