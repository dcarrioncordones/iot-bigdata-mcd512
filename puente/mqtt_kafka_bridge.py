"""
Puente de transferencia MQTT -> Kafka.

MQTT es el protocolo del borde (ligero, pensado para dispositivos con poco
ancho de banda). Kafka es el bus de la nube: retiene los mensajes, permite
varios consumidores independientes y desacopla la ingesta del procesamiento.

Este proceso se suscribe a todos los topicos de la planta y reenvia cada
mensaje a un unico topico de Kafka, usando el ID de maquina como clave para
que las lecturas de una misma maquina caigan siempre en la misma particion
(garantiza orden por maquina).
"""

import json
import os
import signal
import sys
import time

import paho.mqtt.client as mqtt
from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "planta/#")
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC", "planta.sensores")

contador = {"ok": 0, "error": 0}


def crear_productor(reintentos=15, espera=4):
    """Kafka puede tardar en levantar; se reintenta la conexion."""
    for intento in range(1, reintentos + 1):
        try:
            return KafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",              # confirmacion de todas las replicas
                linger_ms=200,           # micro-batching: menos round-trips
                compression_type="gzip", # menos ancho de banda hacia la nube
                retries=5,
            )
        except NoBrokersAvailable:
            print(f"[puente] Kafka no disponible (intento {intento}/{reintentos})", flush=True)
            time.sleep(espera)
    print("[puente] No se pudo conectar a Kafka", file=sys.stderr, flush=True)
    sys.exit(1)


productor = crear_productor()


def al_conectar(cliente, userdata, flags, rc):
    print(f"[puente] Conectado a MQTT (rc={rc}); suscrito a {MQTT_TOPIC}", flush=True)
    cliente.subscribe(MQTT_TOPIC, qos=1)


def al_recibir(cliente, userdata, mensaje):
    try:
        lectura = json.loads(mensaje.payload.decode("utf-8"))
        lectura["topico_mqtt"] = mensaje.topic
        productor.send(KAFKA_TOPIC, key=lectura.get("maquina"), value=lectura)
        contador["ok"] += 1
        if contador["ok"] % 200 == 0:
            print(f"[puente] {contador['ok']} mensajes reenviados a Kafka", flush=True)
    except Exception as exc:  # noqa: BLE001
        contador["error"] += 1
        print(f"[puente] Error procesando mensaje: {exc}", file=sys.stderr, flush=True)


def al_terminar(signum, frame):
    print(f"[puente] Cerrando. OK={contador['ok']} errores={contador['error']}", flush=True)
    productor.flush()
    productor.close()
    sys.exit(0)


signal.signal(signal.SIGTERM, al_terminar)
signal.signal(signal.SIGINT, al_terminar)

cliente = mqtt.Client(client_id="puente-mqtt-kafka", protocol=mqtt.MQTTv311)
cliente.on_connect = al_conectar
cliente.on_message = al_recibir
cliente.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
cliente.loop_forever()
