/**
 * Genera docs/Informe_IoT_BigData_MCD512.docx
 *
 * Lee las capturas de ../capturas/NN.png. Si una captura todavia no existe,
 * inserta un marcador visible para que se note que falta.
 *
 * Uso:   npm install docx    (una sola vez)
 *        node scripts/generar_informe.js
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  ImageRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  PageBreak, Footer, PageNumber, TableOfContents, LevelFormat, convertInchesToTwip,
} = require("docx");

const RAIZ = path.join(__dirname, "..");
const CAPTURAS = path.join(RAIZ, "capturas");
const SALIDA = path.join(RAIZ, "docs", "Informe_IoT_BigData_MCD512.docx");

const ANCHO_TABLA = 9360; // 6.5" en DXA

/* ------------------------------------------------------------------ utiles */

function p(texto, opciones = {}) {
  return new Paragraph({
    spacing: { after: 160, line: 300 },
    alignment: opciones.centrado ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    children: [new TextRun({ text: texto, size: 22, italics: !!opciones.cursiva })],
  });
}

function h1(texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text: texto, bold: true, size: 30, color: "1F2933" })],
  });
}

function h2(texto) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 140 },
    children: [new TextRun({ text: texto, bold: true, size: 25, color: "2C5F86" })],
  });
}

function vinheta(texto) {
  return new Paragraph({
    numbering: { reference: "lista-puntos", level: 0 },
    spacing: { after: 100 },
    children: [new TextRun({ text: texto, size: 22 })],
  });
}

function codigo(lineas) {
  return lineas.map((linea, i) => new Paragraph({
    spacing: { after: i === lineas.length - 1 ? 200 : 0, line: 260 },
    shading: { type: ShadingType.CLEAR, fill: "F2F4F6" },
    indent: { left: convertInchesToTwip(0.25) },
    children: [new TextRun({ text: linea, font: "Consolas", size: 18 })],
  }));
}

function pie(texto) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 260 },
    children: [new TextRun({ text: texto, size: 18, italics: true, color: "5A6673" })],
  });
}

/** Lee ancho y alto de un PNG desde su cabecera IHDR. */
function dimensionesPng(buffer) {
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
}

let numFigura = 0;

/** Inserta una imagen respetando su proporcion, o un marcador si no existe. */
function imagen(rutaAbs, maxAncho = 620, maxAlto = 560) {
  if (!fs.existsSync(rutaAbs)) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [new TextRun({
        text: `[ PENDIENTE: colocar ${path.relative(RAIZ, rutaAbs)} ]`,
        size: 20, bold: true, color: "A32438",
      })],
    });
  }
  const data = fs.readFileSync(rutaAbs);
  const { w, h } = dimensionesPng(data);
  let ancho = Math.min(maxAncho, w);
  let alto = Math.round(ancho * h / w);
  if (alto > maxAlto) { alto = maxAlto; ancho = Math.round(alto * w / h); }
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { before: 160, after: 80 },
    children: [new ImageRun({ type: "png", data, transformation: { width: ancho, height: alto } })],
  });
}

/** Imagen + pie numerado automaticamente. */
function figura(rutaAbs, leyenda, maxAncho, maxAlto) {
  numFigura += 1;
  return [imagen(rutaAbs, maxAncho, maxAlto), pie(`Figura ${numFigura} — ${leyenda}`)];
}

function captura(nombre, leyenda, maxAncho, maxAlto) {
  return figura(path.join(CAPTURAS, `${nombre}.png`), leyenda, maxAncho, maxAlto);
}

function tabla(encabezados, filas, anchos) {
  const celda = (texto, bold, fill) => new TableCell({
    width: { size: anchos[0], type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text: texto, size: 20, bold: !!bold })] })],
  });

  const fila = (valores, bold, fill) => new TableRow({
    children: valores.map((v, i) => new TableCell({
      width: { size: anchos[i], type: WidthType.DXA },
      shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: v, size: 20, bold: !!bold })] })],
    })),
  });

  void celda;
  return new Table({
    columnWidths: anchos,
    width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    rows: [fila(encabezados, true, "E8F1F8"), ...filas.map((f) => fila(f, false))],
  });
}

/* ---------------------------------------------------------------- contenido */

