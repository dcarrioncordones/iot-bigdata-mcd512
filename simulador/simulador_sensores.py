"""
Simulador de dispositivos IoT de una planta de manufactura.

Reemplaza a los sensores fisicos (o a un flujo de Node-RED) generando
telemetria realista de cuatro maquinas y publicandola por MQTT.

Cada maquina publica en el topico:
    planta/<linea>/<maquina>/telemetria

Regimen de operacion:
  - Estado NORMAL: las variables oscilan alrededor de su valor nominal.
  - Estado DEGRADACION: a partir de cierto minuto, una maquina empieza a
    calentarse y a vibrar progresivamente (falla incipiente de rodamiento).
  - Eventos PICO: de forma aleatoria (baja probabilidad) aparecen picos
    puntuales de vibracion, que es lo que el modelo debe detectar.
"""

import json
import os
import random
import signal
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
INTERVALO = float(os.getenv("INTERVALO_SEG", "2"))
SEMILLA = int(os.getenv("SEMILLA", "42"))

random.seed(SEMILLA)

# Catalogo de maquinas: valores nominales por variable
MAQUINAS = [
    {
        "id": "MAQ-01", "linea": "L1", "tipo": "extrusora",
        "vibracion": 2.1, "temperatura": 62.0, "corriente": 18.5, "rpm": 1480,
        "degrada_en_min": None,
    },
    {
        "id": "MAQ-02", "linea": "L1", "tipo": "prensa",
        "vibracion": 3.4, "temperatura": 58.0, "corriente": 24.0, "rpm": 980,
        "degrada_en_min": None,
    },
    {
        "id": "MAQ-03", "linea": "L2", "tipo": "compresor",
        "vibracion": 2.8, "temperatura": 70.0, "corriente": 31.0, "rpm": 2950,
        "degrada_en_min": 5,      # esta maquina desarrolla una falla
    },
    {
        "id": "MAQ-04", "linea": "L2", "tipo": "bomba",
        "vibracion": 1.6, "temperatura": 54.0, "corriente": 12.0, "rpm": 1750,
        "degrada_en_min": None,
    },
]

# Desviacion tipica del ruido de cada sensor
RUIDO = {"vibracion": 0.12, "temperatura": 0.8, "corriente": 0.5, "rpm": 12}

_seguir = True


def _detener(signum, frame):
    global _seguir
    _seguir = False


signal.signal(signal.SIGTERM, _detener)
signal.signal(signal.SIGINT, _detener)


def factor_degradacion(maquina, minutos_activo):
    """Devuelve cuanto se ha degradado la maquina (0 = sana)."""
    inicio = maquina["degrada_en_min"]
    if inicio is None or minutos_activo < inicio:
        return 0.0
    # Crecimiento lineal, tope en 1.0 a los 20 minutos de iniciada la falla
    return min((minutos_activo - inicio) / 20.0, 1.0)


def leer_sensor(maquina, minutos_activo):
    """Construye una lectura de las cuatro variables de una maquina."""
    deg = factor_degradacion(maquina, minutos_activo)
    pico = random.random() < 0.01          # 1% de lecturas con pico puntual

    vibracion = maquina["vibracion"] * (1 + 1.6 * deg) + random.gauss(0, RUIDO["vibracion"])
    temperatura = maquina["temperatura"] + 18 * deg + random.gauss(0, RUIDO["temperatura"])
    corriente = maquina["corriente"] * (1 + 0.35 * deg) + random.gauss(0, RUIDO["corriente"])
    rpm = maquina["rpm"] * (1 - 0.06 * deg) + random.gauss(0, RUIDO["rpm"])

    if pico:
        vibracion *= random.uniform(2.0, 3.2)
        corriente *= random.uniform(1.3, 1.7)

    return {
        "maquina": maquina["id"],
        "linea": maquina["linea"],
        "tipo": maquina["tipo"],
        "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "vibracion_mm_s": round(vibracion, 3),
        "temperatura_c": round(temperatura, 2),
        "corriente_a": round(corriente, 2),
        "rpm": round(rpm, 1),
        "estado_real": "degradada" if deg > 0.15 else "normal",  # solo para validar el modelo
    }


def main():
    cliente = mqtt.Client(client_id="simulador-planta", protocol=mqtt.MQTTv311)
    cliente.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    cliente.loop_start()
    print(f"[simulador] Conectado a MQTT {MQTT_HOST}:{MQTT_PORT}", flush=True)

    inicio = time.time()
    enviados = 0

    while _seguir:
        minutos = (time.time() - inicio) / 60.0
        for maquina in MAQUINAS:
            lectura = leer_sensor(maquina, minutos)
            topico = f"planta/{maquina['linea']}/{maquina['id']}/telemetria"
            # QoS 1: garantiza entrega al broker, suficiente para telemetria
            cliente.publish(topico, json.dumps(lectura), qos=1)
            enviados += 1
        if enviados % 100 == 0:
            print(f"[simulador] {enviados} lecturas publicadas "
                  f"({minutos:.1f} min de operacion)", flush=True)
        time.sleep(INTERVALO)

    cliente.loop_stop()
    cliente.disconnect()
    print(f"[simulador] Detenido. Total publicado: {enviados}", flush=True)


if __name__ == "__main__":
    main()
