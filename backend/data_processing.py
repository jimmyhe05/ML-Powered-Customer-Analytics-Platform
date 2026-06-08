import os
import pandas as pd
import sys
import json
import re
from datetime import datetime
from sklearn.preprocessing import StandardScaler, OrdinalEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sqlalchemy import URL
import time
from config import get_db_config, get_row_limit


# Processes data for the AI models. 


DEBUG = False #Debugging flag

# Hurtful columns when detecting churn - drop them to not confuse the AI Models
irrelevant_columns = [
    "upload_timestamp", "upload file", "type", "warranty", "office date", "office time in",
    "defect / damage type", "responsible party", "final status", "month", "source", "carrier"
]


def normalize_column_name(col):
    normalized = (
        str(col)
        .lstrip("\ufeff")
        .lower()
        .strip()
        .replace(" ", "_")
        .replace("#", "num")
        .replace("/", "_")
        .replace("-", "_")
        .replace("(", "")
        .replace(")", "")
    )
    normalized = normalized.replace(":", "_")
    normalized = re.sub(r"[^a-z0-9_]", "", normalized)
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    normalized = normalized.strip("_")

    aliases = {
        "product_model_num": "product_model_num",
        "product_model": "product_model_num",
        "model": "product_model_num",
        "device_num": "device_number",
        "device_no": "device_number",
        "devicenumber": "device_number",
        "activated_at": "active_date",
        "activate_date": "active_date",
        "activation_date": "active_date",
        "date_activated": "active_date",
        "last_bootl_date": "last_boot_date",
        "last_boot": "last_boot_date",
        "lastboot": "last_boot_date",
        "last_boot_interval": "last_boot_interval",
        "return_type": "type",
        "return_status": "final_status",
        "status": "final_status",
        "returned": "churn",
        "return": "churn",
        "churned": "churn",
        "is_churn": "churn",
        "is_churned": "churn",
        "churn_label": "churn",
        "label": "churn",
        "target": "churn",
    }
    return aliases.get(normalized, normalized)


def normalize_churn_values(series):
    values = series.astype(str).str.strip().str.lower()
    truthy = {"1", "1.0", "true", "yes", "y", "return", "returned", "repair", "repaired", "churn", "churned"}
    falsey = {"0", "0.0", "false", "no", "n", "none", "nan", "nat", "<na>", "", "active", "not_returned", "non_churn"}
    mapped = pd.Series(pd.NA, index=series.index, dtype="Int64")
    mapped.loc[values.isin(truthy)] = 1
    mapped.loc[values.isin(falsey)] = 0
    numeric = pd.to_numeric(series, errors="coerce")
    mapped.loc[numeric == 1] = 1
    mapped.loc[numeric == 0] = 0
    return mapped


def infer_churn_labels(df):
    if "churn" in df.columns:
        df["churn"] = normalize_churn_values(df["churn"])
    else:
        df["churn"] = pd.Series(pd.NA, index=df.index, dtype="Int64")

    if "type" in df.columns:
        type_values = df["type"].astype(str).str.strip().str.lower()
        returned = type_values.str.startswith("return") | type_values.str.startswith("repair")
        df.loc[df["churn"].isna() & returned, "churn"] = 1

    if "final_status" in df.columns and "type" not in df.columns:
        final_status = df["final_status"].astype(str).str.strip().str.lower()
        has_return_status = ~final_status.isin({"", "nan", "none", "nat", "<na>"})
        df.loc[df["churn"].isna() & has_return_status, "churn"] = 1

    if "active_date" in df.columns and "days_since_activation" in df.columns:
        df.loc[df["churn"].isna() & (df["days_since_activation"] > 30), "churn"] = 0

    df["churn"] = df["churn"].astype("Int64")
    return df

# Helper Function to pull data from the database. 
def safe_load_from_db(sql_query, conn, max_retries=5, wait_seconds=2):
    """
    Tries to load data from database with retries if result is empty.
    """
    retries = 0
    while retries < max_retries:
        df = pd.read_sql_query(sql_query, conn)

        if not df.empty:
            print(f"✅ Successfully loaded {len(df)} rows from database.")
            return df

        print(f"⚠️ Empty dataframe pulled. Retrying in {wait_seconds} seconds...")
        time.sleep(wait_seconds)
        retries += 1

    raise ValueError("❌ Failed to load non-empty dataframe after retries.")


