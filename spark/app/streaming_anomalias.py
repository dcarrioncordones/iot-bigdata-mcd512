"""
Procesamiento en tiempo real con Spark Structured Streaming.

Levanta dos consultas en paralelo sobre el mismo topico de Kafka:

  1) CRUDO -> HDFS: escribe todas las lecturas en Parquet, particionadas por
     fecha y linea. Es el data lake: dato inmutable, barato, para reentrenar
     modelos y hacer analisis historico (batch).

  2) SCORING -> InfluxDB: en cada micro-batch aplica el Isolation Forest
     entrenado offline y publica las lecturas con su score de anomalia en la
     base de series de tiempo, que es la que alimenta Grafana.

Este es el patron de arquitectura Lambda/Kappa: una via caliente de baja
latencia y una via fria de alto volumen, alimentadas por el mismo flujo.
"""

import os
import sys

import pandas as pd
from joblib import load
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (DoubleType, StringType, StructField,
                               StructType, TimestampType)

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "kafka:9092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "planta.sensores")
HDFS_URI = os.getenv("HDFS_URI", "hdfs://hdfs:8020")
INFLUX_URL = os.getenv("INFLUX_URL", "http://influxdb:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "token-mcd512-bigdata")
INFLUX_ORG = os.getenv("INFLUX_ORG", "intec")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "planta")
RUTA_MODELO = os.getenv("RUTA_MODELO", "/app/ml/modelo_anomalias.joblib")

RUTA_CRUDO = f"{HDFS_URI}/datalake/crudo/telemetria"
CKPT_CRUDO = f"{HDFS_URI}/datalake/checkpoints/crudo"
CKPT_SCORING = f"{HDFS_URI}/datalake/checkpoints/scoring"

# Esquema explicito: en streaming nunca se infiere el esquema
ESQUEMA = StructType([
    StructField("maquina", StringType()),
    StructField("linea", StringType()),
    StructField("tipo", StringType()),
    StructField("ts", TimestampType()),
    StructField("vibracion_mm_s", DoubleType()),
    StructField("temperatura_c", DoubleType()),
    StructField("corriente_a", DoubleType()),
    StructField("rpm", DoubleType()),
    StructField("estado_real", StringType()),
    StructField("topico_mqtt", StringType()),
])

COLUMNAS = ["vibracion_mm_s", "temperatura_c", "corriente_a", "rpm"]


# --------------------------------------------------------------------------
# Modelo de anomalias
# --------------------------------------------------------------------------
if not os.path.exists(RUTA_MODELO):
    print(f"[spark] No existe el modelo en {RUTA_MODELO}. "
          f"Ejecuta primero: docker compose run --rm spark python3 /app/ml/entrenar_modelo.py",
          file=sys.stderr, flush=True)
    sys.exit(1)

BUNDLE = load(RUTA_MODELO)
MODELO, ESCALADOR, BASE = BUNDLE["modelo"], BUNDLE["escalador"], BUNDLE["base"]
print(f"[spark] Modelo cargado desde {RUTA_MODELO}", flush=True)


def construir_features(pdf):
    """Razones contra el valor nominal de cada maquina (igual que en el entrenamiento)."""
    salida = pd.DataFrame(index=pdf.index)
    for col in COLUMNAS:
        referencia = pdf["maquina"].map(
            lambda m, c=col: BASE.get(m, BASE["MAQ-01"])[c]).astype(float)
        salida[f"r_{col}"] = pdf[col].astype(float) / referencia
    return salida


# --------------------------------------------------------------------------
# Sink hacia InfluxDB
# --------------------------------------------------------------------------
def escribir_en_influx(df_batch, id_batch):
    """Se ejecuta una vez por micro-batch: puntua y escribe en la serie de tiempo."""
    from influxdb_client import InfluxDBClient, Point, WritePrecision
    from influxdb_client.client.write_api import SYNCHRONOUS

    pdf = df_batch.toPandas()
    if pdf.empty:
        return

    X = ESCALADOR.transform(construir_features(pdf))
    # score_samples: mientras mas negativo, mas anomalo
    pdf["score_anomalia"] = -MODELO.score_samples(X)
    pdf["es_anomalia"] = (MODELO.predict(X) == -1).astype(int)

    puntos = []
    for fila in pdf.itertuples(index=False):
        punto = (
            Point("telemetria")
            .tag("maquina", fila.maquina)
            .tag("linea", fila.linea)
            .tag("tipo", fila.tipo)
            .field("vibracion_mm_s", float(fila.vibracion_mm_s))
            .field("temperatura_c", float(fila.temperatura_c))
            .field("corriente_a", float(fila.corriente_a))
            .field("rpm", float(fila.rpm))
            .field("score_anomalia", float(fila.score_anomalia))
            .field("es_anomalia", int(fila.es_anomalia))
            .time(fila.ts, WritePrecision.MS)
        )
        puntos.append(punto)

    with InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG) as cliente:
        cliente.write_api(write_options=SYNCHRONOUS).write(bucket=INFLUX_BUCKET, record=puntos)

    print(f"[spark] batch {id_batch}: {len(pdf)} lecturas, "
          f"{int(pdf['es_anomalia'].sum())} anomalias", flush=True)


# --------------------------------------------------------------------------
# Pipeline
# --------------------------------------------------------------------------
def main():
    spark = (
        SparkSession.builder
        .appName("planta-iot-anomalias")
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.streaming.schemaInference", "false")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    crudo = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
        .option("subscribe", KAFKA_TOPIC)
        .option("startingOffsets", "latest")
        .option("maxOffsetsPerTrigger", 2000)   # control de contrapresion
        .load()
    )

    lecturas = (
        crudo.select(F.from_json(F.col("value").cast("string"), ESQUEMA).alias("d"))
        .select("d.*")
        .filter(F.col("maquina").isNotNull())
        .withColumn("fecha", F.to_date("ts"))
    )

    # --- Consulta 1: data lake en HDFS -----------------------------------
    q_lake = (
        lecturas.writeStream
        .format("parquet")
        .option("path", RUTA_CRUDO)
        .option("checkpointLocation", CKPT_CRUDO)
        .partitionBy("fecha", "linea")
        .outputMode("append")
        .trigger(processingTime="30 seconds")
        .queryName("crudo_a_hdfs")
        .start()
    )

    # --- Consulta 2: scoring + serie de tiempo ---------------------------
    q_score = (
        lecturas.writeStream
        .foreachBatch(escribir_en_influx)
        .option("checkpointLocation", CKPT_SCORING)
        .outputMode("append")
        .trigger(processingTime="10 seconds")
        .queryName("scoring_a_influxdb")
        .start()
    )

    print("[spark] Consultas activas: crudo_a_hdfs, scoring_a_influxdb", flush=True)
    spark.streams.awaitAnyTermination()


if __name__ == "__main__":
    main()
