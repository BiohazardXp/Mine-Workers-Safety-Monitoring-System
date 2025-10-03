from __future__ import annotations
import pandas as pd
import numpy as np
from typing import Tuple, Dict
from .. import config  # type: ignore
from ..utils.io import load_all_csv
from ..utils.logging_config import get_logger

log = get_logger('features')

REQUIRED_COLUMNS = [
    'timestamp','device_id','device_name','employee_id','employee_name',
    'category','parameter','value'
]

def load_raw() -> pd.DataFrame:
    df = load_all_csv()
    if df.empty:
        log.warning('No data loaded (empty DataFrame).')
        return df
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        log.error('Missing required columns: %s', missing)
        raise ValueError(f'Missing required columns: {missing}')
    df = df.sort_values('timestamp')
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    # Drop obviously bad rows
    df = df.dropna(subset=['timestamp','value'])
    # Remove duplicates
    df = df.drop_duplicates()
    # Clip extreme outliers per parameter (simple robust z-score approach)
    def clip_group(g: pd.DataFrame) -> pd.DataFrame:
        v = g['value']
        med = v.median()
        mad = np.median(np.abs(v - med)) or 1.0
        z = 0.6745 * (v - med) / mad
        g.loc[:, 'value'] = v.where(np.abs(z) < 8, med)  # replace extreme with median
        return g
    df = df.groupby('parameter', group_keys=False).apply(clip_group)
    return df


def pivot_parameters(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    wide = df.pivot_table(index='timestamp', columns='parameter', values='value', aggfunc='mean')
    wide = wide.sort_index().ffill().bfill()
    wide.columns = [f'param_{c}' for c in wide.columns]
    return wide


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    out = df.copy()
    out['hour'] = out.index.hour
    out['dayofweek'] = out.index.dayofweek
    out['is_weekend'] = out['dayofweek'].isin([5,6]).astype(int)
    return out


def aggregate(df: pd.DataFrame, rule: str | None = None) -> pd.DataFrame:
    if df.empty:
        return df
    rule = rule or config.AGG_INTERVAL
    agg_funcs = ['mean','std','min','max']
    agg = df.resample(rule).agg(agg_funcs)
    # Flatten multi-index columns
    agg.columns = [f'{col}_{stat}' for col, stat in agg.columns]
    # Fill any remaining gaps
    agg = agg.ffill().bfill()
    return agg


def build_feature_table() -> Tuple[pd.DataFrame, Dict[str, str]]:
    raw = load_raw()
    if raw.empty:
        return raw, {}
    cleaned = clean(raw)
    wide = pivot_parameters(cleaned)
    if wide.empty:
        return wide, {}
    features = add_time_features(wide)
    features = aggregate(features)
    metadata = {
        'rows': str(len(features)),
        'columns': str(len(features.columns)),
        'agg_interval': config.AGG_INTERVAL
    }
    log.info('Built feature table rows=%s cols=%s', metadata['rows'], metadata['columns'])
    return features, metadata
