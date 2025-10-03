from __future__ import annotations
import uvicorn
from . import config  # type: ignore
from .services.api import app  # type: ignore

if __name__ == '__main__':
    uvicorn.run(app, host=config.APP_HOST, port=config.APP_PORT, log_level='info')
