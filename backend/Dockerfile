FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libfontconfig1 \
    libgdk-pixbuf-xlib-2.0-0 \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Use gevent worker for SSE streaming support (handles concurrent long-lived connections)
CMD gunicorn run:app --bind 0.0.0.0:$PORT --worker-class gevent --workers 1 --worker-connections 100 --timeout 120
