#!/bin/sh
set -e

# First try to connect to postgres database to check if server is up
until PGPASSWORD=$DB_PASS psql -h "$DB_HOST" -U "$DB_USER" -d "postgres" -c '\q'; do
  >&2 echo "⏳ Waiting for Postgres to be ready..."
  sleep 2
done

# Create database if it doesn't exist
PGPASSWORD=$DB_PASS psql -h "$DB_HOST" -U "$DB_USER" -d "postgres" -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
PGPASSWORD=$DB_PASS psql -h "$DB_HOST" -U "$DB_USER" -d "postgres" -c "CREATE DATABASE $DB_NAME"

# After creating the database:
PGPASSWORD=$DB_PASS psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f /db/churn_database.sql


>&2 echo "✅ Postgres is up - executing startup commands"
exec "$@"