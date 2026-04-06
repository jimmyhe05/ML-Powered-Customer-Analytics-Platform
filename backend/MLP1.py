import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import os
import sys
from sklearn.model_selection import train_test_split
from torch.utils.data import Dataset, DataLoader
from imblearn.over_sampling import SMOTE
from sklearn.metrics import fbeta_score, classification_report, make_scorer, confusion_matrix, precision_recall_curve
from sklearn.utils.class_weight import compute_class_weight
import joblib
import json
import shap


# ===========================
#  Hyperparameters
# ===========================
THRESHOLD = 0.8  # Decision threshold
DROPOUT = 0.3
LR = 0.0005
EPOCH = int(os.getenv("MLP_TOTAL_EPOCHS", 50))
BATCH_SIZE = 64
EARLY_STOPPING_PATIENCE = 15  # Early stopping patience


# =============================
# 🎯 Custom Fβ-score
# =============================
def custom_fbeta(y_true, y_pred, beta=2):
    return fbeta_score(y_true, y_pred, beta=beta)


user_beta = 2  # Change this if needed
metrics_file = "model_metrics.json"
fbeta_scorer = make_scorer(custom_fbeta, beta=user_beta)


# ===========================
# Load Preprocessed Data
# ===========================
numerical_cols = []

def load_data():
    if len(sys.argv) < 2:
        print("❌ Usage: python MLP1.py <path_to_processed_csv>")
        sys.exit(1)

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print(f"❌ Error: File '{file_path}' not found!")
        sys.exit(1)

    print(f"📂 Loading data from {file_path}...")
    df = pd.read_csv(file_path)
    return df


def preprocess_data(df):
    # Ensure the required column exists
    if 'churn' not in df.columns:
        print(
            "❌ Error: 'churn' column not found in dataset. Please provide a valid dataset.")
        sys.exit(1)

    # Drop any rows where 'churn' is NaN
    df = df.dropna(subset=['churn'])

    if df.empty:
        print("❌ No valid data to train on. Ensure churn values exist in dataset.")
        sys.exit(1)

    # Identify Features and Target
    X = df.drop(columns=['churn'], errors='ignore')
    y = df['churn']

    # Identify categorical & numerical columns from the preprocessor
    global numerical_cols
    numerical_cols = [col for col in df.columns if col.startswith("num__")]

    print("\n📋 Features used for MLP training:")
    for i, col in enumerate(numerical_cols):
        print(f"  [{i+1}] {col}")
       
    #Store the trained features.
    with open("trained_features_MLP.json", "w") as f:
        json.dump(numerical_cols, f)

    # Split data into Train (70%), Validation (15%), Test (15%)
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)

    print(f"Train: {len(X_train)}, Validation: {len(X_val)}, Test: {len(X_test)}")
    return X_train, X_val, X_test, y_train, y_val, y_test


# ===========================
# Create PyTorch Dataset & DataLoader
# ===========================
class ChurnDataset(Dataset):
    def __init__(self, df, num_cols, y):
        self.num_data = torch.tensor(df[num_cols].values, dtype=torch.float)
        self.labels = torch.tensor(y.values, dtype=torch.float)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.num_data[idx], self.labels[idx]


def dataset_loader(X_train, X_val, X_test, y_train, y_val, y_test):

    # Reset index for y to avoid indexing issues
    y_train = y_train.reset_index(drop=True)
    y_val = y_val.reset_index(drop=True)
    y_test = y_test.reset_index(drop=True)

    # Apply SMOTE for class imbalance handling
    smote = SMOTE(random_state=42)
    X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)
    y_train_resampled = pd.Series(y_train_resampled)

    # Create datasets
    train_dataset = ChurnDataset(X_train_resampled, numerical_cols, y_train_resampled)
    val_dataset = ChurnDataset(X_val, numerical_cols, y_val)
    test_dataset = ChurnDataset(X_test, numerical_cols, y_test)

    # Create DataLoaders
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)

    return X_train_resampled, y_train_resampled, train_loader, val_loader, test_loader


