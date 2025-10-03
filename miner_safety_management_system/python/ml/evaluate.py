from __future__ import annotations
from typing import Dict, Any
import numpy as np
from sklearn.metrics import mean_absolute_error, r2_score


def evaluate_regression(y_true, y_pred) -> Dict[str, Any]:
    return {
        'mae': float(mean_absolute_error(y_true, y_pred)),
        'r2': float(r2_score(y_true, y_pred))
    }


def summarize_feature_importance(model, feature_names):
    if hasattr(model, 'feature_importances_'):
        arr = model.feature_importances_
        ranked = sorted(zip(feature_names, arr), key=lambda x: x[1], reverse=True)
        return [ {'feature': f, 'importance': float(v)} for f,v in ranked ]
    return []


def anomaly_scores(model, X):
    if hasattr(model, 'score_samples'):
        return model.score_samples(X)
    if hasattr(model, 'decision_function'):
        return model.decision_function(X)
    return np.zeros(len(X))
