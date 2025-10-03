from __future__ import annotations
import json
from pathlib import Path
import joblib
from datetime import datetime
from .. import config  # type: ignore
from ..utils.logging_config import get_logger
from ..ml.features import build_feature_table
from ..ml import pipelines

log = get_logger('train')

REGISTRY_PATH = config.REGISTRY_FILE


def _load_registry() -> dict:
    if REGISTRY_PATH.exists():
        try:
            return json.loads(REGISTRY_PATH.read_text())
        except Exception:  # pragma: no cover
            log.exception('Failed reading registry, starting new.')
    return {"models": []}


def _save_registry(reg: dict):
    REGISTRY_PATH.write_text(json.dumps(reg, indent=2))


def train_all(save: bool = True) -> dict:
    feats, meta = build_feature_table()
    if feats.empty:
        log.warning('No features available for training.')
        return {"status": "no-data"}

    # Main models
    baseline = pipelines.train_baseline(feats)
    reg = pipelines.train_regression(feats)
    anomaly = pipelines.train_anomaly(feats)

    timestamp = datetime.utcnow().isoformat()

    results = {
        'timestamp': timestamp,
        'meta': meta,
        'baseline': {
            'target': baseline.get('target'),
            'features': baseline.get('features')
        },
        'regression': {
            'target': reg.get('target'),
            'features': reg.get('features')
        },
        'anomaly': {
            'features': anomaly.get('features')
        }
    }

    if save:
        config.MODELS_DIR.mkdir(exist_ok=True)
        joblib.dump(baseline['pipeline'], config.MODELS_DIR / 'baseline.joblib')
        joblib.dump(reg['pipeline'], config.MODELS_DIR / 'regression.joblib')
        joblib.dump(anomaly['pipeline'], config.MODELS_DIR / 'anomaly.joblib')

        registry = _load_registry()
        registry_entry = {
            'timestamp': timestamp,
            'models': {
                'baseline': 'baseline.joblib',
                'regression': 'regression.joblib',
                'anomaly': 'anomaly.joblib'
            },
            'meta': meta
        }
        registry['models'].append(registry_entry)
        _save_registry(registry)
        log.info('Saved models and updated registry.')

    return results
