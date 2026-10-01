FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY mqtt_kafka_bridge.py .
CMD ["python", "-u", "mqtt_kafka_bridge.py"]
