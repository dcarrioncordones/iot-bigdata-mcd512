# Guía de ejecución — Proyecto IoT + Big Data (MCD512)

Pasos en orden, desde descomprimir el zip hasta tener listos los entregables.
Tiempo estimado: **3–4 horas**, más 30–60 min de margen para imprevistos.

---

## 0. Requisitos

| Herramienta | Para qué | Verificar |
|---|---|---|
| Docker Desktop | Correr los 8 servicios | `docker --version` |
| Python 3.11+ | Notebook | `python3 --version` |
| Node.js | Regenerar el Word | `node --version` |
| Cursor | Editor, terminal y notebook | — |

En Docker Desktop → **Settings → Resources**, asigna al menos **8 GB de RAM** y 4 CPU.

---

## 1. Preparar el proyecto

1. Descomprime `iot-bigdata-mcd512.zip` y abre la carpeta en Cursor (**File → Open Folder**).
2. Abre la terminal integrada (`Cmd + J`) y ejecuta:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-notebook.txt
npm install docx
```

---

## 2. Personalizar la portada del Word

Abre `scripts/generar_informe.js`, busca el párrafo `"Propuesta conceptual y prototipo funcional"`
y justo debajo agrega los integrantes y la fecha:

```js
new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 80 },
  children: [new TextRun({ text: "Presentado por:", size: 22, bold: true })],
}),
new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 80 },
  children: [new TextRun({ text: "Nombre Apellido — Matrícula", size: 22 })],
}),
// repite el bloque anterior por cada integrante
new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 500 },
  children: [new TextRun({ text: "Fecha de entrega", size: 22 })],
}),
```

---

## 3. Construir las imágenes (se puede hacer la noche antes)

```bash
docker compose build
```

Tarda 20–30 min la primera vez: descarga Hadoop (~700 MB) e instala PySpark. Después queda en caché.

---

## 4. Levantar el sistema

```bash
docker compose up -d
docker compose run --rm spark python3 /app/ml/entrenar_modelo.py
docker compose restart spark
docker compose ps
```

El entrenamiento debe imprimir `"prediccion_lectura_sana": 1` y `"prediccion_lectura_con_falla": -1`.
Espera 1–2 minutos hasta que todos los servicios aparezcan como `healthy` o `running`.

**A partir de aquí empieza a contar el tiempo de la corrida.**

---

## 5. Cronograma de la corrida y capturas

La máquina MAQ-03 empieza a degradarse en el **minuto 5** y la falla es evidente hacia el **minuto 15–20**.
Guarda cada captura en `capturas/` con el nombre exacto (en macOS: `Cmd + Shift + 4`, luego renombrar).

| Minuto | Captura | Cómo obtenerla |
|---|---|---|
| 0–2 | `01.png` | `docker compose ps` |
| 2–3 | `02.png` | `docker compose logs -f simulador` (salir con `Ctrl + C`) |
| 3–4 | `03.png` | Comando de Kafka de abajo |
| 5–8 | `04.png` | http://localhost:9870 → **Utilities → Browse the file system** → `/datalake/crudo/telemetria` |
| 8–10 | `05.png` | `docker compose logs -f spark` |
| 8–10 | `06.png` | http://localhost:4040 → pestaña **Structured Streaming** |
| 10–12 | `07.png` | http://localhost:3000 (admin / admin) → dashboard **Planta IoT** |
| 20–25 | `08.png` | Mismo dashboard, con MAQ-03 destacando en los paneles de anomalías |

Comando para la captura 03:

```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 --topic planta.sensores --max-messages 5
```

Consejo para la 08: en Grafana, cambia el rango a **Last 30 minutes** para que se vea el antes y el después.

---

## 6. Ejecutar el notebook

**Con el stack todavía corriendo:**

1. Abre `notebooks/informe_iot_bigdata.ipynb` en Cursor.
2. Selecciona el kernel del entorno `.venv` (esquina superior derecha).
3. **Run All**.

Revisa que:

- Las capturas aparezcan en sus secciones.
- La sección 8.3 muestre la matriz de confusión y los dos gráficos.
- La sección 10 recupere lecturas del data lake y consulte InfluxDB sin error.

Guarda el notebook con las salidas visibles.

---

## 7. Generar el informe en Word

```bash
node scripts/generar_informe.js
```

Si no aparece el mensaje `Capturas pendientes`, están todas. Abre
`docs/Informe_IoT_BigData_MCD512.docx` y:

1. Clic derecho sobre la tabla de contenido → **Actualizar campo → Actualizar toda la tabla**.
2. Revisa que ninguna figura muestre el recuadro rojo de pendiente.
3. Lee el documento completo para poder explicarlo en la presentación.

---

## 8. Apagar

```bash
docker compose down        # conserva los datos
docker compose down -v     # borra todo (HDFS e InfluxDB)
```

---

## 9. Checklist de entrega

Contra los entregables sugeridos en la consigna:

- [ ] **Diagrama de arquitectura** → `docs/arquitectura.png` (también dentro del Word)
- [ ] **Scripts de ingestión en Python** → `simulador/`, `puente/`, `spark/app/`, `ml/`
- [ ] **Dashboard de supervisión en Grafana** → capturas 07 y 08 + `grafana/dashboards/planta.json`
- [ ] **Documentación técnica** → Word + notebook con salidas
- [ ] Las 8 capturas en `capturas/`
- [ ] Portada con nombres y fecha

Para entregar el código, comprime la carpeta **sin** `.venv/`, `node_modules/` ni `datos_export/`.

---

## 10. Solución de problemas

| Síntoma | Solución |
|---|---|
| `hdfs` nunca queda healthy | `docker compose logs hdfs`. Si quedó a medias: `docker compose down -v && docker compose up -d` |
| Spark se reinicia en bucle con "No existe el modelo" | Repetir el entrenamiento del paso 4 y `docker compose restart spark` |
| Grafana muestra "No data" | Verificar que Spark escriba (`docker compose logs spark`) y ampliar el rango de tiempo |
| La sección 10 del notebook falla | El stack debe estar corriendo; revisar que `docker` funcione desde la terminal de Cursor |
| Puerto ocupado (3000, 8086, 9870…) | Cerrar la app que lo usa o cambiar el puerto izquierdo en `docker-compose.yml` |
| Todo va lento | Subir la RAM asignada a Docker Desktop o cerrar aplicaciones pesadas |