# ===========================
# Define MLP Model
# ===========================
class ChurnMLP(nn.Module):
    def __init__(self, num_numeric_features):
        super(ChurnMLP, self).__init__()

        self.input = nn.Linear(num_numeric_features, 512)

        # Define layers with better architecture
        self.hidden_layers = nn.ModuleList([
            nn.Linear(512, 512),
            nn.Linear(512, 256),
            nn.Linear(256, 128),
            nn.Linear(128, 64),
            nn.Linear(64, 32)
        ])

        self.output = nn.Linear(32, 1)
        self.dropout = nn.Dropout(DROPOUT)
        self.relu = nn.ReLU()
        self.batch_norm = nn.BatchNorm1d(512)  # Add batch normalization

        # Initialize weights using Xavier initialization
        self.apply(self._init_weights)

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            nn.init.xavier_uniform_(module.weight)
            if module.bias is not None:
                nn.init.zeros_(module.bias)

    def forward(self, x):
        x = self.input(x)
        x = self.batch_norm(x)
        x = self.relu(x)
        x = self.dropout(x)

        for layer in self.hidden_layers:
            residual = x
            x = self.relu(layer(x))
            x = self.dropout(x)
            if x.shape == residual.shape:
                x = x + residual

        x = self.output(x)
        return x

    def predict_proba(self, X):
        """Returns predicted probabilities similar to Scikit-learn's predict_proba()"""
        self.eval()  # Set the model to evaluation mode
        with torch.no_grad():
            # Convert input to tensor
            X_tensor = torch.tensor(X.values, dtype=torch.float32)
            logits = self.forward(X_tensor).squeeze()  # Get raw logits
            # Convert logits to probabilities
            probabilities = torch.sigmoid(logits)
        return probabilities.numpy()  # Convert to NumPy array for compatibility

    @property
    def feature_importances_(self):
        """Returns computed feature importances after model training"""
        if self._feature_importances_ is None:
            raise ValueError(
                "Feature importances are not computed yet. Train the model first.")
        return self._feature_importances_

    def compute_feature_importances(self, X_sample):
        """
        Computes feature importance by averaging absolute gradients
        of the output w.r.t. input features.
        """
        self.eval()

        X_sample_tensor = torch.tensor(X_sample.values, dtype=torch.float32, requires_grad=True)

        # Forward pass
        output = self.forward(X_sample_tensor).squeeze()
        probs = torch.sigmoid(output).mean()  # mean over batch

        # Backward pass
        probs.backward()

        # Gradient of output w.r.t. input features
        importances = X_sample_tensor.grad.abs().mean(dim=0).numpy()

        # Normalize
        total = importances.sum()
        normalized = importances / total

        # Create dictionary
        feature_importance = {
            feature: importance
            for feature, importance in zip(X_sample.columns, normalized)
        }

        # Sort by importance
        self._feature_importances_ = dict(
            sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
        )


# ===========================
# Loss Function
# ===========================
def loss(y_train_resampled):
    # Compute class weights
    class_weights = compute_class_weight(
        'balanced', classes=np.unique(y_train_resampled), y=y_train_resampled)
    class_weights = torch.tensor(class_weights, dtype=torch.float)

    # Define loss function with class weights
    criterion = nn.BCEWithLogitsLoss(pos_weight=class_weights[1])
    return criterion


# ===========================
# Train the model
# ===========================
def train(train_loader, val_loader, X_unseen):
    """Enhanced training function with early stopping and learning rate scheduling"""
    model = ChurnMLP(len(numerical_cols))

    print(f"🧠 Training MLP on {len(numerical_cols)} numerical features:")  
    for i, col in enumerate(numerical_cols):
        print(f"  [{i+1}] {col}")
        
    with open("mlp_training_progress.json", "w") as f:
        json.dump({
            "status": "in_progress",
            "current_epoch": 1,
            "total_epochs": EPOCH,
            "val_loss": None,
            "train_loss": None
        }, f)

    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.Adam(model.parameters(), lr=LR)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=3, factor=0.5)

    best_val_loss = float('inf')
    patience_counter = 0
    best_model_state = None

    for epoch in range(EPOCH):
        model.train()
        train_loss = 0
        for batch_X, batch_y in train_loader:
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs.squeeze(), batch_y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(
                model.parameters(), max_norm=1.0)  # Gradient clipping
            optimizer.step()
            train_loss += loss.item()

        # Validation phase
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                outputs = model(batch_X)
                val_loss += criterion(outputs.squeeze(), batch_y).item()

        val_loss /= len(val_loader)
        scheduler.step(val_loss)
        
        # ✅ Write progress to a file
        with open("mlp_training_progress.json", "w") as f:
            json.dump({
                "status": "in_progress",
                "current_epoch": epoch + 1,
                "total_epochs": EPOCH,
                "val_loss": round(val_loss, 4),
                "train_loss": round(train_loss / len(train_loader), 4)
            }, f)

        # Early stopping check
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            best_model_state = model.state_dict()
        else:
            patience_counter += 1
            if patience_counter >= EARLY_STOPPING_PATIENCE:
                print(f"Early stopping triggered at epoch {epoch}")
                break

        print(f"Epoch [{epoch+1}/{EPOCH}], Train Loss: {train_loss/len(train_loader):.4f}, Val Loss: {val_loss:.4f}")

    # Load best model state
    model.load_state_dict(best_model_state)
    return model