const centrado = (texto, opts = {}) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: opts.after ?? 80 },
  children: [new TextRun({ text: texto, size: opts.size ?? 22, bold: !!opts.bold, italics: !!opts.italics, color: opts.color })],
});

const portada = [
  new Paragraph({ spacing: { before: 1400 }, children: [] }),
  centrado("MCD512-01 — BIG DATA", { size: 26, bold: true, color: "5A6673", after: 120 }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({
      text: "Integración de IoT y Big Data para mantenimiento predictivo en una planta de manufactura",
      bold: true, size: 40, color: "1F2933",
    })],
  }),
  centrado("Propuesta conceptual y prototipo funcional", { size: 24, italics: true, color: "5A6673", after: 600 }),
  centrado("Presentado por:", { bold: true }),
  centrado("Dan Carrión — Matrícula 1131022", { after: 500 }),
  centrado("Prof. José M. Aquino Cepeda, MSc."),
  centrado("Docente", { after: 500 }),
  centrado("Maestría en Ciencia de Datos"),
  centrado("Instituto Tecnológico de Santo Domingo (INTEC)"),
  centrado("Santo Domingo, República Dominicana"),
  centrado("Septiembre 2026"),
  new Paragraph({ children: [new PageBreak()] }),

  h1("Contenido"),
  new TableOfContents("Tabla de contenido", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ children: [new PageBreak()] }),
];

