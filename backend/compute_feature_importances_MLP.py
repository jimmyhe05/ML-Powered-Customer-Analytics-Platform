import pandas as pd
import torch
from MLP1 import ChurnMLP, numerical_cols
import json

# Load trained features
with open("trained_features_MLP.json", "r") as f:
    numerical_cols = json.load(f)

# Load data and model
df = pd.read_csv("processed_churn_data.csv")
X_sample = df[numerical_cols].sample(100, random_state=42)

model = ChurnMLP(len(numerical_cols))
model.load_state_dict(torch.load("MLP_churn_model.pt"))
model.eval()

# Compute importance
model.compute_feature_importances(X_sample)

# Save as JSON
with open("MLP_importance.json", "w") as f:
    json.dump({k: float(v) for k, v in model.feature_importances_.items()}, f)

print("✅ Feature importance computed and saved.")
