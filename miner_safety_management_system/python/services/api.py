from __future__ import annotations
import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pathlib import Path
import pandas as pd
from .. import config  # type: ignore
from ..ml.features import build_feature_table
from ..ml.evaluate import summarize_feature_importance, anomaly_scores
from ..models.train import train_all
from ..utils.logging_config import get_logger

log = get_logger('api')
app = FastAPI(title="MSMS ML Service", version="0.1.0")

class TrainResponse(BaseModel):
    status: str
    timestamp: str | None = None
    meta: dict | None = None

@app.get('/health')
async def health():
    return {'status': 'ok'}

@app.post('/train', response_model=TrainResponse)
async def train_endpoint():
    res = train_all()
    if res.get('status') == 'no-data':
        return TrainResponse(status='no-data')
    return TrainResponse(status='ok', timestamp=res['timestamp'], meta=res['meta'])


def _load_model(name: str):
    path = config.MODELS_DIR / f'{name}.joblib'
    if not path.exists():
        raise HTTPException(404, f'Model {name} not found')
    return joblib.load(path)

@app.get('/summary')
async def summary():
    feats, meta = build_feature_table()
    if feats.empty:
        return {'status': 'no-data'}
    return {
        'status': 'ok',
        'rows': len(feats),
        'columns': list(feats.columns),
        'meta': meta
    }

@app.get('/feature-importance')
async def feature_importance(model: str = 'regression'):
    pipe = _load_model(model)
    if not hasattr(pipe, 'named_steps'):
        raise HTTPException(400, 'Invalid pipeline')
    model_obj = pipe.named_steps.get('model')
    pre = pipe.named_steps.get('pre')
    if not model_obj or not pre:
        raise HTTPException(400, 'Pipeline missing components')
    # Retrieve feature names
    try:
        feature_names = pre.transformers_[0][2]
    except Exception:
        feature_names = []
    importance = summarize_feature_importance(model_obj, feature_names)
    return {'model': model, 'importance': importance}

@app.get('/anomalies')
async def anomalies(limit: int = 50):
    feats, meta = build_feature_table()
    if feats.empty:
        return {'status': 'no-data'}
    pipe = _load_model('anomaly')
    pre = pipe.named_steps.get('pre')
    model_obj = pipe.named_steps.get('model')
    X = feats[pre.transformers_[0][2]]
    scores = anomaly_scores(model_obj, X)
    # Lower scores more anomalous typically for IsolationForest
    idx = scores.argsort()[:limit]
    records = []
    for i in idx:
        row = feats.iloc[i]
        records.append({
            'timestamp': row.name.isoformat() if hasattr(row.name, 'isoformat') else str(row.name),
            'score': float(scores[i])
        })
    return {'status': 'ok', 'anomalies': records}

@app.get('/trend')
async def trend(parameter: str | None = None):
    feats, meta = build_feature_table()
    if feats.empty:
        return {'status': 'no-data'}
    if parameter is None:
        # choose first numeric column
        parameter = feats.columns[0]
    if parameter not in feats.columns:
        raise HTTPException(404, 'Parameter not found in feature table')
    series = feats[parameter].tail(500)
    return {
        'status': 'ok',
        'parameter': parameter,
        'points': [
            {'t': str(idx), 'v': float(val)} for idx, val in series.items()
        ]
    }
