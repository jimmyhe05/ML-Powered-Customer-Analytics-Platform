import os

def get_env():
    return os.getenv("ENVIRONMENT", "local").lower()

def is_docker():
    return get_env() == "docker"

def is_aws():
    return get_env() == "aws"

def is_local():
    return get_env() == "local"

def get_row_limit():
    return int(os.getenv("DB_ROW_LIMIT", "10000"))

def get_db_config():
    return {
        "dbname": os.getenv("DB_NAME", "churn_prediction"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASS", "postgres"),
        "host": (
            os.getenv("DB_HOST", "db") if is_aws()
            else os.getenv("DB_HOST", "db") if is_docker()
            else os.getenv("DB_HOST", "localhost")
        ),
        "port": os.getenv("DB_PORT", "5432"),
    }
