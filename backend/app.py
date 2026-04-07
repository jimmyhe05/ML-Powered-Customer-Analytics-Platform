from MLP1 import ChurnDataset, ChurnMLP
from collections import OrderedDict
import numpy as np
import json
from sklearn.base import BaseEstimator
from xgboost import XGBClassifier
from flask_cors import CORS
from flask import Flask, request, jsonify
import joblib
import pandas as pd
import logging
import os
import subprocess
import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime
from sqlalchemy import create_engine
import torch
import subprocess
import threading
from datetime import datetime
from typing import Dict, List, Any
import time
from config import get_db_config, get_row_limit

# Flask App - Provides REST APIs for communication between the backend, Database, and Frontend React App.

# =======================================================================================
# Set Up
# =======================================================================================
app = Flask(__name__)

# Sets protection features for access
# CORS(app, origins=["http://localhost:4173", "http://127.0.0.1:4173"]) #For LocalHost Development
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure logging for terminal debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _empty_dashboard_metrics():
    return {
        "age_range_counts": [],
        "activation_counts": [],
        "app_usage_percentages": [],
        "churn_counts_per_month": [],
        "total_users": 0,
        "data_last_updated": datetime.now().isoformat()
    }


def _empty_return_analysis():
    return {
        "source_distribution": [],
        "defect_distribution": [],
        "warranty_status": [],
        "final_status": [],
        "responsible_party": []
    }

# AI Model Paths
MODEL_PATH = "best_churn_model.pkl" #Saved XGBoost Model
MLP_MODEL_PATH = "MLP_churn_model.pt" #Saved MLP Model
MLP_FEATURES_PATH = "trained_features_MLP.json" 
FEATURES_JSON_PATH = "tracked_features.json"

# Check environment
DB_ROW_LIMIT = get_row_limit()
DB_CONFIG = get_db_config()
TOTAL_TRIALS = int(os.getenv("XGB_TOTAL_TRIALS", 10))
MLP_TOTAL_EPOCHS = int(os.getenv("MLP_TOTAL_EPOCHS", 50))

engine = create_engine(
    f'postgresql://{DB_CONFIG["user"]}:{DB_CONFIG["password"]}@{DB_CONFIG["host"]}:{DB_CONFIG["port"]}/{DB_CONFIG["dbname"]}')



# =======================================================================================
# API Endpoints
# =======================================================================================

#Baseline api. 
@app.route('/')
def home():
    return "Churn Prediction API is running!"


# Health check endpoint for the frontend to verify server status 
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'version': '1.0.0',
        'server_time': datetime.now().isoformat()
    })

# =======================================================================================
# Model Loading Functions: Loads any existing models.
# =======================================================================================

# Loads the XGBoost Model - Still has comparison functionality for feature development
def load_model():
    # Check if there is even a model saved.
    if not os.path.exists(MODEL_PATH):
        logger.warning(
            "⚠ No trained model found. Please call /train_MLP_model before making predictions.")
        return None

    try:
        # Try loading as a Scikit-learn model
        model = joblib.load(MODEL_PATH)
        if isinstance(model, (BaseEstimator, XGBClassifier)):
            logger.info(
                f"✅ Scikit-learn model ({type(model).__name__}) loaded successfully.")
            return model

    except Exception as e:
        logger.warning(
            f"⚠ Joblib loading failed: {e}. Trying XGBoost format...")

    try:
        # If joblib fails, assume it's an XGBoost model
        model = XGBClassifier()
        model.load_model(MODEL_PATH)
        logger.info("✅ XGBoost model loaded successfully.")
        return model

    except Exception as e:
        logger.error(f"❌ Error loading model: {e}")
        return None


# Loads the MLP Model
def load_MLP_model():
    #Check if there even is a model
    if not os.path.exists(MLP_MODEL_PATH) or not os.path.exists(MLP_FEATURES_PATH):
        logging.warning("⚠ MLP model or feature list not found.")
        return None, []
    
    #Load Model
    with open(MLP_FEATURES_PATH, "r") as f:
        features = json.load(f)

    model = ChurnMLP(num_numeric_features=len(features))
    model.load_state_dict(torch.load(MLP_MODEL_PATH))
    model.eval()

    logging.info("✅ MLP model loaded successfully!")
    return model, features


# Route to clean up model files
@app.route('/cleanup_models', methods=['POST'])
def cleanup_models_route():
    from model_cleanup import cleanup_model_files
    result = cleanup_model_files()
    return jsonify(result)


# =======================================================================================
# Data Processing 
# =======================================================================================

# Runs data processing file (data_processing.py)
def process_file(input_path, output_path, mode):
    """
    Runs data_processing.py on the uploaded file to ensure proper formatting.
    - mode: "train" or "predict"
    """
    try:
        #For terminal debugging
        logger.info(
            f"Processing file: {input_path} in {mode} mode with data_processing.py...")
        
        #Call data processing file/
        subprocess.run(["python", "data_processing.py",
                       input_path, output_path, mode], check=True)

        logger.info("✅ File processed successfully.")
        return output_path 

    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Error processing file with data_processing.py: {e}")
        raise ValueError(
            "Failed to process file. Ensure data_processing.py runs correctly.")


# Intermediate function - processes the file and returns it in a pandas dataframe.
def load_data(file, mode):
    """
    Loads CSV or Excel file into a pandas DataFrame after processing.
    - mode: "train" or "predict"
    """
    try:
        temp_input_path = f"temp_{file.filename}"
        temp_output_path = f"processed_{file.filename}"

        file.save(temp_input_path)
        processed_file = process_file(
            temp_input_path, temp_output_path, mode)

        df = pd.read_csv(processed_file) 
        os.remove(temp_input_path)  

        return df

    except Exception as e:
        raise ValueError(f"Error processing file: {str(e)}")


# =======================================================================================
# Database Related APIs
# =======================================================================================

# Adds a prediction batch to the database.
def insert_predictions(df, upload_file, model_type):
    """Creates a prediction batch and inserts predictions under it."""
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    # Generate new batch ID
    cursor.execute("SELECT nextval('prediction_batch_seq');")
    prediction_batch_id = cursor.fetchone()[0]

    # Insert into prediction_batches table
    cursor.execute("""
        INSERT INTO prediction_batches (prediction_batch_id, upload_file, model_type)
        VALUES (%s, %s, %s);
    """, (prediction_batch_id, upload_file, model_type))

    # Insert predictions
    insert_query = """
    INSERT INTO predictions (
        prediction_batch_id, device_number, churn_probability, customer_number
    ) VALUES (%s, %s, %s, %s);
    """
    records = [
        (
            int(prediction_batch_id),
            int(float(row["device number"])),
            float(row["churn_probability"]),
            int(row["customer_number"])
        )
        for _, row in df.iterrows()
    ]

    execute_batch(cursor, insert_query, records)
    conn.commit()
    cursor.close()
    conn.close()

    logger.info(
        f"✅ Inserted {len(records)} predictions into batch {prediction_batch_id} using model {model_type}")
    return prediction_batch_id


