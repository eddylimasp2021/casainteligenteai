FROM python:3.11-slim

WORKDIR /app

# Install dependencies for OpenCV headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py haarcascade_frontalface_default.xml* .

EXPOSE 5000

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
