import pandas as pd
import numpy as np
import joblib
import os
import sys
import optuna
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from xgboost import XGBClassifier
from sklearn.linear_model import SGDClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.metrics import fbeta_score, classification_report, make_scorer
from sklearn.svm import SVC
from imblearn.under_sampling import RandomUnderSampler
from imblearn.combine import SMOTETomek
from sklearn.metrics import accuracy_score, precision_score, recall_score
import json
from sklearn.model_selection import cross_val_predict

# Implements XGBoost. Incorporates architecture for additional model comparisions. 

MODEL_PATH = "best_churn_model.pkl"
METRICS_FILE = "model_metrics.json"
USER_BETA = 2 # Fβ-score setting
TEST_SIZE = 0.2 # Train test split
THRESHOLD = 0.2 # Threshold for determining churn.
NUM_TRIALS = int(os.getenv("XGB_TOTAL_TRIALS", 10))  #Optuna trials - More will test a wider range of hyperparameters


# =============================
# Custom Fβ-score: Used for comparisions to maximize recall and precision. Default is F2.
# =============================
def custom_fbeta(y_true, y_pred, beta=2):
    return fbeta_score(y_true, y_pred, beta=beta)


user_beta = USER_BETA  # Default value. Change if needed.
metrics_file = METRICS_FILE
fbeta_scorer = make_scorer(custom_fbeta, beta=user_beta)


# =============================
# Load & Preprocess Provided Data
# =============================
if len(sys.argv) < 2:
    print("❌ Usage: python train.py <path_to_processed_csv>")
    sys.exit(1)

file_path = sys.argv[1]

if not os.path.exists(file_path):
    print(f"❌ Error: File '{file_path}' not found!")
    sys.exit(1)

print(f"Loading data from {file_path}...")
df_new = pd.read_csv(file_path)

# Initialize progress status
with open("xgb_training_progress.json", "w") as f:
    json.dump({
        "status": "in_progress",
        "current_trial": 0,
        "total_trials": NUM_TRIALS
    }, f)

# Ensure the churn column exists (our y values for supervised learning)
if 'churn' not in df_new.columns:
    print("❌ Error: 'churn' column not found in dataset. Please provide a valid dataset.")
    with open("xgb_training_progress.json", "w") as f:
        json.dump({
            "status": "error",
            "current_trial": 0,
            "total_trials": NUM_TRIALS
        }, f)
    sys.exit(1)

# Drop any rows where 'churn' is NaN - cannot train model on these rows.
df_new = df_new.dropna(subset=['churn'])

if df_new.empty:
    print("❌ No valid data to train on. Ensure churn values exist in dataset.")
    with open("xgb_training_progress.json", "w") as f:
        json.dump({
            "status": "error",
            "current_trial": 0,
            "total_trials": NUM_TRIALS
        }, f)

    sys.exit(1)

# Set X and Y datasets appropriately.
X_new = df_new.drop(columns=['churn', 'num__churn'],
                    errors='ignore')
y_new = df_new['churn']

# Ensure y_new has at least two classes (0 and 1)
if len(set(y_new)) < 2:
    print("❌ Training dataset contains only one class. Incremental training requires both churn and non-churn labels.")
    with open("xgb_training_progress.json", "w") as f:
        json.dump({
        "status": "error",
        "current_trial": 0,
        "total_trials": NUM_TRIALS
    }, f)
    sys.exit(1)

#Store the trained features.
feature_list = df_new.drop(columns=["churn"]).columns.tolist()
with open("trained_features.json", "w") as f:
    json.dump(feature_list, f)

# =============================
# Train-Test Split: 80/20%
# =============================
X_train, X_test, y_train, y_test = train_test_split(
    X_new, y_new, test_size=TEST_SIZE, random_state=42, stratify=y_new
)

print(f"\n🧠 Features used for training ({len(X_train.columns)} total):")
for i, col in enumerate(X_train.columns, 1):
    print(f"  [{i}] {col}")

