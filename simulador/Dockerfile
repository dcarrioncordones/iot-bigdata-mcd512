FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY simulador_sensores.py .
CMD ["python", "-u", "simulador_sensores.py"]
