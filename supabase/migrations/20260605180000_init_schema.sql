-- Initial schema for Supabase Postgres.
-- Supabase runs migrations against the linked project's postgres database, so
-- psql-only connection commands such as `\c churn_prediction` are intentionally omitted.

CREATE TABLE IF NOT EXISTS devices (
    device_number BIGINT PRIMARY KEY,
    churn INTEGER,
    upload_file VARCHAR(100) NOT NULL,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dashboard_devices (
    id SERIAL PRIMARY KEY,
    device_number BIGINT UNIQUE,
    upload_file TEXT,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prediction_batches (
    prediction_batch_id INTEGER PRIMARY KEY,
    upload_file VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS predictions (
    prediction_id SERIAL PRIMARY KEY,
    prediction_batch_id INTEGER NOT NULL REFERENCES prediction_batches(prediction_batch_id) ON DELETE CASCADE,
    device_number BIGINT NOT NULL,
    churn_probability FLOAT NOT NULL,
    customer_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS processed_features (
    feature_id SERIAL PRIMARY KEY,
    device_number BIGINT NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    feature_value FLOAT,
    processed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_number, feature_name)
);

CREATE SEQUENCE IF NOT EXISTS prediction_batch_seq START 1;
