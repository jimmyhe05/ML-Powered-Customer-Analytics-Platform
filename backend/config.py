import os
from urllib.parse import urlparse

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
    # Prefer a single DATABASE_URL when provided by managed platforms (Railway, Render, etc.)
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        # Railway/Heroku style URLs may use postgres://
        normalized = database_url.replace("postgres://", "postgresql://", 1)
        parsed = urlparse(normalized)
        return {
            "dbname": parsed.path.lstrip("/") or os.getenv("DB_NAME", "churn_prediction"),
            "user": parsed.username or os.getenv("DB_USER", "postgres"),
            "password": parsed.password or os.getenv("DB_PASS", "postgres"),
            "host": parsed.hostname or os.getenv("DB_HOST", "localhost"),
            "port": str(parsed.port or os.getenv("DB_PORT", "5432")),
        }

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
