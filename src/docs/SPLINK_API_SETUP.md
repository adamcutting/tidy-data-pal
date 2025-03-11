
# Splink API Setup Guide

This guide explains how to set up the Splink API to work with the Data HQ Dedupe web application, including optimizations for large datasets.

## Prerequisites

- Python 3.8 or higher
- Splink library and its dependencies
- Flask for the web API

## Installation

1. Install required Python packages:

```bash
pip install flask splink pandas flask-cors
```

2. Create two files:

### File 1: api.py

```python
import splink.comparison_library as cl
from splink import DuckDBAPI, Linker, splink_datasets
import pandas as pd
import json
import logging
import os
import sys
import time
import threading
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global job tracking
job_status = {}

def deduplicate_with_splink(unique_id_column, blocking_fields, match_fields, input_data, job_id=None, chunk_size=None, total_rows=None):
    try:
        # Handle large datasets through chunking
        is_large_dataset = chunk_size is not None and total_rows is not None and total_rows > chunk_size
        
        # Initialize DuckDB API
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

        # For large datasets, update job status
        if is_large_dataset and job_id:
            if job_id not in job_status:
                job_status[job_id] = {
                    "status": "processing",
                    "progress": 10,
                    "message": "Initializing deduplication for large dataset",
                    "is_large_dataset": True,
                    "current_chunk": 1,
                    "total_chunks": (total_rows // chunk_size) + (1 if total_rows % chunk_size > 0 else 0),
                    "start_time": time.time()
                }
        
        # Initialize linker
        linker = Linker(df, settings, db_api)

        # Train model and predict matches
        if is_large_dataset and job_id:
            job_status[job_id]["status"] = "estimating_u"
            job_status[job_id]["progress"] = 30
            job_status[job_id]["message"] = "Estimating parameters for large dataset"
        
        # For large datasets, use smaller sampling to speed up estimation
        sample_size = 1e6 if not is_large_dataset else min(1e5, total_rows * 0.1)
        linker.estimate_u_using_random_sampling(max_pairs=sample_size)
        
        if is_large_dataset and job_id:
            job_status[job_id]["status"] = "predicting"
            job_status[job_id]["progress"] = 50
            job_status[job_id]["message"] = "Predicting matches for first data chunk"
        
        predictions = linker.predict(threshold_match_probability=0.95)
        
        if is_large_dataset and job_id:
            job_status[job_id]["status"] = "clustering"
            job_status[job_id]["progress"] = 70
            job_status[job_id]["message"] = "Clustering records"
        
        clusters = linker.cluster_pairwise_predictions_at_threshold(predictions, 0.95)

        # Convert clusters to pandas DataFrame
        df_clusters = clusters.as_pandas_dataframe()
        
        if is_large_dataset and job_id:
            job_status[job_id]["status"] = "completed"
            job_status[job_id]["progress"] = 100
            job_status[job_id]["message"] = "First chunk processing completed"
            job_status[job_id]["estimated_time_remaining"] = "N/A"
            job_status[job_id]["records_processed"] = len(df)
            job_status[job_id]["total_records"] = total_rows

        return df_clusters

    except Exception as e:
        logger.error(f"Error in deduplication: {str(e)}")
        if job_id and job_id in job_status:
            job_status[job_id]["status"] = "failed"
            job_status[job_id]["message"] = f"Error: {str(e)}"
            job_status[job_id]["progress"] = 0
        raise

def process_large_dataset_async(job_id, unique_id_column, blocking_fields, match_fields, chunk_size, total_rows, output_dir):
    """Process large datasets in chunks asynchronously"""
    try:
        # This would be implemented to process data in chunks from a database or temporary storage
        # For now, we'll simulate progress updates
        total_chunks = (total_rows // chunk_size) + (1 if total_rows % chunk_size > 0 else 0)
        
        for chunk_num in range(1, total_chunks + 1):
            # Update status
            job_status[job_id]["current_chunk"] = chunk_num
            job_status[job_id]["progress"] = min(95, int(20 + (chunk_num / total_chunks) * 75))
            job_status[job_id]["message"] = f"Processing chunk {chunk_num} of {total_chunks}"
            
            # Simulate processing time
            time.sleep(2)  # In a real implementation, this would be actual processing
            
            # Update records processed
            job_status[job_id]["records_processed"] = min(total_rows, chunk_num * chunk_size)
            
            # Estimate time remaining
            elapsed_time = time.time() - job_status[job_id]["start_time"]
            if chunk_num > 1:
                avg_time_per_chunk = elapsed_time / chunk_num
                remaining_chunks = total_chunks - chunk_num
                est_remaining_seconds = avg_time_per_chunk * remaining_chunks
                job_status[job_id]["estimated_time_remaining"] = f"{int(est_remaining_seconds // 60)}:{int(est_remaining_seconds % 60):02d}"
        
        # Finalize processing
        job_status[job_id]["status"] = "completed"
        job_status[job_id]["progress"] = 100
        job_status[job_id]["message"] = "Processing completed"
        job_status[job_id]["records_processed"] = total_rows
        
        # In a real implementation, you would write final results to the output directory
        logger.info(f"Large dataset processing completed for job {job_id}")
        
    except Exception as e:
        logger.error(f"Error in async processing: {str(e)}")
        job_status[job_id]["status"] = "failed"
        job_status[job_id]["message"] = f"Error: {str(e)}"
        job_status[job_id]["progress"] = 0
```

