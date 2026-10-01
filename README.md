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

## 4. Capturas que hay que tomar

El informe en Word y el notebook ya tienen el espacio reservado para ocho capturas. Guárdalas
en `capturas/` con **exactamente** estos nombres (PNG):

| Archivo | Qué capturar |
|---|---|
| `01.png` | Salida de `docker compose ps` con los ocho servicios *healthy* |
| `02.png` | `docker compose logs -f simulador` publicando lecturas |
| `03.png` | `kafka-console-consumer` mostrando los JSON del tópico |
| `04.png` | http://localhost:9870 navegando `/datalake/crudo/telemetria` |
| `05.png` | `docker compose logs -f spark` con el conteo de anomalías por batch |
| `06.png` | http://localhost:4040 → pestaña *Structured Streaming* |
| `07.png` | Tablero completo de Grafana con datos en vivo |
| `08.png` | Detalle del panel de anomalías con MAQ-03 degradada |

En macOS: `Cmd + Shift + 4` guarda PNG en el Escritorio; renómbralo y muévelo a `capturas/`.

Después de colocarlas:

```bash
npm install docx           # una sola vez
node scripts/generar_informe.js
```

El Word queda regenerado con las imágenes insertadas. Mientras falte alguna, el documento
muestra un recuadro rojo señalando cuál es.

El notebook toma las capturas automáticamente al abrirlo, porque las referencia por ruta
relativa (`../capturas/NN.png`).

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
