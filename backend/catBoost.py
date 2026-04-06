import pandas as pd
import numpy as np
from catboost import CatBoostClassifier
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.metrics import fbeta_score, precision_score, recall_score, accuracy_score
from imblearn.combine import SMOTETomek
import sys
import os
import matplotlib.pyplot as plt

#Quick CatBoost Implementation. 

# =============================
# Custom Fβ-score
# =============================
def custom_fbeta(y_true, y_pred, beta=2):
    return fbeta_score(y_true, y_pred, beta=beta)

user_beta = 2
min_precision = 0.2

# =============================
# Load & Preprocess Data
# =============================
if len(sys.argv) < 2:
    print("❌ Usage: python catboost_model.py <path_to_processed_csv>")
    sys.exit(1)

file_path = sys.argv[1]
if not os.path.exists(file_path):
    print(f"❌ Error: File '{file_path}' not found!")
    sys.exit(1)

print(f"📂 Loading data from {file_path}...")
df = pd.read_csv(file_path)

if 'churn' not in df.columns:
    print("❌ Error: 'churn' column not found in dataset.")
    sys.exit(1)

df = df.dropna(subset=['churn'])

if df.empty:
    print("❌ No valid data to train on.")
    sys.exit(1)

X_all = df.drop(columns=['churn', 'num__churn'], errors='ignore')
y_all = df['churn']

# =============================
# Cross-Validation Loop
# =============================
kf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

f2_scores, recalls, precisions, accuracies = [], [], [], []

for fold, (train_idx, test_idx) in enumerate(kf.split(X_all, y_all)):
    print(f"\n🔁 Fold {fold+1}/5")

    X_train_full, X_test = X_all.iloc[train_idx], X_all.iloc[test_idx]
    y_train_full, y_test = y_all.iloc[train_idx], y_all.iloc[test_idx]

    X_train, X_val, y_train, y_val = train_test_split(
        X_train_full, y_train_full, test_size=0.2, stratify=y_train_full, random_state=42
    )

    smt = SMOTETomek(sampling_strategy=0.3, random_state=42)
    X_train_np, y_train_np = smt.fit_resample(X_train.values, y_train.values)
    X_val_np = X_val.values
    y_val_np = y_val.values
    X_test_np = X_test.values
    y_test_np = y_test.values

    # Initialize CatBoost
    clf = CatBoostClassifier(
        iterations=1000,
        learning_rate=0.03,
        depth=6,
        eval_metric='Logloss',
        random_seed=42,
        verbose=False,
        early_stopping_rounds=100
    )

    clf.fit(X_train_np, y_train_np, eval_set=(X_val_np, y_val_np))

    # Threshold tuning
    best_thresh = 0.0
    best_recall = 0.0

    val_proba = clf.predict_proba(X_test_np)[:, 1]

    for thresh in np.arange(0.01, 0.9, 0.01):
        preds = (val_proba > thresh).astype(int)
        precision = precision_score(y_test_np, preds, zero_division=0)
        recall = recall_score(y_test_np, preds, zero_division=0)
        if precision >= min_precision and recall > best_recall:
            best_recall = recall
            best_thresh = thresh

    final_preds = (val_proba > best_thresh).astype(int)

    f2 = fbeta_score(y_test_np, final_preds, beta=user_beta)
    f2_scores.append(f2)
    recalls.append(best_recall)
    precisions.append(precision_score(y_test_np, final_preds, zero_division=0))
    accuracies.append(accuracy_score(y_test_np, final_preds))

    print(f"✅ Fold {fold+1} | F2: {f2:.4f}, Recall: {best_recall:.4f}, Threshold: {best_thresh:.2f}")

# =============================
# Summary
# =============================
print("\n📈 Cross-Validation Summary:")
print(f"Avg F2: {np.mean(f2_scores):.4f}")
print(f"Avg Recall: {np.mean(recalls):.4f}")
print(f"Avg Precision: {np.mean(precisions):.4f}")
print(f"Avg Accuracy: {np.mean(accuracies):.4f}")

# Plot Feature Importances
importances = clf.get_feature_importance()
sorted_indices = np.argsort(importances)[::-1]

plt.figure(figsize=(10, 6))
plt.bar([X_all.columns[i] for i in sorted_indices], np.array(importances)[sorted_indices])
plt.xticks(rotation=90)
plt.title("CatBoost Feature Importances")
plt.tight_layout()
plt.show()
