# backend/Dockerfile
FROM python:3.10-slim-bullseye

WORKDIR /app

# Copy the backend code and requirements first
COPY requirements.txt .

RUN apt-get update && apt-get install -y \
    g++ \
    gcc \
    python3-dev \
    postgresql-client \
    && pip install --upgrade pip \
    && pip install gunicorn \
    && pip install -r requirements.txt \
    && apt-get purge -y g++ gcc python3-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

# Copy *all backend code* into /app
COPY . .

# Copy the churn_database.sql into /db
COPY db/churn_database.sql /db/churn_database.sql

EXPOSE 5000

# Setup wait-for-postgres
COPY wait-for-postgres.sh /app/wait-for-postgres.sh
RUN chmod +x /app/wait-for-postgres.sh

# Start using the wait script
CMD ["/app/wait-for-postgres.sh", "gunicorn", "-w", "2", "-t", "600", "-b", "0.0.0.0:5000", "app:app"]
