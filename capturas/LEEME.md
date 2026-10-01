# Capturas de evidencia

Guardar aquí las ocho capturas en PNG con estos nombres exactos:

| Archivo | Contenido |
|---|---|
| 01.png | `docker compose ps` con los servicios healthy |
| 02.png | Logs del simulador publicando por MQTT |
| 03.png | Consumidor de Kafka mostrando los mensajes |
| 04.png | UI del NameNode (localhost:9870) con /datalake/crudo |
| 05.png | Logs de Spark con anomalías por micro-batch |
| 06.png | Spark UI (localhost:4040), pestaña Structured Streaming |
| 07.png | Dashboard de Grafana con datos en vivo |
| 08.png | Panel de anomalías con MAQ-03 degradada |

Luego: `node scripts/generar_informe.js` para reinsertarlas en el Word.