# Adds device data to the Database.
def insert_or_update_devices(df, upload_file):
    try:
        # Connect to the database
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Fetch existing columns
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'devices';
        """)
        existing_schema = {row[0]: row[1] for row in cursor.fetchall()}

        # Process feature names
        df.columns = [
            col.lower()
            .strip()
            .replace(" ", "_")
            .replace("#", "num")
            .replace("/", "_")
            for col in df.columns
        ]

        # Ensure no remain NA values. 
        if 'churn' in df.columns:
            df['churn'] = df['churn'].fillna(0).astype(int).astype('Int64')
            print("✅ churn value counts just before DB insert:")
            print(df['churn'].value_counts(dropna=False))

        #Store metadata. 
        df['upload_file'] = upload_file
        df['upload_timestamp'] = datetime.utcnow()

        # Track new columns added
        new_columns_added = []

        # Dynamically add new columns to table if missing
        for col in df.columns:
            if col not in existing_schema:
                col_type = 'TEXT' 
                sample_val = df[col].dropna(
                ).iloc[0] if not df[col].dropna().empty else None
                if sample_val is not None:
                    if isinstance(sample_val, bool):
                        col_type = 'BOOLEAN'
                    elif isinstance(sample_val, (int, float)) and not isinstance(sample_val, bool):
                        col_type = 'FLOAT'
                    elif 'date' in col and pd.to_datetime(df[col], errors='coerce').notnull().any():
                        col_type = 'TIMESTAMP'
                cursor.execute(
                    f'ALTER TABLE devices ADD COLUMN "{col}" {col_type};')
                logger.info(f"🆕 Added new column to devices: {col}")
                new_columns_added.append(col)

        # 🔁 Refresh schema after adding columns
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'devices';
        """)
        existing_schema = {row[0]: row[1] for row in cursor.fetchall()}

        # If new columns were added, delete the current trained model to force retraining
        if new_columns_added and os.path.exists(MODEL_PATH):
            os.remove(MODEL_PATH)
            logger.warning(
                "🗑️ Deleted best_churn_model.pkl due to schema change (new features detected).")

        # Update feature tracking JSON
        if new_columns_added:
            try:
                if os.path.exists(FEATURES_JSON_PATH):
                    with open(FEATURES_JSON_PATH, "r") as f:
                        tracked_features = json.load(f)
                else:
                    tracked_features = []

                updated_features = sorted(
                    set(tracked_features + new_columns_added))
                with open(FEATURES_JSON_PATH, "w") as f:
                    json.dump(updated_features, f, indent=2)
                logger.info(
                    f"📦 Updated {FEATURES_JSON_PATH} with new features.")
            except Exception as e:
                logger.warning(
                    f"⚠️ Failed to update {FEATURES_JSON_PATH}: {e}")

        # Fetch existing data for imputation on new columns
        df_existing = pd.read_sql("SELECT * FROM devices;", conn)
        impute_values = {}

        for col in df.columns:
            if col not in df_existing.columns:
                continue

            non_nulls = df_existing[col].dropna()
            col_type = existing_schema.get(col)

            if non_nulls.empty:
                impute_values[col] = None
            elif df_existing[col].dtype == 'bool':
                impute_values[col] = bool(non_nulls.mode()[0])
            elif df_existing[col].dtype == 'object':
                impute_values[col] = str(non_nulls.mode()[0])
            elif 'date' in col and pd.to_datetime(non_nulls, errors='coerce').notnull().any():
                impute_values[col] = pd.to_datetime(
                    non_nulls, errors='coerce').mode()[0]
            else:
                impute_values[col] = non_nulls.mean()

        for col, value in impute_values.items():
            if col in df.columns:
                if value is not None:
                    df[col] = df[col].fillna(value)
                else:
                    df[col] = df[col].where(pd.notnull(df[col]), None)

        df = df.where(pd.notnull(df), None)

        insert_columns = list(df.columns)
        insert_query = f"""
        INSERT INTO devices ({', '.join(insert_columns)})
        VALUES ({', '.join(['%s'] * len(insert_columns))})
        ON CONFLICT (device_number) DO UPDATE SET
        {', '.join([f'{col} = EXCLUDED.{col}' for col in insert_columns if col != 'device_number'])};
        """

        execute_batch(cursor, insert_query, df[insert_columns].values.tolist())
        conn.commit()

        cursor.execute("SELECT COUNT(*) FROM devices;")
        count_after = cursor.fetchone()[0]
        print(f"✅ Rows after insertion: {count_after}")

        cursor.close()
        conn.close()
        logger.info("✅ Data inserted/updated successfully.")

    except psycopg2.OperationalError as e:
        logger.warning(
            f"⚠️ Database connection failed: {e}. Continuing without database update.")
    except Exception as e:
        logger.warning(
            f"⚠️ Error in database operation: {e}. Continuing without database update.")


# Returns a list of predictions 
@app.route('/predictions', methods=['GET'])
def get_prediction_batches_with_predictions():
    """
    Returns predictions grouped by batch ID.
    - If 'batch_id' is specified: returns predictions for that batch only.
    - Else: returns the latest N prediction batches (default N=5).
    """
    try:
        batch_id = request.args.get('batch_id')
        limit = int(request.args.get('limit', 5))
        offset = int(request.args.get('offset', 0))

        # Connect to database. 
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        if batch_id:
            # Fetch only the specified batch
            cursor.execute("""
                SELECT prediction_batch_id, upload_file, model_type, prediction_date
                FROM prediction_batches
                WHERE prediction_batch_id = %s;
            """, (int(batch_id),))
        else:
            # Fetch a list of recent batches
            cursor.execute("""
                SELECT prediction_batch_id, upload_file, model_type, prediction_date
                FROM prediction_batches
                ORDER BY prediction_date DESC
                LIMIT %s OFFSET %s;
            """, (limit, offset))

        batches_meta = cursor.fetchall()
        raw_batches = []

        # Get data and format it for the frontend. 
        for b_id, upload_file, model_type, prediction_date in batches_meta:
            cursor.execute("""
                SELECT device_number, churn_probability, customer_number
                FROM predictions
                WHERE prediction_batch_id = %s;
            """, (b_id,))

            prediction_rows = cursor.fetchall()

            batch_data = [
                {
                    "device_number": int(d),
                    "churn_probability": float(p),
                    "customer_number": int(c)
                }
                for d, p, c in prediction_rows
            ]

            raw_batches.append((b_id, {
                "model_type": model_type,
                "upload_file": upload_file,
                "prediction_date": prediction_date.isoformat(),
                "predictions": batch_data
            }))

        cursor.close()
        conn.close()

        sorted_batches = OrderedDict(
            sorted(raw_batches, key=lambda x: x[0], reverse=True)
        )

        return jsonify(sorted_batches)

    except psycopg2.OperationalError as e:
        logger.warning(f"⚠️ DB unavailable for /predictions, returning empty result: {e}")
        return jsonify({})
    except Exception as e:
        logger.error(f"❌ Error fetching predictions: {e}")
        return jsonify({"error": str(e)}), 500