# SMOTETomek implementation. Not used currently due to worse performance.
# undersampler = RandomUnderSampler(sampling_strategy=0.2, random_state=42)  # Make minority class 20% of the total
# X_train, y_train = undersampler.fit_resample(X_train, y_train)
# smote_tomek = SMOTETomek(sampling_strategy=0.2, random_state=42)  # Ensure minority class is 20% of total
# X_train, y_train = smote_tomek.fit_resample(X_train, y_train)

# Print class distributions
print(f"🟢 Training set: {y_train.value_counts(normalize=True)}")
print(f"🔴 Test set: {y_test.value_counts(normalize=True)}")


# =======================================================================================
# Incremental Training: If model package already exists, we incrementally train on new data.
# =======================================================================================
model_path = MODEL_PATH
incremental_training = False

if os.path.exists(model_path):
    print("🔄 Existing model found! Checking for incremental learning support...")
    try:
        # First, try to load as a Scikit-learn model
        model = joblib.load(model_path)
        model_type = type(model).__name__
        print(f"✅ Loaded existing model: {model_type}")

    except Exception as e:
        print(f"⚠️ Joblib loading failed: {e}")
        print("🔄 Trying to load as an XGBoost model...")

        try:
            # If joblib fails, assume it's an XGBoost model
            model = XGBClassifier()
            model.load_model(model_path)
            print("✅ Loaded existing XGBoost model.")
            model_type = "XGBoost"

            # Check for feature mismatch
            existing_features = model.get_booster().feature_names
            new_features = X_train.columns.tolist()

            if set(existing_features) != set(new_features):
                print("⚠️ Feature mismatch detected. Forcing new model training...")
                model = None
                model_type = None
                # Remove the old model file
                os.remove(model_path)
                print("✅ Old model removed. Will train a new model.")

        except Exception as e:
            print(f"❌ Error loading model: {e}")
            print("⚠️ Model file may be corrupted. Retraining from scratch...")
            model = None
            model_type = None

    # Incremental training based on the model type
    if model_type == "XGBoost":
        print("✅ Performing incremental training for XGBoost...")
        try:
            # Incremental update
            model.fit(X_train, y_train, xgb_model=model_path)
            model.save_model(model_path)  # Save updated model
            incremental_training = True
        except Exception as e:
            print(f"❌ Error during incremental training: {e}")
            print("⚠️ Forcing new model training...")
            model = None
            model_type = None
            incremental_training = False

    elif hasattr(model, "partial_fit"):  # Supports incremental learning (SGDClassifier)
        print("✅ Performing incremental training for Scikit-learn model...")
        model.partial_fit(X_train, y_train, classes=np.array(
            [0, 1]))  # Incremental update
        joblib.dump(model, model_path)  # Save updated model
        incremental_training = True
    else:
        print("⚠️ Model does not support incremental learning. Retraining from scratch...")
        model = None

    # ✅ Evaluate model after incremental learning
    print("\n🔍 Evaluating Model After Incremental Update...")
    y_test_probs = model.predict_proba(X_test)[:, 1]
    y_test_pred_adjusted = (y_test_probs >= 0.2).astype(int)

    fbeta = custom_fbeta(y_test, y_test_pred_adjusted, beta=user_beta)
    print(
        f"✅ Incrementally Trained Model F{user_beta}-score on Test Set: {fbeta:.4f}")

    # ✅ Print classification report
    report = classification_report(y_test, y_test_pred_adjusted, output_dict=True)
    print(report)

    # Metrics for frontend visualization
    metrics = {
        "churner_precision": round(report.get("1", {}).get("precision", 0.0), 4),
        "churner_recall": round(report.get("1", {}).get("recall", 0.0), 4),
        "nonchurner_precision": round(report.get("0", {}).get("precision", 0.0), 4),
        "nonchurner_recall": round(report.get("0", {}).get("recall", 0.0), 4),
        "macro_avg_precision": round(report.get("macro avg", {}).get("precision", 0.0), 4),
        "macro_avg_recall": round(report.get("macro avg", {}).get("recall", 0.0), 4),
        "weighted_avg_precision": round(report.get("weighted avg", {}).get("precision", 0.0), 4),
        "weighted_avg_recall": round(report.get("weighted avg", {}).get("recall", 0.0), 4),
        "accuracy": round(accuracy_score(y_test, y_test_pred_adjusted), 4),
        f"F{user_beta}_score": round(custom_fbeta(y_test, y_test_pred_adjusted, beta=user_beta), 4),
        "model_name": model_type if incremental_training else model_type
    }

    # Save updated metrics
    with open(metrics_file, "w") as f:
        json.dump(metrics, f)
            
    # Success token for frontend polling. 
    with open("XGB_training_success_token.txt", "w") as f:
        f.write("Training completed successfully!")
        
    with open("xgb_training_progress.json", "w") as f:
        json.dump({
            "status": "completed",
            "current_trial": NUM_TRIALS,
            "total_trials": NUM_TRIALS
        }, f)

    print(f"✅ Incremental training complete. Updated metrics: {metrics}")
    sys.exit(0)  # Exit after incremental training

