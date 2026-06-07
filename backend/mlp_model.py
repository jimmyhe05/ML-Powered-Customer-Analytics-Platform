import torch
import torch.nn as nn


DROPOUT = 0.3


class ChurnMLP(nn.Module):
    def __init__(self, num_numeric_features):
        super(ChurnMLP, self).__init__()
        self.input = nn.Linear(num_numeric_features, 512)
        self.hidden_layers = nn.ModuleList([
            nn.Linear(512, 512),
            nn.Linear(512, 256),
            nn.Linear(256, 128),
            nn.Linear(128, 64),
            nn.Linear(64, 32),
        ])
        self.output = nn.Linear(32, 1)
        self.dropout = nn.Dropout(DROPOUT)
        self.relu = nn.ReLU()
        self.batch_norm = nn.BatchNorm1d(512)
        self._feature_importances_ = None
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

        return self.output(x)

    def predict_proba(self, X):
        self.eval()
        with torch.no_grad():
            X_tensor = torch.tensor(X.values, dtype=torch.float32)
            logits = self.forward(X_tensor).squeeze()
            probabilities = torch.sigmoid(logits)
        return probabilities.numpy()

    @property
    def feature_importances_(self):
        if self._feature_importances_ is None:
            raise ValueError("Feature importances are not computed yet. Train the model first.")
        return self._feature_importances_
