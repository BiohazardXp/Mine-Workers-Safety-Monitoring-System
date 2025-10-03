from __future__ import annotations
import pandas as pd
from pathlib import Path
from typing import List
from .. import config  # type: ignore

from .logging_config import get_logger

log = get_logger('io')

CSV_GLOB = '*.csv'


def list_csv_files(data_dir: Path | None = None) -> List[Path]:
    data_dir = data_dir or config.DATA_DIR
    files = sorted(data_dir.glob(CSV_GLOB))
    log.info(f'Found {len(files)} CSV files in %s', data_dir)
    return files


def load_csv(file_path: Path) -> pd.DataFrame:
    try:
        df = pd.read_csv(file_path)
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        return df
    except Exception as e:
        log.exception('Failed loading %s: %s', file_path, e)
        raise


def load_all_csv(data_dir: Path | None = None) -> pd.DataFrame:
    frames = []
    for f in list_csv_files(data_dir):
        frames.append(load_csv(f))
    if not frames:
        return pd.DataFrame()
    df = pd.concat(frames, ignore_index=True)
    return df
