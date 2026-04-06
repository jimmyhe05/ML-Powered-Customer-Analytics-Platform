import torch
from pytorch_tabnet.tab_model import TabNetClassifier
from sklearn.metrics import classification_report, confusion_matrix, fbeta_score, precision_score, recall_score, accuracy_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from imblearn.combine import SMOTETomek
import pandas as pd
import numpy as np
import sys
import os
import copy
import matplotlib.pyplot as plt

#Quick TabNet Implementation for funnsies.

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
   print("❌ Usage: python train.py <path_to_processed_csv>")
   sys.exit(1)

file_path = sys.argv[1]

if not os.path.exists(file_path):
   print(f"❌ Error: File '{file_path}' not found!")
   sys.exit(1)

print(f"📂 Loading data from {file_path}...")
df_new = pd.read_csv(file_path)

if 'churn' not in df_new.columns:
   print("❌ Error: 'churn' column not found in dataset.")
   sys.exit(1)

df_new = df_new.dropna(subset=['churn'])

if df_new.empty:
   print("❌ No valid data to train on.")
   sys.exit(1)

X_all = df_new.drop(columns=['churn', 'num__churn'], errors='ignore')
y_all = df_new['churn']


# =============================
# Cross-Validation Loop
# =============================
kf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

f2_scores, recalls, precisions, accuracies = [], [], [], []

for fold, (train_idx, test_idx) in enumerate(kf.split(X_all, y_all)):
   print(f"\n🔁 Fold {fold+1}/5")

   X_train_full, X_test = X_all.iloc[train_idx], X_all.iloc[test_idx]
   y_train_full, y_test = y_all.iloc[train_idx], y_all.iloc[test_idx]

   # Split validation from training
   X_train, X_val, y_train, y_val = train_test_split(
       X_train_full, y_train_full, test_size=0.2, stratify=y_train_full, random_state=42
   )

   # Apply SMOTE-Tomek to training data only
   smt = SMOTETomek(sampling_strategy=0.3, random_state=42)
   X_train_np, y_train_np = smt.fit_resample(X_train.values, y_train.values)
   X_val_np = X_val.values
   y_val_np = y_val.values
   X_test_np = X_test.values
   y_test_np = y_test.values

   # Initialize TabNet
   clf = TabNetClassifier(
       optimizer_fn=torch.optim.Adam,
       optimizer_params=dict(lr=0.001),
       scheduler_params={"step_size": 10, "gamma": 0.9},
       scheduler_fn=torch.optim.lr_scheduler.StepLR,
       verbose=0
   )

   clf.fit(
       X_train=X_train_np, y_train=y_train_np,
       max_epochs=100,
       batch_size=256,
       virtual_batch_size=128,
       eval_set=[(X_val_np, y_val_np)],
       eval_name=['val'],
       eval_metric=['logloss'],
       patience=50
   )

   # Sweep thresholds
   best_thresh = 0.0
   best_recall = 0.0

   val_proba = clf.predict_proba(X_test_np)[:, 1]

   for thresh in np.arange(0.01, 0.9, 0.05):
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

feature_importances = clf.feature_importances_
sorted_indices = np.argsort(feature_importances)[::-1]

plt.figure(figsize=(10,6))
plt.bar([X_all.columns[i] for i in sorted_indices], feature_importances[sorted_indices])
plt.xticks(rotation=90)
plt.title("TabNet Feature Importances")
plt.tight_layout()
plt.show()
