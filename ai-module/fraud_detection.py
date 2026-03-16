import json
import sys

import numpy as np
from sklearn.ensemble import IsolationForest


def main():
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"score": 0.0, "anomalous": False, "error": "empty_input"}))
        return

    payload = json.loads(raw)
    dataset = payload.get("dataset", [])
    target = payload.get("target", [])

    if not isinstance(target, list) or len(target) == 0:
        print(json.dumps({"score": 0.0, "anomalous": False, "error": "invalid_target"}))
        return

    rows = [row for row in dataset if isinstance(row, list) and len(row) == len(target)]
    rows.append(target)
    data = np.array(rows, dtype=float)

    model = IsolationForest(contamination=0.15, random_state=42)
    model.fit(data)

    score = float(model.decision_function([target])[0])
    prediction = int(model.predict([target])[0])  # -1 anomaly, 1 normal

    print(
        json.dumps(
            {
                "score": round(score, 6),
                "anomalous": prediction == -1,
                "model": "IsolationForest",
            }
        )
    )


if __name__ == "__main__":
    main()
