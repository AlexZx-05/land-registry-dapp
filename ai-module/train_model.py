from sklearn.ensemble import IsolationForest
import joblib
import numpy as np


def train_and_save_model(output_path="isolation_forest_model.joblib"):
    # Placeholder synthetic training data. Replace with real historical registry events.
    X = np.array(
        [
            [4, 1, 0, 0],
            [5, 1, 0, 0],
            [6, 2, 0, 0],
            [4, 4, 1, 1],
            [7, 5, 1, 1],
            [3, 1, 0, 0],
        ],
        dtype=float,
    )
    model = IsolationForest(contamination=0.15, random_state=42)
    model.fit(X)
    joblib.dump(model, output_path)
    print(f"Model saved to {output_path}")


if __name__ == "__main__":
    train_and_save_model()