# Method to create processed features table for data vizualizations
def create_processed_features_table(df, table_name="processed_features", overwrite=False):
    
    # Mapping of element type. 
    dtype_map = {
        'int64': 'INTEGER',
        'float64': 'FLOAT',
        'bool': 'BOOLEAN',
        'object': 'TEXT'
    }

    column_defs = []

    #Create table
    for col, dtype in df.dtypes.items():
        pg_type = dtype_map.get(str(dtype), 'TEXT')
        col_clean = col.lower().strip().replace(" ", "_").replace("#", "num")
        column_defs.append(f'"{col_clean}" {pg_type}')

    column_defs.append("upload_file TEXT")
    column_defs.append("created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

    columns_sql = ",\n  ".join(column_defs)
    create_stmt = f"""
    {"DROP TABLE IF EXISTS " + table_name + ";" if overwrite else ""}
    CREATE TABLE IF NOT EXISTS {table_name} (
      id SERIAL PRIMARY KEY,
      {columns_sql}
    );
    """

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute(create_stmt)
    conn.commit()
    cursor.close()
    conn.close()

    print(
        f"✅ Table `{table_name}` ready with {len(df.columns)} columns (+ metadata).")


# Stores processed feature names for the data vizualizations
def insert_processed_features(df, upload_file, table_name="processed_features"):
    
    df_copy = df.copy() # Make a copy to not change original file
    df_copy.columns = [col.lower().strip().replace(
        " ", "_").replace("#", "num") for col in df_copy.columns]

    df_copy['upload_file'] = upload_file

    cols = list(df_copy.columns)
    placeholders = ", ".join(["%s"] * len(cols))
    col_str = ", ".join([f'"{col}"' for col in cols])

    insert_stmt = f"""
    INSERT INTO {table_name} ({col_str})
    VALUES ({placeholders});
    """

    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    execute_batch(cursor, insert_stmt, df_copy.values.tolist())
    conn.commit()
    cursor.close()
    conn.close()

    print(f"✅ Inserted {len(df_copy)} rows into `{table_name}`.")


# Deletes a set of predictions from the database. 
@app.route('/delete_prediction_batch/<int:batch_id>', methods=['DELETE'])
def delete_prediction_batch(batch_id):
    """Deletes a prediction batch and all its associated predictions + metadata."""
    try:
        #Connect to the database. 
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Check if the batch exists
        cursor.execute(
            "SELECT COUNT(*) FROM predictions WHERE prediction_batch_id = %s;", (batch_id,))
        count = cursor.fetchone()[0]

        if count == 0:
            # Check if batch metadata exists
            cursor.execute(
                "SELECT COUNT(*) FROM prediction_batches WHERE prediction_batch_id = %s;", (batch_id,))
            batch_exists = cursor.fetchone()[0]
            if batch_exists:
                cursor.execute(
                    "DELETE FROM prediction_batches WHERE prediction_batch_id = %s;", (batch_id,))
                conn.commit()
                cursor.close()
                conn.close()
                return jsonify({"message": f"✅ Deleted empty batch metadata for ID {batch_id}."}), 200
            return jsonify({"error": f"No predictions or batch found for ID {batch_id}."}), 404

        # Delete the predictions
        cursor.execute(
            "DELETE FROM predictions WHERE prediction_batch_id = %s;", (batch_id,))
        # Delete the batch metadata
        cursor.execute(
            "DELETE FROM prediction_batches WHERE prediction_batch_id = %s;", (batch_id,))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({
            "message": f"✅ Deleted batch ID {batch_id} with {count} predictions."
        }), 200

    except Exception as e:
        logger.error(f"❌ Error deleting batch {batch_id}: {e}")
        return jsonify({"error": str(e)}), 500


# Deletes all predictions from database. 
@app.route('/delete_all_predictions', methods=['DELETE'])
def delete_all_predictions():
    """Deletes all prediction batches and their associated predictions."""
    try:
        #Connect to database.
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Get count of predictions before deletion
        cursor.execute("SELECT COUNT(*) FROM predictions;")
        prediction_count = cursor.fetchone()[0]

        # Get count of batches before deletion
        cursor.execute("SELECT COUNT(*) FROM prediction_batches;")
        batch_count = cursor.fetchone()[0]

        # Delete all predictions
        cursor.execute("DELETE FROM predictions;")
        # Delete all batch metadata
        cursor.execute("DELETE FROM prediction_batches;")
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({
            "message": f"✅ Deleted all {batch_count} batches with {prediction_count} predictions."
        }), 200

    except Exception as e:
        logger.error(f"❌ Error deleting all predictions: {e}")
        return jsonify({"error": str(e)}), 500


# Complete reset of training tables
@app.route("/reset_all", methods=["POST"])
def reset_all():
    try:
        with open("xgb_training_progress.json", "w") as f:  
            json.dump({"status": "not_started", "current_trial": 0, "total_trials": TOTAL_TRIALS}, f) 
        with open("mlp_training_progress.json", "w") as f:
            json.dump({"status": "not_started", "current_epoch": 0, "total_epochs": MLP_TOTAL_EPOCHS}, f)

        # Delete saved training files. 
        model_files = ["best_churn_model.pkl", "MLP_churn_model.pt", "trained_features.json", "trained_features_MLP.json", "MLP_metrics.json", "model_metrics.json", "MLP_importance.json", "processed_churn_data.csv", "MLP_training_success_token.txt", "XGB_training_success_token.txt"]
        for f in model_files:
            if os.path.exists(f):
                os.remove(f)
                logger.info(f"🗑️ Deleted model file: {f}")

        # Clear database tables
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Drop tables
        cur.execute("DROP TABLE IF EXISTS devices CASCADE;")
        cur.execute("DROP TABLE IF EXISTS processed_features CASCADE;")
        conn.commit()

        # Recreate base device` table
        cur.execute("""
            CREATE TABLE devices (
                device_number BIGINT PRIMARY KEY,
                churn INTEGER,
                upload_file VARCHAR(100) NOT NULL
            );

        """)

        # Recreate base processed_features table
        cur.execute("""
            CREATE TABLE processed_features (
                id SERIAL PRIMARY KEY,
                upload_file TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"message": "All models and data reset successfully."}), 200
    except Exception as e:
        return jsonify({"error": "Failed to reset all.", "details": str(e)}), 500




# =======================================================================================
# Predict Churn
# =======================================================================================

# Predict churners in a dataset using XGBoost. 
@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    model = load_model() # Load XGBoost model
    
    # XGBoost not yet trained.
    if model is None:
        return jsonify({"error": "⚠ No trained model found. Please call /train_MLP_model first."}), 500
    try:
        # Process dataset for model specifications
        file = request.files['file']
        df = load_data(file, "predict")  # Process in predict mode
        df = df.drop(columns=['num__churn'], errors='ignore')

        # Load stored features that were used in training. 
        trained_features_path = "trained_features.json"
        if os.path.exists(trained_features_path):
            with open(trained_features_path, "r") as f:
                trained_features = json.load(f)

            # Add missing required columns for inference.
            for col in trained_features:
                if col not in df.columns:
                    df[col] = 0 

            # Drop any extra columns not in trained features
            extra_cols = set(df.columns) - set(trained_features)
            if extra_cols:
                print(
                    f"⚠️ Dropping extra columns not seen during training: {extra_cols}")
                df.drop(columns=extra_cols, inplace=True)

            # ⚠ Reorder to match training order exactly
            df = df[trained_features]
        else:
            print("⚠️ trained_features.json not found — skipping alignment.")

        # Load stored device numbers and reattach them before prediction
        if os.path.exists("temp_device_numbers.csv"):
            df_device_numbers = pd.read_csv("temp_device_numbers.csv")
            os.remove("temp_device_numbers.csv")  
        else:
            df_device_numbers = None  # Handle case where the file is missing

        # Make predictions based on model type
        if isinstance(model, XGBClassifier):
            predictions_proba = model.predict_proba(df)[:, 1]  # XGBoost method
        else:
            predictions_proba = model.predict_proba(
                df)[:, 1]  # Scikit-learn method

        # Attach predictions
        df["churn_probability"] = predictions_proba.tolist()
        df["customer_number"] = range(1, len(df) + 1)

        #  Reattach device_number to ensure rows match original input
        if df_device_numbers is not None:
            df_device_numbers.columns = ["device number"]
            df = pd.concat([df_device_numbers, df], axis=1)

        logger.info("🔎 FINAL COLUMNS AFTER MERGING:\n" +
                    "\n📌 ".join([""] + list(df.columns)))
        # Store predictions and get batch ID
        batch_id = insert_predictions(df, file.filename, "xgboost")
        return jsonify({
            "predictions": df.to_dict(orient='records'),
            "batch_id": batch_id
        })

    except ValueError as e:
        logger.error(f"❌ {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"❌ Error processing batch prediction request: {e}")
        return jsonify({"error": str(e)}), 500


# Predict churners in a dataset using MLP
@app.route('/predict_batch_MLP', methods=['POST'])
def predict_batch_MLP():
    MLP_model, trained_features = load_MLP_model() # Load model
    
    # No model - cannot predict.
    if MLP_model is None:
        return jsonify({"error": "⚠ No trained MLP model found. Please call /train_MLP_model first."}), 500
    try:
        # Process data to ensure expected format. 
        file = request.files['file']
        df = load_data(file, "predict")  # Process in "predict" mode
        df = df.drop(columns=['num__churn'], errors='ignore')

        # Load features used in training. 
        trained_features_path = "trained_features_MLP.json"
        if os.path.exists(trained_features_path):
            with open(trained_features_path, "r") as f:
                trained_features = json.load(f)

            # Add required missing columns
            for col in trained_features:
                if col not in df.columns:
                    df[col] = 0 

            # Drop any extra columns not in trained features
            extra_cols = set(df.columns) - set(trained_features)
            if extra_cols:
                print(
                    f"⚠️ Dropping extra columns not seen during training: {extra_cols}")
                df.drop(columns=extra_cols, inplace=True)

            # Reorder to match training order exactly
            df = df[trained_features]
        else:
            print("⚠️ trained_features_MLP.json not found — skipping alignment.")

        #  Load stored device numbers and reattach them before prediction
        if os.path.exists("temp_device_numbers.csv"):
            df_device_numbers = pd.read_csv("temp_device_numbers.csv")
            os.remove("temp_device_numbers.csv") 
        else:
            df_device_numbers = None 
            
        # Only keep numerical columns (those that start with "num__")
        df = df[[col for col in df.columns if col.startswith("num__")]]

        logger.info(f"📋 Data columns going into MLP:\n{df.columns.tolist()}")

        # Log the number of expected inputs
        logger.info(
            f"📐 MLP input layer expects: {MLP_model.input.in_features} features")

        # Make predictions
        predictions_proba = MLP_model.predict_proba(df)

        # Attach predictions
        df["churn_probability"] = predictions_proba.tolist()
        df["customer_number"] = range(1, len(df) + 1)

        # Reattach `device_number` to ensure rows match original input
        if df_device_numbers is not None:
            df_device_numbers.columns = ["device number"]
            df = pd.concat([df_device_numbers, df], axis=1)

        batch_id = insert_predictions(df, file.filename, model_type="MLP")
        return jsonify({
            "predictions": df.to_dict(orient='records'),
            "batch_id": batch_id
        })

    except ValueError as e:
        logger.error(f"❌ {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"❌ Error processing batch prediction request: {e}")
        return jsonify({"error": str(e)}), 500


# =======================================================================================
# Train the Models
# =======================================================================================

# Check if XGBoost has been trained yet.
@app.route('/check_model', methods=['GET'])
def check_model():
    """Checks if the best_churn_model.pkl file exists."""
    model_exists = os.path.exists(MODEL_PATH)
    return jsonify({"model_exists": model_exists})


# Check if MLP has been trained yet.
@app.route('/check_MLP_model', methods=['GET'])
def check_MLP_model():
    """Checks if the MLP_churn_model.pkl file exists."""
    model_exists = os.path.exists(MLP_MODEL_PATH)
    return jsonify({"model_exists": model_exists})


#Helper function for arabic timestamps - converts to date time format. 
def normalize_arabic_digits(val):
    if isinstance(val, str):
        return val.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
    return val


# Resets all training metrics
@app.route('/delete_old_metrics', methods=['POST'])
def delete_old_metrics():
    try:
        # XGBoost files
        if os.path.exists("model_metrics.json"):
            os.remove("model_metrics.json")
            logger.info("🗑️ Deleted old model_metrics.json")

        if os.path.exists("XGB_training_success_token.txt"):
            os.remove("XGB_training_success_token.txt")
            logger.info("🗑️ Deleted old XGB_training_success_token.txt")
        
        with open("xgb_training_progress.json", "w") as f:  
            json.dump({"status": "not_started", "current_trial": 0, "total_trials": TOTAL_TRIALS}, f) 
            
        # MLP files
        if os.path.exists("MLP_metrics.json"):
            os.remove("MLP_metrics.json")
            logger.info("🗑️ Deleted old MLP_metrics.json")

        if os.path.exists("MLP_training_success_token.txt"):
            os.remove("MLP_training_success_token.txt")
            logger.info("🗑️ Deleted old MLP_training_success_token.txt")
        

        return jsonify({"message": "✅ Old training artifacts deleted."}), 200

    except Exception as e:
        logger.error(f"❌ Failed to delete old metrics: {e}")
        return jsonify({"error": str(e)}), 500


#Train XGBoost in background thread
@app.route('/train_model', methods=['POST'])
def train_model():
    if os.path.exists("xgb_training_progress.json"):
        with open("xgb_training_progress.json", "r") as f:
            status = json.load(f).get("status", "not_started")
        if status == "in_progress":
            return jsonify({"message": "XGBoost training already in progress."}), 202

    # Mark training as started
    with open("xgb_training_progress.json", "w") as f:
        json.dump({"status": "in_progress", "current_trial": 0, "total_trials": TOTAL_TRIALS}, f)

    """Handles XGBoost model training using a background thread."""
    
    # Store file data into the database. 
    try:
        file = request.files['file']
        df_raw = pd.read_csv(file)
        
        # Process feature names 
        df_raw.columns = df_raw.columns.str.lower().str.strip().str.replace(" ", "_")
        if "product/model_#" in df_raw.columns:
            df_raw.rename(columns={"product/model_#": "product_model"}, inplace=True)
                          
        #Process data for database insertion
        for col in df_raw.columns:
            if 'date' in col.lower():
                df_raw[col] = df_raw[col].apply(normalize_arabic_digits)
                df_raw[col] = pd.to_datetime(df_raw[col], errors="coerce")
                df_raw[col] = df_raw[col].dt.strftime('%Y-%m-%d %H:%M:%S')
                df_raw[col] = df_raw[col].replace({np.nan: None})

        for col in ['promotion_email', 'register_email']:
            if col in df_raw.columns:
                df_raw[col] = pd.to_numeric(
                    df_raw[col], errors='coerce').fillna(0).astype(int)

        try:
            insert_or_update_devices(df_raw, file.filename)
        except Exception as db_error:
            logger.warning(f"⚠️ DB update failed: {db_error}")

        # Store processed features too for feature heatmap. 
        file.seek(0)
        df = load_data(file, "train")
        create_processed_features_table(df, overwrite=True)
        insert_processed_features(df, upload_file=file.filename)
        logger.info("Stored Data in database!")

        def run_training():
            try:
                # Train XGBoost on processed data from the database.
                input_path = "from_db"
                output_path = "processed_churn_data.csv"
                subprocess.run(["python", "data_processing.py", input_path, output_path, "train"], check=True) #Process data
                df = pd.read_csv(output_path)
                
                # Churn column required
                if 'churn' not in df.columns:
                    with open("xgb_training_progress.json", "w") as f:
                        json.dump({"status": "error", "current_trial": 0, "total_trials": TOTAL_TRIALS}, f)
                    return

                subprocess.run(["python", "train.py", output_path], check=True)

                # Poll for end of training. 
                timeout = 600  # seconds
                start_time = time.time()

                while not os.path.exists("XGB_training_success_token.txt"):
                    if time.time() - start_time > timeout:
                        raise TimeoutError("Training token not created within timeout.")
                    time.sleep(2)  # wait 2 seconds and check again
                  
                #Training done.   
                _ = load_model()
                
                # Signal Frontend. 
                if os.path.exists("XGB_training_success_token.txt") and os.path.exists("model_metrics.json"):
                    with open("model_metrics.json", "r") as f:
                        metrics = json.load(f)
                    with open("xgb_training_progress.json", "w") as f:
                        json.dump({"status": "completed", "current_trial": TOTAL_TRIALS, "total_trials": TOTAL_TRIALS}, f)
                else:
                    with open("xgb_training_progress.json", "w") as f:
                        json.dump({"status": "error", "current_trial": 0, "total_trials": TOTAL_TRIALS}, f)

            except Exception as e:
                logger.error(f"❌ XGBoost training failed: {e}")
                with open("xgb_training_progress.json", "w") as f:
                    json.dump({"status": "error", "current_trial": 0, "total_trials": TOTAL_TRIALS}, f)

        # Start background thread and return immediately
        thread = threading.Thread(target=run_training)
        thread.start()

        return jsonify({"message": "🚀 XGBoost training started."}), 202

    except Exception as e:
        logger.error(f"❌ Unexpected error starting XGBoost training: {e}")
        return jsonify({"error": str(e)}), 500


# Train the MLP Model in background thread
@app.route('/train_MLP_model', methods=['POST'])
def train_MLP_model():
    if os.path.exists("mlp_training_progress.json"):
        with open("mlp_training_progress.json", "r") as f:
            status = json.load(f).get("status", "not_started")
        if status == "in_progress":
            return jsonify({"message": "MLP training already in progress."}), 202

    # Mark training as started
    with open("mlp_training_progress.json", "w") as f:
        json.dump({"status": "in_progress", "current_epoch": 0, "total_epochs": MLP_TOTAL_EPOCHS}, f)


    def run_training():
        try:
            # Train the model with processed database data. 
            input_path = "from_db"
            output_path = "processed_churn_data.csv"
            mode = "train"
            
            subprocess.run(["python", "data_processing.py", input_path, output_path, mode], check=True)

            df = pd.read_csv(output_path)
            if 'churn' not in df.columns:
                return

            logger.info("🚀 Starting MLP training process...")
            subprocess.run(["python", "MLP1.py", output_path], check=True)
            logger.info("✅ MLP training complete. Reloading new model...")
            
            # Poll for end of training.
            timeout = 600
            start_time = time.time()
            
            while not os.path.exists("MLP_training_success_token.txt"):
                if time.time() - start_time > timeout:
                    raise TimeoutError("Training token not created within timeout.")
                time.sleep(2)
                
            # Training done - calculate feature importance and save model and metrics
            app.config["MLP_model"], _ = load_MLP_model()
            subprocess.Popen(["python", "compute_feature_importances_MLP.py"])
            metrics_file = "MLP_metrics.json"
            
            # Signal to frontend end of training. 
            if os.path.exists("MLP_training_success_token.txt") and os.path.exists(metrics_file):
                with open(metrics_file, "r") as f:
                    metrics = json.load(f)
            else:
                logger.error(f"❌ MLP training failed: {e}")

        except Exception as e:
            logger.error(f"❌ MLP training failed: {e}")

    # Initialize training status and start background thread
    thread = threading.Thread(target=run_training)
    thread.start()
    
    return jsonify({"message": "🚀 MLP training started."}), 202


#Returns the status of training for the XGboost. Used by the frontend polling system. 
@app.route('/training_status_XGB', methods=['GET'])
def training_status_XGB():
    try:
        with open("xgb_training_progress.json", "r") as f:
            progress = json.load(f)
        
        if progress.get("status") == "completed":
            with open("model_metrics.json", "r") as f:
                metrics = json.load(f)
            return jsonify({"status": "completed", "metrics": metrics})
        
        return jsonify(progress)
    
    except FileNotFoundError:
        return jsonify({"status": "not_started"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})



#Returns the status of training for the MLP. Used by the frontend polling system. 
@app.route('/training_status_MLP', methods=['GET'])
def training_status_MLP():
    try:
        with open("mlp_training_progress.json", "r") as f:
            progress = json.load(f)
        
        if progress.get("status") == "completed":
            with open("MLP_metrics.json", "r") as f:
                metrics = json.load(f)
            return jsonify({"status": "completed", "metrics": metrics})
        
        return jsonify(progress)
    
    except FileNotFoundError:
        return jsonify({"status": "not_started"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})



#Returns metrics from the XGBoost Model.
@app.route('/model_metrics', methods=['GET'])
def return_model_metrics():
        metrics_file = "model_metrics.json"
        if os.path.exists(metrics_file):
            with open(metrics_file, "r") as f:
                metrics = json.load(f)
        else:
            metrics = {"error": "Metrics file not found."}

        return jsonify({
            "message": "✅ Model Metrics Found.",
            "metrics": metrics
        }), 200


#Returns metrics from the MLP model.
@app.route('/MLP_metrics', methods=['GET'])
def return_MLP_metrics():
        metrics_file = "MLP_metrics.json"
        if os.path.exists(metrics_file):
            with open(metrics_file, "r") as f:
                metrics = json.load(f)
        else:
            metrics = {"error": "Metrics file not found."}

        return jsonify({
            "message": "✅ Model Metrics MLP Found.",
            "metrics": metrics
        }), 200
        
  
#For frontend estimated training time calculations.
@app.route('/count_devices', methods=['GET'])
def count_devices():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM devices;')
    count = cur.fetchone()[0]
    cur.close()
    conn.close()
    return jsonify({"row_count": count})


#For frontend estimated training time calculations.
@app.route('/config', methods=['GET'])
def get_config():
    return {
        "db_row_limit": DB_ROW_LIMIT
    }

# For Real-time progress bar. 
@app.route('/training_progress_XGB', methods=['GET'])
def training_progress_xgb():
    try:
        with open("xgb_training_progress.json", "r") as f:
            progress = json.load(f)
        return jsonify(progress), 200
    except Exception:
        return jsonify({"current_trial": 0, "total_trials": 0}), 200


# For Real-time progress bar. 
@app.route('/training_progress_MLP', methods=['GET'])
def training_progress_mlp():
    try:
        with open("mlp_training_progress.json", "r") as f:
            progress = json.load(f)
        return jsonify(progress), 200
    except Exception:
        return jsonify({"current_epoch": 0, "total_epochs": 0}), 200




# =======================================================================================
# Feature Importance
# =======================================================================================

# Function to format feature names consistently
def format_feature_name(feature):
    # Remove prefix (num__, cat__, etc.)
    formatted = feature.replace('num__', '').replace(
        'cat__', '').replace('bool__', '')

    # Replace underscores with spaces
    formatted = formatted.replace('_', ' ')

    # Capitalize each word
    formatted = ' '.join(word.capitalize() for word in formatted.split())

    # Special cases
    formatted = formatted.replace('Sim Info', 'Number of Sim')
    formatted = formatted.replace('Product Model Encoded', 'Product Model')

    return formatted

# XGBoost Feature Importance
@app.route('/feature_importance', methods=['GET'])
def feature_importance():
    model = load_model()  #Reload the latest model

    # No model
    if model is None:
        return jsonify({"error": "No trained model found. Please call /train_model first."}), 500

    try:
        if isinstance(model, XGBClassifier):
            importance = model.feature_importances_
            feature_names = model.get_booster().feature_names
            
            #Fallback
            if feature_names is None:
                feature_names = [
                    "Number of Sim",
                    "Promotion Email",
                    "Register Email",
                    "Days Since Activation",
                    "Days Since Last Use",
                    "Days Used Since Activation",
                    "Product Model"
                ]
        elif hasattr(model, "feature_importances_"):
            importance = model.feature_importances_
            feature_names = getattr(model, "feature_names_in_", [
                "Number of Sim",
                "Promotion Email",
                "Register Email",
                "Days Since Activation",
                "Days Since Last Use",
                "Days Used Since Activation",
                "Product Model"
            ])
        else:
            return jsonify({"error": "❌ Model does not support feature importance extraction."}), 400

        # Sort features by importance
        importance_dict = sorted(
            zip(feature_names, importance), key=lambda x: x[1], reverse=True)

        # Apply the dynamic formatting to feature names
        mapped_importance_dict = [
            (format_feature_name(f), i) for f, i in importance_dict
        ]

        return jsonify({
            "feature_importance": [{"feature": f, "importance": float(i)} for f, i in mapped_importance_dict]
        })

    except Exception as e:
        logger.error(f"❌ Error retrieving feature importance: {e}")
        return jsonify({"error": str(e)}), 500


# MLP Feature Importance 
@app.route('/feature_importance_MLP', methods=['GET'])
def feature_importance_MLP():
    try:
        with open("MLP_importance.json", "r") as f:
            importance = json.load(f)

        # Apply the dynamic formatting to feature names
        importance_dict = {
            format_feature_name(k): v for k, v in importance.items()
        }

        return jsonify({
            "feature_importance": [{"feature": f, "importance": float(i)} for f, i in importance_dict.items()]
        })

    except Exception as e:
        logger.error(f"❌ Error retrieving feature importance: {e}")
        return jsonify({"error": str(e)}), 500




# =======================================================================================
# API Endpoint for Dashboard Data 
# =======================================================================================

# Inserts the dashboard data into the database. 
def insert_dashboard_data(df, upload_file):
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    # Fetch existing columns
    cursor.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'dashboard_devices';
    """)
    existing_cols = {row[0] for row in cursor.fetchall()}

    # Lowercase and sanitize column names
    df.columns = df.columns.str.lower().str.strip()\
        .str.replace(" ", "_")\
        .str.replace("/", "_")\
        .str.replace("#", "num")\
        .str.replace("(", "")\
        .str.replace(")", "")\
        .str.replace("-", "_") 

    # Add missing columns dynamically
    for col in df.columns:
        if col not in existing_cols:
            cursor.execute(f'ALTER TABLE dashboard_devices ADD COLUMN "{col}" TEXT;')
            print(f"🆕 Added new column to dashboard_devices: {col}")

    # Attach metadata
    df['upload_file'] = upload_file
    df['upload_timestamp'] = datetime.utcnow()

    insert_cols = list(df.columns)
    placeholders = ", ".join(["%s"] * len(insert_cols))
    col_str = ", ".join([f'"{col}"' for col in insert_cols])

    insert_stmt = f"""
        INSERT INTO dashboard_devices ({col_str})
        VALUES ({placeholders})
        ON CONFLICT (device_number) DO UPDATE SET
        {', '.join([f'{col} = EXCLUDED.{col}' for col in insert_cols if col != 'device_number'])};
    """

    execute_batch(cursor, insert_stmt, df.values.tolist())
    conn.commit()
    cursor.close()
    conn.close()


# Upload dashboard data to the database
@app.route('/upload_dashboard_data', methods=['POST'])
def upload_dashboard_data():
    """Uploads a dashboard file and inserts the data dynamically."""
    try:
        # Check if valid
        file = request.files['file']
        if not file:
            return jsonify({"error": "No file uploaded."}), 400

        # Save temporary file
        temp_path = f"temp_dashboard_{file.filename}"
        file.save(temp_path)

        # Load into DataFrame
        if temp_path.endswith('.xls') or temp_path.endswith('.xlsx'):
            df = pd.read_excel(temp_path)
        else:
            df = pd.read_csv(temp_path)

        # Insert data dynamically
        insert_dashboard_data(df, file.filename)

        # Cleanup temp
        os.remove(temp_path)

        logger.info(f"✅ Dashboard file {file.filename} uploaded and inserted.")
        return jsonify({"message": f"✅ Dashboard data uploaded successfully: {file.filename}"}), 200

    except Exception as e:
        logger.error(f"❌ Error uploading dashboard data: {e}")
        return jsonify({"error": str(e)}), 500


# Calculates app usage of devices for frontend graphs
def calculate_app_usage_percentages(df: pd.DataFrame, column_name: str) -> List[Dict[str, Any]]:
    """
    Calculates app usage percentages across all users based on a time-based string format.
    Example format per row: "Facebook 120s, Instagram 300s"
    """
    try:
        app_usage = {}

        if column_name not in df.columns:
            logger.warning(f"⚠️ Column '{column_name}' not found in DataFrame.")
            return []

        # Make sure the column is string type to avoid parsing errors
        df[column_name] = df[column_name].astype(str).replace('nan', '').fillna('')

        for entry in df[column_name]:
            if not entry or not isinstance(entry, str) or entry.strip() == '':
                continue

            try:
                apps = [app.strip() for app in entry.split(",") if app.strip()]
                for app in apps:
                    parts = app.rsplit(" ", 1)  # Try to split into app name and usage time
                    if len(parts) != 2:
                        continue  # Skip malformed entries

                    app_name, time_str = parts
                    time_str = time_str.rstrip("s")  # Remove 's' if present
                    time = int(time_str)

                    if app_name:
                        app_usage[app_name] = app_usage.get(app_name, 0) + time

            except Exception as e:
                logger.warning(f"⚠️ Error processing app usage entry '{entry}': {e}")
                continue

        total_usage_time = sum(app_usage.values())

        if total_usage_time == 0:
            return []

        return [
            {
                "app": app,
                "percentage": round((time / total_usage_time) * 100, 2),
                "total_time": time
            }
            for app, time in sorted(app_usage.items(), key=lambda x: x[1], reverse=True)
        ]

    except Exception as e:
        logger.error(f"❌ Critical error calculating app usage percentages: {e}")
        return []


# Extracts and returns dashboard data from the database for four of the graphs. 
@app.route('/dashboard_data', methods=['GET'])
def get_dashboard_data():
    """Dynamically extracts dashboard metrics from the database."""
    try:
        #Connect to the database. 
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Check if the table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'dashboard_devices'
            );
        """)
        table_exists = cursor.fetchone()[0]

        # No data
        if not table_exists:
            conn.close()
            return jsonify(_empty_dashboard_metrics())

        # Query
        df = pd.read_sql("SELECT * FROM dashboard_devices", conn)
        conn.close()

        # No data
        if df.empty:
            return jsonify(_empty_dashboard_metrics())

        # Return structure
        dashboard_metrics = {
            "age_range_counts": [],
            "activation_counts": [],
            "app_usage_percentages": [],
            "churn_counts_per_month": [],
            "total_users": len(df),
            "data_last_updated": datetime.now().isoformat()
        }

        ## ======== CHURN ANALYSIS ========
        if "office_date" in df.columns and "churn" in df.columns:
            df['office_date'] = pd.to_datetime(df['office_date'], errors='coerce')
            df['churn'] = pd.to_numeric(df['churn'], errors='coerce').fillna(0).astype(int)
            df['churn_month'] = df['office_date'].dt.to_period("M").astype(str)

            churn_counts = (
                df[df['churn'] == 1]['churn_month']
                .value_counts()
                .sort_index()
                .items()
            )

            dashboard_metrics["churn_counts_per_month"] = [
                {
                    "month": month,
                    "churn_count": int(count),
                    "churn_rate": round((count / len(df)) * 100, 2)
                }
                for month, count in churn_counts
            ]

        ## ======== AGE RANGE DISTRIBUTION ========
        if "age_range" in df.columns:
            age_counts = (
                df['age_range']
                .value_counts()
                .sort_index()
                .items()
            )

            dashboard_metrics["age_range_counts"] = [
                {
                    "range": age_range,
                    "count": int(count),
                    "percentage": round((count / len(df)) * 100, 2)
                }
                for age_range, count in age_counts
            ]

        ## ======== ACTIVATION COUNTS ========
        if "activate_date" in df.columns:
            df['activate_date'] = pd.to_datetime(df['activate_date'], errors='coerce')
            df['activation_month'] = df['activate_date'].dt.to_period("M").astype(str)

            activation_counts_raw = df['activation_month'].value_counts().sort_index()
            activation_counts = []
            prev_count = None

            for month, count in activation_counts_raw.items():
                if prev_count is None or prev_count == 0:
                    growth_rate = 0
                else:
                    growth_rate = round((count - prev_count) / prev_count * 100, 2)

                activation_counts.append({
                    "month": month,
                    "count": int(count),
                    "growth_rate": growth_rate
                })
                prev_count = count

            dashboard_metrics["activation_counts"] = activation_counts

        ## ======== APP USAGE ANALYSIS ========
        if "app_usage_s" in df.columns:
            dashboard_metrics["app_usage_percentages"] = calculate_app_usage_percentages(df, "app_usage_s")

        return jsonify(dashboard_metrics)

    except psycopg2.OperationalError as e:
        logger.warning(f"⚠️ DB unavailable for /dashboard_data, returning empty metrics: {e}")
        return jsonify(_empty_dashboard_metrics())
    except Exception as e:
        logger.error(f"❌ Error extracting dashboard data: {e}")
        return jsonify({"error": str(e)}), 500


# Delete dashboard data. 
@app.route('/reset_dashboard_data', methods=['POST'])
def reset_dashboard_data():
    try:
        #Connect with database
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Drop the dashboard_devices table
        cur.execute("DROP TABLE IF EXISTS dashboard_devices CASCADE;")
        conn.commit()

        # Recreate dashboard_devices table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS dashboard_devices (
                id SERIAL PRIMARY KEY,
                device_number BIGINT UNIQUE,
                upload_file TEXT,
                upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"success": True, "message": "Dashboard reset successfully."}), 200

    except Exception as e:
        print(f"Error resetting dashboard: {e}")
        return jsonify({"error": str(e)}), 500




# =======================================================================================
# Correlation Matrix
# =======================================================================================
@app.route('/correlation_matrix', methods=['GET'])
def correlation_matrix():
    """Returns the correlation matrix for numerical columns from the database."""
    try:
        # Connect to the PostgreSQL database
        conn = psycopg2.connect(**DB_CONFIG)
        df = pd.read_sql("SELECT * FROM devices", conn)  # or 'dashboard_devices' if that's your source
        conn.close()

        # Identify numerical columns
        numeric_cols = df.select_dtypes(include=["float64", "int64"]).columns.tolist()

        if not numeric_cols:
            return jsonify({"error": "No numerical columns found for correlation analysis"}), 500

        # Compute correlation matrix
        correlation_matrix = df[numeric_cols].corr()

        # Reshape for frontend
        correlation_data = correlation_matrix.reset_index().melt(id_vars='index')
        correlation_data.columns = ['row', 'column', 'value']
        correlation_data = correlation_data.fillna(0)

        return jsonify(correlation_data.to_dict(orient='records'))

    except Exception as e:
        logger.error(f"❌ Error generating correlation matrix from DB: {e}")
        return jsonify({"error": str(e)}), 500




# =======================================================================================
# Feature Heatmap
# =======================================================================================
@app.route('/feature_heatmap_data', methods=['GET'])
def feature_heatmap_data():
    try:
        # Use SQLAlchemy engine with connection pooling
        engine = create_engine(
            f'postgresql://{DB_CONFIG["user"]}:{DB_CONFIG["password"]}@{DB_CONFIG["host"]}:{DB_CONFIG["port"]}/{DB_CONFIG["dbname"]}',
            pool_pre_ping=True,  # Enable connection health checks
            pool_recycle=3600    # Recycle connections every hour
        )

        # Try to connect to the database
        try:
            with engine.connect() as conn:
                df = pd.read_sql("SELECT * FROM processed_features", conn)
        except Exception as e:
            logger.warning(f"Database connection error: {str(e)}")
            # Return empty correlation data if database is not available
            return jsonify([])

        # Drop irrelevant columns
        drop_cols = ['id', 'upload_file', 'created_at', 'device_number',
                     'customer_number', 'churn', 'churn_probability']
        df.drop(
            columns=[col for col in drop_cols if col in df.columns], inplace=True)

        # Drop all-null and constant columns
        df.dropna(axis=1, how='all', inplace=True)
        df = df.loc[:, df.nunique(dropna=True) > 1]

        # Factorize any remaining categorical columns
        cat_cols = df.select_dtypes(include=['object', 'category']).columns
        df[cat_cols] = df[cat_cols].apply(lambda col: pd.factorize(col)[0])

        corr = df.corr()
        corr_data = corr.reset_index().melt(id_vars='index')
        corr_data.columns = ['row', 'column', 'value']

        return jsonify(corr_data.to_dict(orient='records'))

    except Exception as e:
        logger.error(f"Error computing feature heatmap: {e}")
        return jsonify([])  # Return empty list instead of error


#Helper function for carrier distribution formatting
def normalize_carrier_name(carrier_name):
    """Normalize carrier names to handle variations and special cases."""
    if not carrier_name:
        return None

    name = carrier_name.lower().strip()

    # T-Mobile variations (including emergency calls)
    if "t-mobile" in name or "tmobile" in name:
        return "T-Mobile"

    # AT&T variations
    if "at&t" in name or "att" in name:
        return "AT&T"

    # Verizon variations
    if "verizon" in name:
        return "Verizon"

    # Sprint variations
    if "sprint" in name:
        return "Sprint"

    # Cricket variations
    if "cricket" in name:
        return "Cricket"

    return name


# Extracts and returns carrier data from the database for the frontend graph
@app.route('/carrier_distribution', methods=['GET'])
def carrier_distribution():
    """Returns the distribution of carriers from database sim_info data."""
    try:
        # Connect to the database.
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Check if 'sim_info' column exists first
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'dashboard_devices';
        """)
        existing_cols = {row[0] for row in cursor.fetchall()}

        if 'sim_info' not in existing_cols:
            logger.warning("⚠️ sim_info column missing in dashboard_devices")
            conn.close()
            return jsonify({"carrier_distribution": []})

        df = pd.read_sql("SELECT sim_info FROM dashboard_devices", conn)
        conn.close()

        # No data
        carrier_counts = {}
        if df.empty:
            return jsonify({"carrier_distribution": []})

        # Format data for the frontend graph. 
        for sim_info in df['sim_info'].dropna():
            try:
                sim_data = json.loads(sim_info)
                if not isinstance(sim_data, list):
                    continue
                for sim in sim_data:
                    if not sim or not sim.get('carrier_name'):
                        continue
                    carrier_name = normalize_carrier_name(sim['carrier_name'])
                    if carrier_name:
                        carrier_counts[carrier_name] = carrier_counts.get(carrier_name, 0) + 1
            except json.JSONDecodeError:
                continue

        sorted_carriers = sorted(carrier_counts.items(), key=lambda x: x[1], reverse=True)
        top_5_carriers = sorted_carriers[:5]
        others_count = sum(count for carrier, count in sorted_carriers[5:])

        distribution = [{"carrier": carrier, "count": count} for carrier, count in top_5_carriers]
        if others_count > 0:
            distribution.append({"carrier": "Others", "count": others_count})

        return jsonify({"carrier_distribution": distribution})

    except psycopg2.OperationalError as e:
        logger.warning(f"⚠️ DB unavailable for /carrier_distribution, returning empty distribution: {e}")
        return jsonify({"carrier_distribution": []})
    except Exception as e:
        logger.error(f"❌ Error analyzing carrier distribution: {e}")
        return jsonify({"error": str(e)}), 500
    