const cuerpo = [
  h1("1. Introducción"),
  p("En la Industria 4.0 el valor no está en instalar sensores, sino en lo que se hace con lo que miden. Una planta de manufactura con máquinas rotativas —extrusoras, prensas, compresores, bombas— genera telemetría continua de vibración, temperatura, corriente y velocidad de giro. Ese flujo es pequeño por lectura pero enorme en agregado: cuatro máquinas muestreadas cada dos segundos producen alrededor de 172 mil lecturas diarias, y una planta real con doscientos activos supera los ocho millones."),
  p("El problema de negocio que resuelve este trabajo es el mantenimiento. El mantenimiento correctivo detiene la línea sin aviso y el preventivo por calendario reemplaza piezas que todavía tienen vida útil. El mantenimiento predictivo usa la telemetría para anticipar la falla y programar la intervención en la ventana de menor costo. Para lograrlo hacen falta las dos piezas del título: IoT para capturar el dato en el borde y Big Data para transportarlo, almacenarlo a escala y analizarlo."),
  p("Este documento presenta el diseño conceptual y un prototipo funcional que implementa la cadena completa, desde la generación de la telemetría hasta el tablero de monitoreo, junto con la evidencia de su ejecución de extremo a extremo."),

  h1("2. Objetivos"),
  vinheta("Diseñar e implementar una arquitectura IoT–Big Data por capas que capture datos de sensores en planta, los transmita eficientemente y los almacene en una plataforma escalable."),
  vinheta("Configurar la cadena de transferencia MQTT → Kafka, justificando el rol de cada protocolo dentro del flujo."),
  vinheta("Implementar almacenamiento dual: HDFS como data lake histórico e InfluxDB como base de series de tiempo para consulta en vivo."),
  vinheta("Aplicar Spark Structured Streaming y un modelo de aprendizaje no supervisado (Isolation Forest) para detectar anomalías en línea."),
  vinheta("Construir un tablero en Grafana que permita monitorear la planta y disparar alertas de mantenimiento."),
  vinheta("Evaluar el prototipo en capacidad de detección, latencia y escalabilidad."),

  h1("3. Arquitectura propuesta"),
  p("La solución se organiza en cinco capas. Cada una resuelve un problema distinto y puede escalarse por separado, que es precisamente la razón de separarlas."),
  ...figura(path.join(RAIZ, "docs", "arquitectura.png"), "Arquitectura IoT + Big Data por capas", 640),

  h2("3.1 Capa de dispositivos IoT (edge layer)"),
  p("Sensores de vibración, temperatura, corriente y RPM montados sobre cada máquina, conectados a un gateway —una Raspberry Pi en el diseño físico— que filtra ruido, agrega lecturas y publica por MQTT. En el prototipo, sensores y gateway se sustituyen por un simulador en Python que reproduce el comportamiento estadístico de cuatro máquinas reales."),
  h2("3.2 Capa de transferencia (fog / cloud layer)"),
  p("MQTT es el protocolo del borde: cabecera de dos bytes, tolerancia a enlaces intermitentes y funcionamiento con poco ancho de banda. Kafka es el bus de la nube: retiene los mensajes, permite que varios consumidores lean el mismo flujo sin interferirse y absorbe picos de ingesta. No compiten entre sí; se complementan. Un proceso puente traduce de un protocolo al otro."),
  h2("3.3 Capa de almacenamiento (big data layer)"),
  p("Dos destinos con propósitos distintos. HDFS guarda el dato crudo en formato Parquet, particionado por fecha y línea de producción, como registro inmutable para reentrenamiento de modelos y análisis histórico. InfluxDB guarda la serie de tiempo reciente, optimizada para las consultas por rango que el tablero ejecuta cada diez segundos."),
  h2("3.4 Capa de procesamiento y análisis"),
  p("Spark Structured Streaming consume de Kafka y ejecuta dos consultas en paralelo sobre el mismo flujo. La primera vuelca el dato crudo a HDFS; la segunda aplica el modelo de anomalías y escribe el resultado en InfluxDB. Es el patrón de vía caliente y vía fría, que permite optimizar cada camino por separado."),
  h2("3.5 Capa de visualización y acción"),
  p("Grafana consulta InfluxDB mediante el lenguaje Flux y presenta la telemetría por máquina, el score de anomalía y el conteo de eventos. Desde el mismo tablero se configuran las alertas que llegan al equipo de mantenimiento y disparan la orden de trabajo."),
  h2("3.6 Decisiones de diseño"),
  p("Cada componente se eligió frente a una alternativa razonable. La tabla siguiente resume el criterio aplicado."),
  tabla(
    ["Decisión", "Alternativa considerada", "Criterio de selección"],
    [
      ["MQTT en el borde", "HTTP / REST", "Menor overhead por mensaje; QoS y reconexión nativos"],
      ["Kafka como bus", "Escritura directa a la base", "Desacopla ingesta de procesamiento; permite reprocesar"],
      ["Parquet sobre HDFS", "JSON o CSV crudo", "Formato columnar comprimido: menos espacio, lectura selectiva"],
      ["Isolation Forest", "Umbrales fijos por variable", "Detecta combinaciones anómalas sin datos etiquetados"],
      ["InfluxDB junto a HDFS", "Solo HDFS", "HDFS no responde con la latencia que exige un tablero en vivo"],
    ],
    [2800, 2800, 3760],
  ),
  new Paragraph({ spacing: { after: 240 }, children: [] }),

  h1("4. Despliegue del prototipo"),
  p("Todo el stack corre en contenedores orquestados con Docker Compose sobre un Mac con Apple Silicon. Las imágenes fueron seleccionadas o construidas para arquitectura arm64: HDFS y Spark se construyen sobre un JRE multiplataforma porque las imágenes oficiales de Hadoop solo se publican para amd64."),
  ...codigo([
    "docker compose up -d --build",
    "docker compose run --rm spark python3 /app/ml/entrenar_modelo.py",
    "docker compose restart spark",
    "docker compose ps",
  ]),
  p("La Figura 2 muestra los ocho servicios en ejecución. Los cuatro que declaran verificación de salud —HDFS, InfluxDB, Kafka y Mosquitto— aparecen como healthy. Spark registra un tiempo de actividad menor que el resto porque se reinició después de entrenar el modelo, tal como indica el procedimiento."),
  ...captura("01", "Servicios del stack desplegados con docker compose"),

  h1("5. Capa 1 — Simulación de dispositivos IoT"),
  p("El simulador modela cuatro máquinas con valores nominales distintos y tres regímenes de operación: funcionamiento normal con ruido gaussiano, degradación progresiva de una máquina —MAQ-03, un compresor que empieza a fallar a los cinco minutos— y picos puntuales aleatorios con probabilidad del uno por ciento en todas las máquinas."),
  p("La degradación modela la firma típica de un rodamiento en deterioro: vibración, temperatura y corriente en ascenso mientras las RPM caen ligeramente. Cada ciclo publica una lectura por máquina cada dos segundos; el registro de la Figura 3 muestra la conexión al broker y el contador acumulado de lecturas publicadas."),
  ...captura("02", "Simulador conectado a Mosquitto y publicando lecturas"),

  h1("6. Capa 2 — Transferencia MQTT → Kafka"),
  p("El broker Mosquitto recibe las publicaciones en tópicos jerárquicos con el patrón planta/línea/máquina/telemetria, usando QoS 1, que garantiza al menos una entrega. El puente se suscribe al comodín planta/# y reenvía cada mensaje a Kafka empleando el identificador de máquina como clave de partición, de modo que todas las lecturas de una misma máquina conserven su orden."),
  p("Dos ajustes de eficiencia merecen mención en el productor de Kafka: el parámetro linger_ms agrupa mensajes en micro-lotes en lugar de hacer un viaje de red por lectura, y la compresión gzip reduce el volumen transferido, que en un despliegue real sobre enlace celular se traduce en costo directo."),
  p("La Figura 4 muestra cinco mensajes leídos directamente del tópico planta.sensores. Cada uno conserva el tópico MQTT de origen, lo que permite trazar la lectura hasta el dispositivo. El mensaje de MAQ-03 ya aparece con estado degradada, con 3.64 mm/s de vibración y 73.3 °C frente a sus valores nominales de 2.8 mm/s y 70 °C."),
  ...captura("03", "Mensajes JSON consumidos del tópico planta.sensores en Kafka"),

  h1("7. Capa 3 — Almacenamiento escalable"),
  h2("7.1 Data lake sobre HDFS"),
  p("Spark escribe el dato crudo en hdfs://hdfs:8020/datalake/crudo/telemetria, particionado por fecha y línea. El particionado permite que una consulta sobre un día o una línea concretos lea únicamente ese directorio en lugar de recorrer el histórico completo, técnica conocida como partition pruning. El formato Parquet añade compresión y lectura por columnas."),
  p("La Figura 5 muestra la estructura resultante: dentro de la partición fecha=2026-09-28 aparecen las subparticiones linea=L1 y linea=L2. Que los directorios marquen 0 B es normal, porque HDFS no agrega el tamaño de su contenido; los archivos Parquet están dentro de cada subpartición."),
  ...captura("04", "Explorador del NameNode con el data lake particionado por fecha y línea"),
  h2("7.2 Serie de tiempo sobre InfluxDB"),
  p("InfluxDB recibe cada lectura enriquecida con el resultado del modelo. El esquema usa máquina, línea y tipo como tags indexados, que son los campos por los que se filtra, y las variables físicas junto al score de anomalía como fields. La política de retención se fijó en treinta días: pasado ese plazo el dato vive únicamente en el data lake, que resulta considerablemente más barato por gigabyte almacenado."),

  h1("8. Capa 4 — Procesamiento y detección de anomalías"),
  h2("8.1 El job de streaming"),
  p("El job levanta dos consultas sobre el mismo readStream de Kafka. El esquema se declara de forma explícita porque en streaming no puede inferirse, y el parámetro maxOffsetsPerTrigger limita cuántos registros entran por micro-batch, que es el mecanismo de contrapresión cuando la ingesta supera la capacidad de procesamiento."),
  h2("8.2 El modelo de detección"),
  p("Se emplea Isolation Forest, un método no supervisado que aísla observaciones raras mediante árboles de partición aleatoria. La elección responde a la realidad de una planta: casi nunca existen datos etiquetados de fallas, porque las fallas son escasas y no siempre quedan registradas con precisión temporal."),
  p("El detalle metodológico relevante es la construcción de las variables de entrada. Las cuatro máquinas operan en rangos muy distintos —una bomba a 1.6 mm/s y una prensa a 3.4 mm/s son ambas normales—, de modo que en lugar de los valores absolutos se utilizan razones contra el valor nominal de cada máquina. Esa normalización permite que un solo modelo cubra activos heterogéneos."),
  p("El modelo se entrena una sola vez, de forma offline, y se guarda en ml/modelo_anomalias.joblib. El job de Spark no entrena: carga ese archivo al arrancar y lo aplica a cada micro-batch. Esta separación entre entrenamiento e inferencia es el patrón habitual en producción, porque entrenar dentro del flujo sería costoso y haría que el modelo cambiara continuamente. El entrenamiento se ejecuta dentro del mismo contenedor de Spark para garantizar la misma versión de scikit-learn en ambas etapas."),
  p("La Figura 6 documenta ese comportamiento: antes del entrenamiento, el job se detiene y reintenta indicando que el modelo no existe; una vez entrenado, el registro confirma la carga del modelo y el arranque de Spark 3.5.1 sobre arquitectura aarch64."),
  ...captura("05b", "Arranque del job de Spark: reintentos sin modelo y carga tras el entrenamiento"),

  h2("8.3 Evaluación del modelo"),
  p("El modelo se evaluó sobre 4,200 lecturas simuladas: 3,000 de operación normal de las cuatro máquinas y 1,200 de MAQ-03 en degradación avanzada. Como el simulador conoce el estado real de cada lectura, es posible calcular una matriz de confusión, algo que en producción no sería posible."),
  tabla(
    ["Estado real", "Predicho normal", "Predicho degradada"],
    [["Normal", "2,930", "70"], ["Degradada", "0", "1,200"]],
    [3120, 3120, 3120],
  ),
  new Paragraph({ spacing: { after: 160 }, children: [] }),
  tabla(
    ["Métrica", "Clase normal", "Clase degradada"],
    [
      ["Precisión", "1.000", "0.945"],
      ["Recall", "0.977", "1.000"],
      ["F1-score", "0.988", "0.972"],
      ["Soporte", "3,000", "1,200"],
    ],
    [3120, 3120, 3120],
  ),
  new Paragraph({ spacing: { after: 200 }, children: [] }),
  p("El modelo recupera la totalidad de las lecturas degradadas a costa de marcar el 2.3 % de las sanas. Ese porcentaje no es enteramente error: corresponde en buena medida a los picos puntuales que el simulador inyecta en máquinas sanas, que son anomalías legítimas aunque no indiquen una falla en desarrollo. La Figura 7 muestra la separación entre ambos regímenes en la distribución del score."),
  ...figura(path.join(RAIZ, "docs", "nb_score.png"), "Distribución del score y lecturas de MAQ-03 marcadas como anómalas"),

  h2("8.4 Ejecución en el prototipo"),
  p("En operación, cada micro-batch de diez segundos procesa 20 lecturas: cuatro máquinas publicando cada dos segundos. La Figura 8 muestra batches con 5 anomalías de forma sostenida, que es exactamente el número de lecturas de una sola máquina por batch: el modelo está marcando todas las lecturas de MAQ-03. Cuando aparece una sexta, corresponde a un pico aleatorio de otra máquina."),
  ...captura("05", "Micro-batches de scoring: 20 lecturas y 5–6 anomalías por batch", 400),
  p("La Figura 9 confirma que las dos consultas de streaming corren en paralelo. La tasa de entrada promedio, cercana a 2 lecturas por segundo, coincide con la frecuencia de publicación del simulador. La consulta de scoring acumula tres veces más batches que la de HDFS porque sus disparadores son de 10 y 30 segundos respectivamente."),
  ...captura("06", "Spark UI: consultas scoring_a_influxdb y crudo_a_hdfs en ejecución"),

  h1("9. Capa 5 — Visualización en Grafana"),
  p("El tablero se aprovisiona automáticamente al levantar el stack. Contiene seis paneles: vibración y temperatura por máquina, conteo total de anomalías, anomalías por máquina, evolución del score y un panel combinado de corriente y RPM. El refresco es de diez segundos, alineado con el disparador del micro-batch de scoring."),
  p("En la Figura 10 se observa la falla desarrollándose: la vibración de MAQ-03 sube de forma sostenida desde unos 2.8 mm/s hasta cerca de 7 mm/s, y su temperatura pasa de 70 °C a casi 87 °C, mientras las otras tres máquinas se mantienen estables."),
  ...captura("07", "Tablero de monitoreo con la degradación de MAQ-03 en curso"),
  p("La Figura 11 pone el foco en la detección. De 595 anomalías en la ventana, 551 corresponden a MAQ-03; las demás máquinas no superan las 27, todas atribuibles a picos aislados. MAQ-04 acumula algo más que MAQ-01 y MAQ-02 porque su vibración nominal es la más baja, de modo que un pico se aleja proporcionalmente más de su valor normal. El score de MAQ-03 se estabiliza cerca de 0.76: una vez que las lecturas quedan muy lejos de lo visto en el entrenamiento, el bosque las aísla en el mínimo de particiones posible y el score deja de crecer."),
  ...captura("08", "Paneles de detección: conteo, anomalías por máquina y score"),

  h1("10. Validación de extremo a extremo"),
  p("Para cerrar el ciclo se leyó lo que efectivamente quedó almacenado. Del data lake en HDFS se recuperaron 3,258 lecturas correspondientes a unos 27 minutos de operación, repartidas de forma homogénea entre las cuatro máquinas:"),
  tabla(
    ["Línea", "Máquina", "Lecturas", "Vibración media", "Vibración máx.", "Temp. media"],
    [
      ["L1", "MAQ-01", "822", "2.12 mm/s", "6.17 mm/s", "61.99 °C"],
      ["L1", "MAQ-02", "822", "3.45 mm/s", "11.03 mm/s", "58.05 °C"],
      ["L2", "MAQ-03", "807", "5.21 mm/s", "19.37 mm/s", "79.38 °C"],
      ["L2", "MAQ-04", "807", "1.62 mm/s", "4.62 mm/s", "53.97 °C"],
    ],
    [1100, 1400, 1500, 1800, 1760, 1800],
  ),
  new Paragraph({ spacing: { after: 200 }, children: [] }),
  p("MAQ-03 es la única máquina cuya media se aparta de su valor nominal: 5.21 mm/s de vibración frente a 2.8 y 79.4 °C frente a 70. Los máximos elevados de MAQ-02 y MAQ-01 corresponden a picos puntuales, que no desplazan la media."),
  p("Desde InfluxDB, la consulta del conteo de anomalías de las últimas dos horas arrojó la siguiente distribución:"),
  tabla(
    ["Máquina", "Anomalías detectadas", "% del total"],
    [["MAQ-01", "10", "1.2 %"], ["MAQ-02", "17", "2.0 %"], ["MAQ-03", "780", "93.3 %"], ["MAQ-04", "29", "3.5 %"]],
    [3120, 3120, 3120],
  ),
  new Paragraph({ spacing: { after: 200 }, children: [] }),
  p("La Figura 12 reconstruye la vibración media desde la serie de tiempo. Sus horas están en UTC, mientras que Grafana muestra la hora local de República Dominicana (UTC−4); ambas describen el mismo intervalo. La curva de MAQ-03 se aplana al final porque el simulador lleva la degradación a su máximo en el minuto 25 y la mantiene."),
  ...figura(path.join(RAIZ, "docs", "nb_vibracion.png"), "Vibración media por máquina reconstruida desde InfluxDB"),

  h1("11. Escalabilidad y consideraciones de producción"),
  p("El prototipo corre en un solo nodo, pero cada componente fue elegido por su trayectoria de escalamiento."),
  tabla(
    ["Componente", "En el prototipo", "En producción"],
    [
      ["Kafka", "1 broker, 3 particiones", "Clúster de 3+ brokers; particiones = paralelismo de consumo"],
      ["HDFS", "1 NameNode, 1 DataNode, replicación 1", "Varios DataNodes con replicación 3, o S3/ADLS como data lake"],
      ["Spark", "Modo local[2]", "Clúster YARN o Kubernetes con autoescalado de ejecutores"],
      ["InfluxDB", "Instancia única, 30 días", "Clúster con downsampling automático por niveles"],
      ["Modelo", "Uno global normalizado al nominal", "Uno por familia de activo, reentrenado periódicamente"],
    ],
    [2200, 3080, 4080],
  ),
  new Paragraph({ spacing: { after: 240 }, children: [] }),
  p("Tres puntos que un despliegue real exige y que este prototipo deliberadamente no cubre. Primero, la seguridad: MQTT y Kafka corren sin autenticación ni cifrado, mientras que en planta se requeriría al menos TLS mutuo en el borde y SASL en el bus. Segundo, el almacenamiento por niveles: mantener el dato reciente en SSD y el histórico en almacenamiento frío reduce el costo de forma sustancial. Tercero, la deriva del modelo: cambios de producto, de turno o de materia prima desplazan el régimen considerado normal, por lo que hace falta monitorear la tasa de anomalías y reentrenar periódicamente contra el data lake, que es la realimentación representada en el diagrama de arquitectura."),

  h1("12. Conclusiones"),
  p("El prototipo demuestra la cadena completa que plantea la propuesta conceptual: dispositivos IoT generando telemetría, transferencia eficiente mediante MQTT y Kafka, almacenamiento escalable en un data lake sobre HDFS más una base de series de tiempo, procesamiento en tiempo real con Spark, detección de anomalías con aprendizaje no supervisado y visualización operativa en Grafana."),
  p("La primera conclusión es que IoT sin Big Data es solo instrumentación: el valor aparece cuando el flujo se almacena de forma consultable y se analiza sistemáticamente. La segunda es que la separación en vía caliente y vía fría no constituye redundancia sino diseño, porque HDFS e InfluxDB responden preguntas distintas y ninguna sustituye a la otra. La tercera es que el cuello de botella del mantenimiento predictivo rara vez es el modelo: el Isolation Forest resultó la pieza más simple, mientras que la ingesta confiable, el particionado y la normalización entre activos heterogéneos concentraron la mayor parte del esfuerzo de diseño."),
  p("En términos cuantitativos, el detector alcanzó un recall de 1.000 y una precisión de 0.945 sobre la clase degradada en la evaluación controlada. En la ejecución real, el 93.3 % de las anomalías registradas correspondió a la máquina que efectivamente se estaba degradando, con una latencia de extremo a extremo por debajo de los quince segundos entre la lectura del sensor y su aparición en el tablero."),

  h1("13. Referencias"),
  vinheta("Apache Software Foundation. Structured Streaming Programming Guide, Spark 3.5."),
  vinheta("Apache Software Foundation. HDFS Architecture, Hadoop 3.3."),
  vinheta("Apache Software Foundation. Kafka Documentation — Design and Producer Configs."),
  vinheta("OASIS. MQTT Version 3.1.1 Specification."),
  vinheta("Liu, F. T., Ting, K. M. y Zhou, Z. (2008). Isolation Forest. IEEE International Conference on Data Mining."),
  vinheta("InfluxData. InfluxDB 2.7 Documentation — Flux query language."),
  vinheta("Aquino Cepeda, J. M. Propuesta Conceptual: Integración de IoT con Big Data. MCD512-01, INTEC."),

  h1("Anexo — Estructura del repositorio"),
  ...codigo([
    "docker-compose.yml          Orquestación de los 8 servicios",
    "simulador/                  Dispositivos IoT simulados (MQTT)",
    "puente/                     Puente MQTT → Kafka",
    "spark/app/                  Job de Structured Streaming + scoring",
    "ml/entrenar_modelo.py       Entrenamiento del Isolation Forest",
    "hadoop/                     Imagen HDFS multiarquitectura",
    "grafana/                    Datasource y dashboard aprovisionados",
    "notebooks/                  Informe técnico ejecutable",
    "capturas/                   Evidencia de ejecución",
    "docs/                       Diagrama e informe en Word",
  ]),
];

/* -------------------------------------------------------------- documento */

const doc = new Document({
  creator: "MCD512-01 Big Data — INTEC",
  title: "Integración de IoT y Big Data para mantenimiento predictivo",
  numbering: {
    config: [{
      reference: "lista-puntos",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.2) } } },
      }],
    }],
  },
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "MCD512-01 · BIG DATA · INTEC   —   ", size: 16, color: "8A94A0" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "8A94A0" }),
          ],
        })],
      }),
    },
    children: [...portada, ...cuerpo],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, buffer);
  const faltantes = ["01", "02", "03", "04", "05", "05b", "06", "07", "08"]
    .filter((n) => !fs.existsSync(path.join(CAPTURAS, `${n}.png`)));
  console.log(`Informe generado: ${SALIDA}`);
  if (faltantes.length) {
    console.log(`Capturas pendientes: ${faltantes.join(", ")} (colocarlas en capturas/ y volver a ejecutar)`);
  }
});
