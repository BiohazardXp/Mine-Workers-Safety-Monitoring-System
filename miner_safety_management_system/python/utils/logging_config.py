import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from .. import config  # type: ignore

LOG_FILE = config.LOGS_DIR / 'ml_service.log'

_formatter = logging.Formatter(
    '%(asctime)s | %(levelname)s | %(name)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def get_logger(name: str = 'ml') -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)

    ch = logging.StreamHandler()
    ch.setFormatter(_formatter)
    logger.addHandler(ch)

    fh = RotatingFileHandler(LOG_FILE, maxBytes=2_000_000, backupCount=3)
    fh.setFormatter(_formatter)
    logger.addHandler(fh)

    return logger
