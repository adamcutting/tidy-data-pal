
# Splink API Setup Guide

This guide explains how to set up the Splink API to work with the Data HQ Dedupe web application.

## Prerequisites

- Python 3.8 or higher
- Splink library and its dependencies
- Flask for the web API

## Installation

1. Install required Python packages:

```bash
pip install flask splink pandas
```

2. Create a file named `app.py` with the following content:

```python
from flask import Flask, request, jsonify
from splink.duckdb.linker import DuckDBLinker
from splink.duckdb.comparison_library import (
    exact_match,
    levenshtein_at_thresholds,
    jaro_winkler_at_thresholds,
)
import pandas as pd
import logging
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/api/deduplicate', methods=['POST'])
def deduplicate():
    try:
        # Parse user-defined configuration from the request
        data = request.json
        unique_id_column = data['unique_id_column']
        blocking_fields = data['blocking_fields']
        match_fields = data['match_fields']
        input_data = data['input_data']  # Input data as a list of dictionaries

        # Convert input data to a Pandas DataFrame
        df = pd.DataFrame(input_data)

        # Dynamically create Splink settings based on user input
        comparisons = []
        for field in match_fields:
            if field['type'] == 'exact':
                comparisons.append(exact_match(field['column']))
            elif field['type'] == 'levenshtein':
                comparisons.append(levenshtein_at_thresholds(field['column'], [2, 4]))
            elif field['type'] == 'jaro_winkler':
                comparisons.append(jaro_winkler_at_thresholds(field['column'], [0.9, 0.8]))

        settings = {
            "link_type": "dedupe_only",
            "unique_id_column_name": unique_id_column,
            "comparisons": comparisons,
            "blocking_rules_to_generate_predictions": [f"l.{field} = r.{field}" for field in blocking_fields],
        }

        # Initialize Splink with DuckDB backend
        logger.info("Initializing Splink with DuckDB backend")
        linker = DuckDBLinker(df, settings)

        # Train the model
        logger.info("Training the model")
        linker.estimate_u_using_random_sampling(max_pairs=1e6)

        # Predict matches
        logger.info("Predicting matches")
        predictions = linker.predict(threshold_match_probability=0.95)

        # Cluster duplicates
        logger.info("Clustering duplicates")
        clusters = linker.cluster_pairwise_predictions_at_threshold(predictions, threshold_match_probability=0.95)
        
        # Convert clusters to dict for JSON response
        clusters_dict = clusters.as_pandas_dataframe().to_dict(orient='records')
        
        # Calculate statistics
        original_count = len(df)
        cluster_unique_count = clusters.cluster_memberships.as_pandas_dataframe()['cluster_id'].nunique()
        duplicate_count = original_count - cluster_unique_count

        # Save results to a CSV file (optional)
        output_dir = "D:/SplinkProjects/deduped_results_single"
        os.makedirs(output_dir, exist_ok=True)
        output_file = os.path.join(output_dir, "deduped_results.csv")
        clusters.as_pandas_dataframe().to_csv(output_file, index=False)

        return jsonify({
            "status": "success", 
            "output_file": output_file,
            "stats": {
                "originalRows": original_count,
                "uniqueRows": cluster_unique_count,
                "duplicateRows": duplicate_count
            },
            "clusters": clusters_dict
        })

    except Exception as e:
        logger.error(f"Error during deduplication: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Add OPTIONS method handler for CORS preflight requests
@app.route('/api/deduplicate', methods=['OPTIONS'])
def options():
    return '', 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

3. Install Flask-CORS to handle cross-origin requests:

```bash
pip install flask-cors
```

## Running the API

1. Start the API server:

```bash
python app.py
```

2. The API will be available at `http://localhost:5000/api/deduplicate`

## Configuring the Web Application

1. In the web application, go to "Splink API Settings"
2. Set the API URL to `http://localhost:5000/api/deduplicate`
3. Leave the API Key blank (unless you've implemented authentication)
4. Set the Results Directory to match the output path in your API script (e.g., `D:/SplinkProjects/deduped_results_single`)

## API Request Format

The web application will send requests to the API in the following format:

```json
{
  "unique_id_column": "id",
  "blocking_fields": ["postcode", "surname"],
  "match_fields": [
    {"column": "first_name", "type": "jaro_winkler"},
    {"column": "surname", "type": "exact"},
    {"column": "address", "type": "levenshtein"}
  ],
  "input_data": [
    {"id": 1, "first_name": "John", "surname": "Smith", "address": "123 Main St", "postcode": "AB12 3CD"},
    {"id": 2, "first_name": "Jon", "surname": "Smith", "address": "123 Main Street", "postcode": "AB12 3CD"}
  ]
}
```

## API Response Format

The API should respond with:

```json
{
  "status": "success",
  "output_file": "/path/to/results.csv",
  "stats": {
    "originalRows": 100,
    "uniqueRows": 90,
    "duplicateRows": 10
  },
  "clusters": [
    {"cluster_id": 1, "unique_id": "id-1", "first_name": "John", "surname": "Smith", ...},
    {"cluster_id": 1, "unique_id": "id-2", "first_name": "Jon", "surname": "Smith", ...},
    ...
  ]
}
```

## Troubleshooting

1. **CORS Issues**: If you encounter CORS errors, make sure Flask-CORS is properly installed and configured.
2. **Port Conflicts**: If port 5000 is already in use, change the port in both the API script and the web application settings.
3. **Missing Dependencies**: Ensure all required Python packages are installed.
4. **Output Directory**: Make sure the output directory exists and is writable.

