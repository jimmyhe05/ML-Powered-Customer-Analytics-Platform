-- ================================
-- CREATE DATABASE:
-- 
-- Stores all necessary data for training, predictions, and dashboard vizualization. 
-- ================================

-- Connect to the database
\c churn_prediction;

-- ================================
-- DROP EXISTING TABLES AND SEQUENCE (FOR TESTING)
-- ================================
 --DROP TABLE IF EXISTS predictions CASCADE;
 --DROP TABLE IF EXISTS devices CASCADE;
 --DROP TABLE IF EXISTS prediction_batches CASCADE;
 --DROP TABLE IF EXISTS processed_features CASCADE;
 --DROP SEQUENCE IF EXISTS prediction_batch_seq;

-- ================================
-- DEVICES TABLE (Stores Training Data)
-- ================================
CREATE TABLE IF NOT EXISTS devices (
    device_number BIGINT PRIMARY KEY,
    churn INTEGER,
    upload_file VARCHAR(100) NOT NULL,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- DASHBOARD DEVICES TABLE (Stores Dashboard Data)
-- ================================
CREATE TABLE IF NOT EXISTS dashboard_devices (
    id SERIAL PRIMARY KEY,
    device_number BIGINT UNIQUE,
    upload_file TEXT,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- PREDICTION BATCHES TABLE (Stores Prediction Metadata Per Batch)
-- ================================
CREATE TABLE IF NOT EXISTS prediction_batches (
    prediction_batch_id INTEGER PRIMARY KEY,
    upload_file VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- PREDICTIONS TABLE (Stores Predictions)
-- ================================
CREATE TABLE IF NOT EXISTS predictions (
    prediction_id SERIAL PRIMARY KEY,
    prediction_batch_id INTEGER NOT NULL REFERENCES prediction_batches(prediction_batch_id) ON DELETE CASCADE,
    device_number BIGINT NOT NULL,
    churn_probability FLOAT NOT NULL,
    customer_number INTEGER NOT NULL
);

-- ================================
-- PROCESSED FEATURES TABLE (Stores Processed Feature Data for Feature Heatmap)
-- ================================
CREATE TABLE IF NOT EXISTS processed_features (
    feature_id SERIAL PRIMARY KEY,
    device_number BIGINT NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    feature_value FLOAT,
    processed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_number, feature_name)
);

-- ================================
-- SEQUENCE FOR PREDICTION BATCH ID
-- ================================
CREATE SEQUENCE IF NOT EXISTS prediction_batch_seq START 1;