# Process the data. 
def preprocess_data(input_file, output_file, mode="train"):
    
    # Terminal debugging statment
    print(f"Loading data from {input_file} in {mode} mode...")
    
    # Extract the data from the database. 
    if input_file == "from_db":
        import psycopg2
        from sqlalchemy import create_engine
        DB_CONFIG = get_db_config() 

        engine_str = URL.create(
            "postgresql+psycopg2",
            username=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            host=DB_CONFIG["host"],
            port=int(DB_CONFIG["port"]),
            database=DB_CONFIG["dbname"],
        )
        engine = create_engine(engine_str)
        
        LIMIT = get_row_limit()
        
        # Pull the latest upload batch by timestamp
        query = f"""
            SELECT * FROM devices
            WHERE upload_file = (
                SELECT upload_file
                FROM devices
                ORDER BY upload_timestamp DESC
                LIMIT 1
            )
            ORDER BY upload_timestamp DESC
            LIMIT {LIMIT};
        """

        df = safe_load_from_db(query, engine)
        
        #Ensure drop
        df.drop(columns=["device_id"], inplace=True, errors="ignore")
        
    else:
        # Input file mode - process data in the data file. 
        if input_file.endswith(".xls") or input_file.endswith(".xlsx"):
            df = pd.read_excel(input_file, engine="openpyxl")
        else:
            df = pd.read_csv(input_file)

    # Print original column names before any changes for debugging
    print(f"Raw columns BEFORE normalization or dropping:\n{df.columns.tolist()}\n")

    # Normalize feature names
    df.columns = [normalize_column_name(col) for col in df.columns]
    keep_mask = [bool(col) and not str(col).startswith("unnamed") for col in df.columns]
    df = df.loc[:, keep_mask].copy()
    if df.columns.duplicated().any():
        duplicate_cols = sorted(set(df.columns[df.columns.duplicated()].tolist()))
        print(f"⚠️ Duplicate columns after normalization collapsed: {duplicate_cols}")
        df = df.T.groupby(level=0, sort=False).first().T

    # Print altered names for debugging
    print(f"Columns after loading and normalization: {df.columns.tolist()}")

    # Normalize irrelevant columns for future dropping of columns. 
    normalized_irrelevant = [normalize_column_name(col) for col in irrelevant_columns]
    
    today = datetime.today()
    
    # Active date data manipulations (included in provided file.)
    if 'active_date' in df.columns:
        df['active_date'] = pd.to_datetime(df['active_date'], errors="coerce")

        # Impute missing active_date with median
        median_date = df['active_date'].median()
        if pd.isnull(median_date):
            # fallback if all values are NaT
            median_date = datetime.today() - pd.Timedelta(days=365)
        df['active_date'] = df['active_date'].fillna(median_date)
        df['days_since_activation'] = (today - df['active_date']).dt.days
        
    if mode == "train":
        df = infer_churn_labels(df)
        counts = df["churn"].value_counts(dropna=False).to_dict()
        print(f"Churn label counts after inference: {counts}")

    # Sim Info data manipulations (included in provided file.)
    if 'sim_info' in df.columns:
        
        #Extract carrier name
        def extract_carrier(x):
            try:
                if isinstance(x, float) or x is None:
                    return None
                x = x.strip().lower()
                if x == "uninserted":
                    return None
                data = json.loads(x)
                return data[0]['carrier_name'] if data else None
            except json.JSONDecodeError:
                return None
        
        df['carrier'] = df['sim_info'].apply(extract_carrier)
        df['sim_info'] = df['sim_info'].apply(lambda x: 0 if str(x).strip().lower() == "uninserted" else 1) #Turn numerical

    # Extract meaningful features if possible for AI model accuracy.
    if {'interval_date', 'last_boot_date'}.intersection(df.columns):
        if 'interval_date' in df.columns:
            df['interval_date'] = pd.to_datetime(df['interval_date'], errors="coerce")
        if 'last_boot_date' in df.columns:
            df['last_boot_date'] = pd.to_datetime(df['last_boot_date'], errors="coerce")
        df['most_recent_use'] = df[[c for c in ['interval_date', 'last_boot_date'] if c in df.columns]].max(axis=1)

        if 'most_recent_use' in df.columns and 'active_date' in df.columns:
            df['days_since_last_use'] = (today - df['most_recent_use']).dt.days #How long ago was the last use of their device
            df['days_used_since_activation'] = (df['most_recent_use'] - df['active_date']).dt.days #Total days the device was used.
            df['active_ratio'] = df['days_used_since_activation'] / df['days_since_activation'].replace(0, 1) #Ratio of days used over days activated - measures frequency of use. 

        df.drop(columns=['most_recent_use'], inplace=True, errors="ignore") # Not needed anymore

    #Cannot train on these columns - drop. 
    if mode == "train":
        df.drop(columns=[col for col in normalized_irrelevant if col in df.columns], inplace=True)

    # Extract product model (provided in included file)
    if 'product_model_num' in df.columns:
        df['product_model_num'] = df['product_model_num'].astype(str)
        df['product_model_encoded'] = OrdinalEncoder().fit_transform(df[['product_model_num']])
        df.drop(columns=['product_model_num'], inplace=True)

    # Shouldn't ever be needed, but ensures device number is saved.
    if "device_number" in df.columns:
        df_device_numbers = df[["device_number"]].copy()
        df.drop(columns=["device_number"], inplace=True)
        df_device_numbers.to_csv("temp_device_numbers.csv", index=False)

    # Store churn temporarily and drop it before fitting
    if 'churn' in df.columns:
        churn_series = df['churn']
        df.drop(columns=['churn'], inplace=True)
    else:
        churn_series = None

    if mode == "train":
        if churn_series is None or churn_series.dropna().empty:
            raise ValueError(
                "Training requires a churn label. Add a Churn column, or include "
                "Type/Final Status/Active Date columns so churn can be inferred. "
                f"Columns found after normalization: {df.columns.tolist()}"
            )

        class_counts = churn_series.dropna().astype(int).value_counts().to_dict()
        if len(class_counts) < 2:
            raise ValueError(
                "Training requires both churn and non-churn examples. "
                f"Inferred churn counts: {class_counts}. Upload data with returned and non-returned devices."
            )

    # Sort columns 
    categorical_cols = df.select_dtypes(include=['object']).columns.tolist()
    numerical_cols = df.select_dtypes(include=['int64', 'float64']).columns.tolist()

    print(f"Columns going into transformers:\nNumerical: {numerical_cols}\nCategorical: {categorical_cols}\n")

    # Impute missing values and standardize features.
    transformers = []
    if numerical_cols:
        transformers.append(('num', Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler())
        ]), numerical_cols))

    if categorical_cols:
        transformers.append(('cat', Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1))
        ]), categorical_cols))

    if transformers:
        preprocessor = ColumnTransformer(transformers)
        df_processed = preprocessor.fit_transform(df)
        df_processed = pd.DataFrame(df_processed, columns=preprocessor.get_feature_names_out())
    else:
        print("⚠️ No features to transform. Skipping transformation step.")
        df_processed = pd.DataFrame()

    # Reattach Churn
    if mode == "train" and churn_series is not None:
        df_processed['churn'] = churn_series.values
        df_processed.dropna(subset=['churn'], inplace=True)
    
    #Debugging step
    print("🧠 Transformed feature names (line-by-line):")
    for col in df_processed.columns:
        print(f"🔹 {col}")

    df_processed.to_csv(output_file, index=False)

    if DEBUG:
        print("✅ Final Processed Columns:", df.columns.tolist())
        df.to_csv("debug_processed_data.csv", index=False)

    print(f"✅ Data processing complete. Processed dataset saved to {output_file}")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("❌ Usage: python data_processing.py <input_file> <output_file> <mode: train/predict>")
        sys.exit(1)
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    mode = sys.argv[3].lower()
    if mode not in ["train", "predict"]:
        print("❌ Error: Mode must be 'train' or 'predict'")
        sys.exit(1)
    preprocess_data(input_path, output_path, mode)