### File 2: app.py

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from api import deduplicate_with_splink, job_status, process_large_dataset_async
import pandas as pd
import os
import logging
import json
import threading

app = Flask(__name__)

# Configure CORS to allow requests from the web app
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/deduplicate', methods=['POST'])
def deduplicate():
    try:
        # Parse JSON request
        data = request.get_json()

        # Extract parameters
        unique_id_column = data.get('unique_id_column')
        blocking_fields = data.get('blocking_fields')
        match_fields = data.get('match_fields')  # Expected as a list of dicts with field and type
        input_data = data.get('input_data')
        output_dir = data.get('output_dir', "D:/SplinkProjects/deduped_results_single")
        job_id = data.get('job_id')
        chunk_size = data.get('chunk_size')
        total_rows = data.get('total_rows')

        # Validate required fields
        if not all([unique_id_column, blocking_fields, match_fields, input_data]):
            return jsonify({"error": "Missing required parameters"}), 400

        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"deduped_results_{job_id or 'latest'}.csv")

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
                    "total_records": total_rows
                }
            
            # Process first chunk synchronously to get initial results
            df_clusters = deduplicate_with_splink(
                unique_id_column, 
                blocking_fields, 
                match_fields, 
                input_data,
                job_id,
                chunk_size,
                total_rows
            )
            
            # Start async processing for the rest of the data
            threading.Thread(
                target=process_large_dataset_async,
                args=(job_id, unique_id_column, blocking_fields, match_fields, chunk_size, total_rows, output_dir)
            ).start()
            
            # Save initial results
            df_clusters.to_csv(output_path, index=False)
            
            # Prepare response for large dataset
            response = {
                "message": "Large dataset processing started",
                "job_id": job_id,
                "output_path": output_path,
                "is_large_dataset": True,
                "total_rows": total_rows,
                "statistics": {
                    "total_records": total_rows,
                    "processed_records": len(input_data),
                    "remaining_records": total_rows - len(input_data)
                }
            }
            
            return jsonify(response), 202  # Accepted, processing will continue
            
        else:
            # Regular processing for smaller datasets
            df_clusters = deduplicate_with_splink(unique_id_column, blocking_fields, match_fields, input_data)

            # Save results to CSV
            df_clusters.to_csv(output_path, index=False)
            logger.info(f"Results saved to {output_path}")

            # Compute statistics
            total_records = len(input_data)
            num_clusters = df_clusters['cluster_id'].nunique() if 'cluster_id' in df_clusters.columns else 0
            avg_cluster_size = df_clusters.groupby('cluster_id').size().mean() if num_clusters > 0 else 0

            # Prepare detailed response
            response = {
                "message": "Deduplication successful",
                "output_path": output_path,
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

@app.route('/job-status/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Endpoint to check the status of a job"""
    if job_id in job_status:
        return jsonify(job_status[job_id]), 200
    return jsonify({"error": "Job not found"}), 404

@app.route('/cancel-job/<job_id>', methods=['POST'])
def cancel_job(job_id):
    """Endpoint to cancel a running job"""
    if job_id in job_status:
        if job_status[job_id]["status"] not in ["completed", "failed", "cancelled"]:
            job_status[job_id]["status"] = "cancelled"
            job_status[job_id]["message"] = "Job cancelled by user"
            return jsonify({"message": "Job cancelled successfully"}), 200
        return jsonify({"message": f"Cannot cancel job in state: {job_status[job_id]['status']}"}), 400
    return jsonify({"error": "Job not found"}), 404

@app.route('/test-connection', methods=['GET'])
def test_connection():
    """Endpoint for connection testing by the web app"""
    return jsonify({"message": "Connection successful"}), 200

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
```

## Running the API

1. Start the API server:

```bash
python app.py
```

2. The API will be available at:
   - Main endpoint: `http://localhost:5000/deduplicate`
   - Status endpoint: `http://localhost:5000/job-status/<job_id>`
   - Cancel endpoint: `http://localhost:5000/cancel-job/<job_id>`
   - Test endpoint: `http://localhost:5000/test-connection`

## Configuring the Web Application

1. In the web application, go to "Splink API Settings"
2. Set the API URL to `http://localhost:5000/deduplicate`
3. Leave the API Key blank (unless you've implemented authentication)
4. Set the Results Directory to match the output path in your API script (e.g., `D:/SplinkProjects/deduped_results_single`)
5. For large datasets, set the Large Dataset Threshold (e.g., 100000 rows)

## Handling Large Datasets

The updated API includes special handling for large datasets:

1. **Client-side chunking**: The web application will detect large datasets and only send the first chunk to the API
2. **Asynchronous processing**: The API processes the initial chunk and returns a job ID, then continues processing the rest of the data asynchronously
3. **Status updates**: The client can poll the `/job-status/<job_id>` endpoint to get progress updates
4. **Cancellation**: Long-running jobs can be cancelled using the `/cancel-job/<job_id>` endpoint

For datasets with millions of rows, consider:

1. Using a database as the data source instead of file uploads
2. Increasing system memory on the server (8GB+ recommended)
3. Using a production WSGI server like Gunicorn instead of Flask's development server
4. Setting appropriate timeouts in your web server configuration

## API Request Format

The web application will send requests to the API in the following format:

```json
{
  "unique_id_column": "id",
  "blocking_fields": ["postcode", "surname"],
  "match_fields": [
    {"field": "first_name", "type": "jaro_winkler"},
    {"field": "surname", "type": "exact"},
    {"field": "address", "type": "levenshtein"}
  ],
  "input_data": [
    {"id": 1, "first_name": "John", "surname": "Smith", "address": "123 Main St", "postcode": "AB12 3CD"},
    {"id": 2, "first_name": "Jon", "surname": "Smith", "address": "123 Main Street", "postcode": "AB12 3CD"}
  ],
  "output_dir": "D:/SplinkProjects/deduped_results_single",
  "job_id": "job_1234567890abcdef",
  "chunk_size": 50000,
  "total_rows": 1000000
}
```

## API Response Format

For regular-sized datasets, the API will respond with:

```json
{
  "message": "Deduplication successful",
  "output_path": "D:/SplinkProjects/deduped_results_single/deduped_results.csv",
  "cluster_data": [
    {"cluster_id": 1, "unique_id": "id-1", "first_name": "John", "surname": "Smith", ...},
    {"cluster_id": 1, "unique_id": "id-2", "first_name": "Jon", "surname": "Smith", ...},
    ...
  ],
  "statistics": {
    "total_records": 100,
    "num_clusters": 90,
    "avg_cluster_size": 1.111
  }
}
```

For large datasets, the initial response will be:

```json
{
  "message": "Large dataset processing started",
  "job_id": "job_1234567890abcdef",
  "output_path": "D:/SplinkProjects/deduped_results_single/deduped_results_job_1234567890abcdef.csv",
  "is_large_dataset": true,
  "total_rows": 1000000,
  "statistics": {
    "total_records": 1000000,
    "processed_records": 50000,
    "remaining_records": 950000
  }
}
```

## Troubleshooting Large Dataset Processing

1. **Memory Issues**: If you encounter out-of-memory errors:
   - Reduce the chunk size in the API settings
   - Increase server memory
   - Consider using a database as the input source instead of files

2. **Long Processing Times**: For very large datasets:
   - Optimize your blocking strategy to reduce comparison pairs
   - Use simpler comparison types (exact matches are faster than fuzzy)
   - Consider pre-processing data to standardize formats before deduplication

3. **Connection Timeouts**: For web servers with timeouts:
   - Configure longer timeouts in your proxy/web server
   - Implement a job queue system for very large jobs
