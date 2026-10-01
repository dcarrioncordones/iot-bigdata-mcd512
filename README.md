# Integración IoT + Big Data — Mantenimiento predictivo

**MCD512-01 Big Data · INTEC · Prof. José M. Aquino Cepeda, MSc.**

Prototipo funcional que captura telemetría de sensores IoT en una planta de manufactura, la
transfiere por MQTT y Kafka, la almacena en HDFS e InfluxDB, detecta anomalías con Spark +
Isolation Forest y la visualiza en Grafana.

---

## 1. Requisitos

- Docker Desktop (probado en macOS Apple Silicon / arm64 y en Linux x86_64)
- ~8 GB de RAM libres para Docker
- Node.js (solo para regenerar el informe Word)
- Python 3.11+ con un entorno virtual (solo para ejecutar el notebook)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-notebook.txt
```

## 2. Levantar el stack

```bash
docker compose up -d --build            # la primera vez tarda: construye HDFS y Spark
docker compose run --rm spark python3 /app/ml/entrenar_modelo.py
docker compose restart spark
docker compose ps
```

Deja correr el sistema **al menos 25 minutos**: MAQ-03 empieza a degradarse en el minuto 5 y la
falla se vuelve evidente alrededor del minuto 15.

| Servicio | URL / puerto | Credenciales |
|---|---|---|
| Grafana | http://localhost:3000 | admin / admin |
| InfluxDB | http://localhost:8086 | admin / intec2025mcd512 |
| HDFS NameNode | http://localhost:9870 | — |
| Spark UI | http://localhost:4040 | — |
| Kafka (desde el host) | localhost:29092 | — |
| MQTT | localhost:1883 | anónimo |

## 3. Verificaciones rápidas

```bash
# Mensajes llegando al broker MQTT
docker compose exec mosquitto mosquitto_sub -t 'planta/#' -C 5

# Mensajes en el tópico de Kafka
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 --topic planta.sensores --max-messages 5

# Data lake creciendo en HDFS
docker compose exec hdfs hdfs dfs -ls -R /datalake/crudo | tail -10
docker compose exec hdfs hdfs dfs -du -h /datalake

# Spark procesando y marcando anomalías
docker compose logs -f spark
```

## 4. Evidencia de ejecución

La carpeta `capturas/` contiene la evidencia de una corrida completa de ~27 minutos:

| Archivo | Contenido |
|---|---|
| `01.png` | Los ocho servicios desplegados con `docker compose ps` |
| `02.png` | Simulador publicando lecturas por MQTT |
| `03.png` | Mensajes JSON consumidos del tópico de Kafka |
| `04.png` | Data lake en HDFS particionado por fecha y línea |
| `05.png` | Micro-batches de Spark con anomalías detectadas |
| `05b.png` | Arranque de Spark y carga del modelo entrenado |
| `06.png` | Spark UI con las dos consultas de streaming |
| `07.png` | Dashboard de Grafana con la degradación de MAQ-03 |
| `08.png` | Paneles de detección: 551 de 595 anomalías en MAQ-03 |

El informe técnico está en `docs/` (Word) y en `notebooks/` (notebook ejecutado,
con las capturas incrustadas).

## 5. Ejecutar el informe en Jupyter

```bash
source .venv/bin/activate
jupyter lab notebooks/informe_iot_bigdata.ipynb
```

Las secciones 5 y 8 corren sin el stack levantado (usan el simulador en local). La sección 10
requiere los contenedores en marcha, porque lee del data lake y de InfluxDB.

## 6. Apagar

```bash
docker compose down          # conserva los datos
docker compose down -v       # borra volúmenes de HDFS e InfluxDB
```

## 7. Problemas conocidos

- **HDFS no arranca tras `down -v`:** el NameNode se reformatea solo al detectar el volumen
  vacío; si quedó a medias, `docker compose down -v && docker compose up -d hdfs`.
- **Spark sale con error de modelo no encontrado:** falta el paso de entrenamiento; ejecuta
  `docker compose run --rm spark python3 /app/ml/entrenar_modelo.py` y reinicia el servicio.
- **Grafana sin datos:** confirma que Spark esté escribiendo (`docker compose logs spark`) y
  que el rango de tiempo del tablero cubra el periodo de ejecución.
- **Build lento la primera vez:** la imagen de HDFS descarga el tarball de Hadoop (~700 MB) y
  la de Spark instala PySpark; a partir de ahí quedan en caché.

## 8. Estructura

```
docker-compose.yml          Orquestación de los 8 servicios
simulador/                  Dispositivos IoT simulados (publican por MQTT)
puente/                     Puente MQTT → Kafka
spark/app/                  Job de Structured Streaming + scoring de anomalías
ml/entrenar_modelo.py       Entrenamiento del Isolation Forest
hadoop/                     Imagen HDFS multiarquitectura (arm64 + amd64)
grafana/                    Datasource y dashboard aprovisionados
notebooks/                  Informe técnico ejecutable
scripts/                    Generadores del diagrama, el notebook y el Word
capturas/                   Evidencia de ejecución (01–08.png)
docs/                       Diagrama de arquitectura e informe en Word
```