else:
    print("🚀 No existing model found. Training a new model from scratch...")
    model = None


# =======================================================================================
# Training from Scratch
# =======================================================================================


# =============================
# Cross-Validation Function
# =============================
def cross_validate_model(model, X, y, k_folds=10):
    """Performs k-fold cross-validation and returns the mean Fβ-score."""
    skf = StratifiedKFold(n_splits=k_folds, shuffle=True, random_state=42)
    scores = cross_val_score(model, X, y, cv=skf, scoring=fbeta_scorer)
    return np.mean(scores)


# =============================
# Optuna Hyperparameter Tuning
# =============================
def tune_hyperparameters(model_name):
    """Optimizes hyperparameters for the given model using Optuna."""

    def objective(trial):
        """Defines the objective function for Optuna optimization."""

        if model_name == "SGD Logistic Regression":
            model = SGDClassifier(
                loss="log_loss",
                class_weight="balanced",
                random_state=42,
                max_iter=1000,
                alpha=trial.suggest_float("alpha", 1e-5, 1e-1, log=True),
                penalty=trial.suggest_categorical(
                    "penalty", ["l2", "elasticnet"]),
            )

        elif model_name == "XGBoost":
            model = XGBClassifier(
                eval_metric="logloss",
                scale_pos_weight=5,
                random_state=42,
                n_estimators=trial.suggest_int("n_estimators", 100, 500),
                learning_rate=trial.suggest_float(
                    "learning_rate", 0.01, 0.2, log=True),
                max_depth=trial.suggest_int("max_depth", 3, 10),
                subsample=trial.suggest_float("subsample", 0.6, 1.0),
            )

        # Train the model
        model.fit(X_train, y_train)
        y_pred_probs = model.predict_proba(X_test)[:, 1]
        y_pred_adjusted = (y_pred_probs >= THRESHOLD).astype(int)
        
        #Used for real-time updates
        app_progress = {
            "status": "in_progress",
            "current_trial": trial.number + 1,
            "total_trials": NUM_TRIALS,
        }
        with open("xgb_training_progress.json", "w") as f:
            json.dump(app_progress, f)

        # Perform cross-validation
        return cross_validate_model(model, X_train, y_train)
        # return custom_fbeta(y_test, y_pred_adjusted, beta=user_beta)

    # Run Optuna optimization
    study = optuna.create_study(direction="maximize")

    try:
        study.optimize(objective, n_trials=NUM_TRIALS)
    except ValueError as e:
        print(f"⚠️ No trials completed: {e}")
        return {}

    return study.best_params if len(study.trials) > 0 else {}


