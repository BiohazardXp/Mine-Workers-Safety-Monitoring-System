import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / 'data'
MODELS_DIR = BASE_DIR / 'models'
LOGS_DIR = BASE_DIR / 'logs'
REGISTRY_FILE = MODELS_DIR / 'registry.json'

for d in (DATA_DIR, MODELS_DIR, LOGS_DIR):
    d.mkdir(exist_ok=True)

# Environment configs
APP_HOST = os.getenv('ML_API_HOST', '0.0.0.0')
APP_PORT = int(os.getenv('ML_API_PORT', '8100'))
MODEL_NAME = os.getenv('DEFAULT_MODEL', 'baseline_regressor')
RANDOM_STATE = 42

# Data / Feature settings
TIME_COLUMN = 'timestamp'
VALUE_COLUMN = 'value'
CATEGORY_COLUMN = 'category'
PARAM_COLUMN = 'parameter'
DEVICE_ID_COLUMN = 'device_id'
EMPLOYEE_ID_COLUMN = 'employee_id'
AGG_INTERVAL = os.getenv('AGG_INTERVAL', '5min')  # pandas resample rule

# Training parameters
TEST_SIZE = 0.2
N_JOBS = int(os.getenv('N_JOBS', '1'))

