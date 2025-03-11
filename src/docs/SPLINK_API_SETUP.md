
# Splink API Setup Guide

This guide explains how to set up the Splink API to work with the Data HQ Dedupe web application.

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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def deduplicate_with_splink(unique_id_column, blocking_fields, match_fields, input_data):
    try:
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

        # Initialize linker
        linker = Linker(df, settings, db_api)

        # Train model and predict matches
        linker.estimate_u_using_random_sampling(max_pairs=1e6)
        predictions = linker.predict(threshold_match_probability=0.95)
        clusters = linker.cluster_pairwise_predictions_at_threshold(predictions, 0.95)

        # Convert clusters to pandas DataFrame
        df_clusters = clusters.as_pandas_dataframe()

        return df_clusters

    except Exception as e:
        logger.error(f"Error in deduplication: {str(e)}")
        raise
```

### File 2: app.py

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from api import deduplicate_with_splink
import pandas as pd
import os
import logging
import json

app = Flask(__name__)

# Configure CORS to allow requests from the web app
CORS(app, resources={r"/deduplicate": {"origins": "*"}})

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

        # Validate required fields
        if not all([unique_id_column, blocking_fields, match_fields, input_data]):
            return jsonify({"error": "Missing required parameters"}), 400

        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "deduped_results.csv")

        # Perform deduplication
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
   - Test endpoint: `http://localhost:5000/test-connection`

## Configuring the Web Application

1. In the web application, go to "Splink API Settings"
2. Set the API URL to `http://localhost:5000/deduplicate`
3. Leave the API Key blank (unless you've implemented authentication)
4. Set the Results Directory to match the output path in your API script (e.g., `D:/SplinkProjects/deduped_results_single`)

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
  "output_dir": "D:/SplinkProjects/deduped_results_single"
}
```

## API Response Format

The API will respond with:

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

## Troubleshooting

1. **CORS Issues**: If you encounter CORS errors, make sure Flask-CORS is properly installed and configured.
2. **Port Conflicts**: If port 5000 is already in use, change the port in both the API script and the web application settings.
3. **Missing Dependencies**: Ensure all required Python packages are installed.
4. **Output Directory**: Make sure the output directory exists and is writable.
