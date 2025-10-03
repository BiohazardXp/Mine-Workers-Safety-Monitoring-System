from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Any, Tuple
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer

@dataclass
class PipelineBundle:
    name: str
    model: Any
    features: list[str]
    target: str | None


def _numeric_pipeline():
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])


def build_supervised_pipeline(feature_columns: list[str], target: str) -> Tuple[Pipeline, list[str]]:
    pre = ColumnTransformer([
        ('num', _numeric_pipeline(), feature_columns)
    ])
    model = RandomForestRegressor(n_estimators=120, random_state=42, n_jobs=-1)
    pipe = Pipeline([
        ('pre', pre),
        ('model', model)
    ])
    return pipe, feature_columns


def build_baseline_regressor(feature_columns: list[str], target: str) -> Tuple[Pipeline, list[str]]:
    pre = ColumnTransformer([
        ('num', _numeric_pipeline(), feature_columns)
    ])
    model = LinearRegression()
    pipe = Pipeline([
        ('pre', pre),
        ('model', model)
    ])
    return pipe, feature_columns


def build_anomaly_pipeline(feature_columns: list[str]) -> Tuple[Pipeline, list[str]]:
    pre = ColumnTransformer([
        ('num', _numeric_pipeline(), feature_columns)
    ])
    model = IsolationForest(n_estimators=150, contamination=0.02, random_state=42)
    pipe = Pipeline([
        ('pre', pre),
        ('model', model)
    ])
    return pipe, feature_columns


def select_target(df: pd.DataFrame) -> str:
    # Heuristic: choose parameter with least nulls and some variance
    numeric = df.select_dtypes(include=['number'])
    if numeric.empty:
        raise ValueError('No numeric columns available for target selection.')
    stats = numeric.describe().T
    stats = stats[stats['std'] > 0]
    if stats.empty:
        raise ValueError('All numeric columns have zero variance.')
    target = stats.sort_values('count', ascending=False).index[0]
    return target


def train_regression(df: pd.DataFrame) -> Dict[str, Any]:
    target = select_target(df)
    feature_columns = [c for c in df.columns if c != target]
    pipe, feats = build_supervised_pipeline(feature_columns, target)
    pipe.fit(df[feats], df[target])
    return {'pipeline': pipe, 'target': target, 'features': feats}


def train_baseline(df: pd.DataFrame) -> Dict[str, Any]:
    target = select_target(df)
    feature_columns = [c for c in df.columns if c != target]
    pipe, feats = build_baseline_regressor(feature_columns, target)
    pipe.fit(df[feats], df[target])
    return {'pipeline': pipe, 'target': target, 'features': feats}


def train_anomaly(df: pd.DataFrame) -> Dict[str, Any]:
    feature_columns = list(df.columns)
    pipe, feats = build_anomaly_pipeline(feature_columns)
    pipe.fit(df[feats])
    return {'pipeline': pipe, 'features': feats}