# Extracts and returns return data from the database for the frontend graph. 
@app.route('/return_analysis', methods=['GET'])
def return_analysis():
    try:
        #Connect to the database .
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Check if required columns exist
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'dashboard_devices';
        """)
        existing_cols = {row[0] for row in cursor.fetchall()}

        required_cols = {'type', 'source', 'defect___damage_type', 'warranty', 'final_status', 'responsible_party'}
        if not required_cols.issubset(existing_cols):
            logger.warning("⚠️ Some required columns missing in dashboard_devices")
            conn.close()
            return jsonify(_empty_return_analysis())
            
        df = pd.read_sql("SELECT * FROM dashboard_devices", conn)
        conn.close()

        #No data
        if df.empty:
            return jsonify(_empty_return_analysis())

        #Format data for the frontend graph. 
        returns_df = df[df['type'] == 'Return'].copy()

        source_counts = returns_df['source'].value_counts().reset_index()
        source_counts.columns = ['source', 'count']

        defect_counts = returns_df['defect___damage_type'].value_counts().reset_index()
        defect_counts.columns = ['defect_type', 'count']

        warranty_counts = returns_df['warranty'].value_counts().reset_index()
        warranty_counts.columns = ['warranty_status', 'count']

        final_status_counts = returns_df['final_status'].value_counts().reset_index()
        final_status_counts.columns = ['final_status', 'count']

        responsible_counts = returns_df['responsible_party'].value_counts().reset_index()
        responsible_counts.columns = ['responsible_party', 'count']

        return jsonify({
            "source_distribution": source_counts.to_dict(orient='records'),
            "defect_distribution": defect_counts.to_dict(orient='records'),
            "warranty_status": warranty_counts.to_dict(orient='records'),
            "final_status": final_status_counts.to_dict(orient='records'),
            "responsible_party": responsible_counts.to_dict(orient='records')
        })

    except psycopg2.OperationalError as e:
        logger.warning(f"⚠️ DB unavailable for /return_analysis, returning empty analysis: {e}")
        return jsonify(_empty_return_analysis())
    except Exception as e:
        logger.error(f"❌ Error analyzing return data: {e}")
        return jsonify({"error": str(e)}), 500


# Extracts device time data from the database for the frontend graph. 
@app.route('/time_analysis', methods=['GET'])
def time_analysis():
    try:
        # Connect to the database
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Check if needed columns exist
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'dashboard_devices';
        """)
        existing_cols = {row[0] for row in cursor.fetchall()}

        required_cols = {'interval_date', 'last_boot_date', 'active_date'}
        if not required_cols.issubset(existing_cols):
            logger.warning("⚠️ Some required columns missing in dashboard_devices")
            conn.close()
            return jsonify({"usage_duration": []})

        df = pd.read_sql("SELECT interval_date, last_boot_date, active_date FROM dashboard_devices", conn)
        conn.close()

        #No data
        if df.empty:
            return jsonify({"usage_duration": []})

        date_columns = ['interval_date', 'last_boot_date', 'active_date']
        for col in date_columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
        
        # Calculate data for the graph.
        df['usage_duration'] = (df['last_boot_date'] - df['active_date']).dt.days

        duration_bins = [-1, 7, 30, 90, 180, 365, float('inf')]
        duration_labels = ['<1 week', '1-4 weeks', '1-3 months', '3-6 months', '6-12 months', '>1 year']

        df['duration_group'] = pd.cut(
            df['usage_duration'],
            bins=duration_bins,
            labels=duration_labels
        )

        duration_counts = df['duration_group'].value_counts().reset_index()
        duration_counts.columns = ['duration', 'count']

        duration_counts['sort_order'] = duration_counts['duration'].map(
            {label: i for i, label in enumerate(duration_labels)}
        )
        duration_counts = duration_counts.sort_values('sort_order').drop('sort_order', axis=1)

        return jsonify({"usage_duration": duration_counts.to_dict(orient='records')})

    except psycopg2.OperationalError as e:
        logger.warning(f"⚠️ DB unavailable for /time_analysis, returning empty usage data: {e}")
        return jsonify({"usage_duration": []})
    except Exception as e:
        logger.error(f"❌ Error analyzing time data: {e}")
        return jsonify({"error": str(e)}), 500


# if __name__ == '__main__':
    # app.run(host='0.0.0.0', port=5000, debug=True)