# =============================
# 🏋️‍♂️ Train & Evaluate Models
# =============================
if model is None or not incremental_training:
    models = {
        #"SGD Logistic Regression": SGDClassifier(loss="log_loss", class_weight="balanced", random_state=42, max_iter=1000),
        "XGBoost": XGBClassifier(eval_metric='logloss', scale_pos_weight=5, random_state=42),
    }

    best_fbeta_score = 0
    best_model_name = None
    best_model = None
    best_metrics = {}

    for name, model in models.items():
        print(f"\n Tuning hyperparameters for {name}...")
        best_params = tune_hyperparameters(name)

        print(f"\n Training {name} with best parameters: {best_params}...")
        model.set_params(**best_params)

        model.fit(X_train, y_train)

        # Perform k-fold cross-validation
        fbeta_cv = cross_validate_model(model, X_train, y_train)

        y_test_probs = model.predict_proba(X_test)[:, 1]
        y_test_pred_adjusted = (y_test_probs >= THRESHOLD).astype(int)

        precision = precision_score(y_test, y_test_pred_adjusted)
        recall = recall_score(y_test, y_test_pred_adjusted)
        accuracy = accuracy_score(y_test, y_test_pred_adjusted)
        fbeta_test = custom_fbeta(y_test, y_test_pred_adjusted, beta=user_beta)

        print(f"{name} F{user_beta}-score (Cross-Validation): {fbeta_cv:.4f}")
        print(f"{name} F{user_beta}-score (Test Set): {fbeta_test:.4f}")
        print(classification_report(y_test, y_test_pred_adjusted))

        # Use a mix of the test score and the cross validation score.
        final_score = (0.6 * fbeta_cv) + (0.4 * fbeta_test)

        # Select the best model based on final score
        if final_score > best_fbeta_score:
            best_fbeta_score = final_score
            best_model = model
            best_model_name = name
            report = classification_report(y_test, y_test_pred_adjusted, output_dict=True)
            best_metrics = {
                "churner_precision": round(report.get("1", {}).get("precision", 0.0), 4),
                "churner_recall": round(report.get("1", {}).get("recall", 0.0), 4),
                "nonchurner_precision": round(report.get("0", {}).get("precision", 0.0), 4),
                "nonchurner_recall": round(report.get("0", {}).get("recall", 0.0), 4),
                "macro_avg_precision": round(report.get("macro avg", {}).get("precision", 0.0), 4),
                "macro_avg_recall": round(report.get("macro avg", {}).get("recall", 0.0), 4),
                "weighted_avg_precision": round(report.get("weighted avg", {}).get("precision", 0.0), 4),
                "weighted_avg_recall": round(report.get("weighted avg", {}).get("recall", 0.0), 4),
                "accuracy": round(accuracy_score(y_test, y_test_pred_adjusted), 4),
                f"F{user_beta}_score": round(custom_fbeta(y_test, y_test_pred_adjusted, beta=user_beta), 4),
                "model_name": best_model_name
            }

            print("\nMetrics:", best_metrics)

    # =============================
    # 💾 Save Best Model & Metrics
    # =============================
    if best_model:
        print(
            f"\n Retraining {best_model_name} on the full dataset before saving...")
        best_model.fit(X_train, y_train)  # Retrain on the full dataset without cross-validation overhead. 

        if best_model_name == "XGBoost":
            best_model.save_model(model_path)  # Save XGBoost booster
        else:
            joblib.dump(best_model, model_path)  # Save other models

        # Save metrics only for the best model
        metrics_file = "model_metrics.json"
        with open(metrics_file, "w") as f:
            json.dump(best_metrics, f)
          
        #Update progress bar  
        with open("xgb_training_progress.json", "w") as f:
            json.dump({
                "status": "completed",
                "current_trial": NUM_TRIALS,
                "total_trials": NUM_TRIALS
            }, f)

        # Success Token for Frontend Polling
        with open("XGB_training_success_token.txt", "w") as f:
            f.write("Training completed successfully!")

        print(
            f"\n🏆 Best Model: {best_model_name} with F{user_beta}-score: {best_fbeta_score:.4f}")
        print(f"✅ Best model and its metrics saved successfully!")
    else:
        print("❌ No valid model was found.")
        with open("xgb_training_progress.json", "w") as f:
            json.dump({
                "status": "error",
                "current_trial": NUM_TRIALS,
                "total_trials": NUM_TRIALS
            }, f)