# ===========================
# Evaluate
# ===========================
def eval(model, test_loader, criterion):
    test_loss = 0
    y_true, y_pred = [], []

    with torch.no_grad():
        for num_inputs, labels in test_loader:
            outputs = model(num_inputs).squeeze()
            loss = criterion(outputs, labels)
            test_loss += loss.item()

            y_true.extend(labels.cpu().numpy())
            y_pred.extend(torch.sigmoid(outputs).cpu().numpy())

    # print results and reports
    test_loss /= len(test_loader)
    print(f"Test Loss: {test_loss:.4f}")

    y_pred_bin = (np.array(y_pred) > THRESHOLD).astype(int)
    fbeta = custom_fbeta(y_true, y_pred_bin, beta=user_beta)
    print(f"F{user_beta} Score: {fbeta:.4F}")

    print("\nClassification Report:")
    print(classification_report(y_true, y_pred_bin))

    conf_matrix = confusion_matrix(y_true, y_pred_bin)
    print("\nConfusion Matrix:")
    print(conf_matrix)

    # record metrics
    report = classification_report(y_true, y_pred_bin, output_dict=True)
    metrics = {
        "churner_precision": round(report.get("1.0", {}).get("precision", 0.0), 4),
        "churner_recall": round(report.get("1.0", {}).get("recall", 0.0), 4),
        "nonchurner_precision": round(report.get("0.0", {}).get("precision", 0.0), 4),
        "nonchurner_recall": round(report.get("0.0", {}).get("recall", 0.0), 4),
        "macro_avg_precision": round(report.get("macro avg", {}).get("precision", 0.0), 4),
        "macro_avg_recall": round(report.get("macro avg", {}).get("recall", 0.0), 4),
        "weighted_avg_precision": round(report.get("weighted avg", {}).get("precision", 0.0), 4),
        "weighted_avg_recall": round(report.get("weighted avg", {}).get("recall", 0.0), 4),
        "accuracy": round(report.get("accuracy", 0.0), 4),
        f"F{user_beta}_score": round(fbeta, 4),
        "model_name": "MLP"
    }

    print("\nMetrics:", metrics)
    return metrics


# =============================
# Save Model & Metrics
# =============================
def save(model, metrics):
    torch.save(model.state_dict(), "MLP_churn_model.pt")

    metrics_file = "MLP_metrics.json"
    with open(metrics_file, "w") as f:
        json.dump(metrics, f)
        
    with open("mlp_training_progress.json", "w") as f:
        json.dump({
            "status": "completed",
            "current_epoch": EPOCH,
            "total_epochs": EPOCH,
        }, f)
        
    # At the END of training after saving model and metrics
    with open("MLP_training_success_token.txt", "w") as f:
        f.write("Training completed successfully!")

    print(f"✅ Model and metrics saved successfully!")


# =============================
# Main
# =============================
if __name__ == "__main__":
    # Load dataset
    df = load_data()

    # Preprocess
    X_train, X_val, X_test, y_train, y_val, y_test = preprocess_data(df)

    # create loaders
    X_train_resampled, y_train_resampled, train_loader, val_loader, test_loader = dataset_loader(
        X_train, X_val, X_test, y_train, y_val, y_test)

    # define loss function
    criterion = loss(y_train_resampled)

    # train
    model = train(train_loader, val_loader, pd.concat([X_val, X_test], axis=0))

    # evaluate
    metrics = eval(model, test_loader, criterion)

    # save result
    save(model, metrics)