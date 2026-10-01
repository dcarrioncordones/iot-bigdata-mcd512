"""Genera docs/arquitectura.png: diagrama por capas de la solucion IoT + Big Data."""

import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

SALIDA = os.path.join(os.path.dirname(__file__), "..", "docs", "arquitectura.png")

COLORES = {
    "edge":    ("#E8F1F8", "#2C5F86"),
    "transf":  ("#FDF0E3", "#B06A18"),
    "proc":    ("#EDE8F6", "#59399B"),
    "alm":     ("#E6F4EC", "#1F7A4D"),
    "vis":     ("#FBE9EC", "#A32438"),
}

CAPAS = [
    ("1. Dispositivos IoT\n(Edge Layer)", "edge", [
        "Sensores en máquina\nvibración · temperatura\ncorriente · RPM",
        "Gateway IoT\n(Raspberry Pi)\nfiltrado y agregación",
    ]),
    ("2. Transferencia\n(Fog / Cloud)", "transf", [
        "Broker MQTT\nMosquitto · QoS 1\ntopic planta/#",
        "Puente MQTT→Kafka\ngzip · clave = máquina",
        "Apache Kafka\ntopic planta.sensores\n3 particiones",
    ]),
    ("3. Procesamiento\ny Análisis", "proc", [
        "Spark Structured\nStreaming\nmicro-batch 10s / 30s",
        "Isolation Forest\n(scikit-learn)\nscoring en línea",
    ]),
    ("4. Almacenamiento\n(Big Data Layer)", "alm", [
        "HDFS — Data Lake\nParquet particionado\nfecha / línea",
        "InfluxDB\nserie de tiempo\nretención 30 d",
    ]),
    ("5. Visualización\ny Acción", "vis", [
        "Grafana\ndashboard en vivo\nKPIs por máquina",
        "Alertas a\nmantenimiento\n(orden de trabajo)",
    ]),
]


def main():
    fig, ax = plt.subplots(figsize=(16, 8.5), dpi=200)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")

    ancho_capa = 17.2
    sep = 2.3
    x0 = 1.8
    centros = []

    for idx, (titulo, clave, cajas) in enumerate(CAPAS):
        relleno, borde = COLORES[clave]
        x = x0 + idx * (ancho_capa + sep)
        centros.append(x + ancho_capa / 2)

        # Marco de la capa
        ax.add_patch(FancyBboxPatch(
            (x, 8), ancho_capa, 80,
            boxstyle="round,pad=0.6,rounding_size=1.5",
            linewidth=1.4, edgecolor=borde, facecolor=relleno, alpha=0.45))

        ax.text(x + ancho_capa / 2, 92.5, titulo, ha="center", va="center",
                fontsize=12.5, fontweight="bold", color=borde)

        n = len(cajas)
        alto_caja = 15
        espacio = (76 - n * alto_caja) / (n + 1)
        y = 84 - espacio - alto_caja

        for j, texto in enumerate(cajas):
            ax.add_patch(FancyBboxPatch(
                (x + 1.2, y), ancho_capa - 2.4, alto_caja,
                boxstyle="round,pad=0.4,rounding_size=1.0",
                linewidth=1.6, edgecolor=borde, facecolor="white"))
            ax.text(x + ancho_capa / 2, y + alto_caja / 2, texto,
                    ha="center", va="center", fontsize=9.6, color="#1F2933",
                    linespacing=1.45)
            # Flecha interna entre cajas de la misma capa
            if j < n - 1:
                y_sig = y - espacio
                ax.add_patch(FancyArrowPatch(
                    (x + ancho_capa / 2, y), (x + ancho_capa / 2, y_sig),
                    arrowstyle="-|>", mutation_scale=13,
                    linewidth=1.3, color=borde, alpha=0.8))
            y -= (alto_caja + espacio)

    # Flechas entre capas
    etiquetas = ["MQTT\n(edge → nube)", "consumo\nde Kafka", "escritura\nde resultados", "consulta\nFlux"]
    for i in range(len(CAPAS) - 1):
        xi = x0 + i * (ancho_capa + sep) + ancho_capa
        xf = x0 + (i + 1) * (ancho_capa + sep)
        ax.add_patch(FancyArrowPatch(
            (xi + 0.2, 48), (xf - 0.2, 48),
            arrowstyle="-|>", mutation_scale=20,
            linewidth=2.2, color="#3D4852"))
        ax.text((xi + xf) / 2, 52.5, etiquetas[i], ha="center", va="center",
                fontsize=8.2, color="#3D4852", linespacing=1.3)

    # Realimentacion: del data lake al reentrenamiento del modelo
    ax.add_patch(FancyArrowPatch(
        (centros[3], 9.5), (centros[2], 9.5),
        connectionstyle="arc3,rad=0.28", arrowstyle="-|>", mutation_scale=16,
        linewidth=1.6, linestyle="--", color="#59399B"))
    ax.text((centros[2] + centros[3]) / 2, 3.2,
            "Reentrenamiento batch del modelo con el histórico del data lake",
            ha="center", va="center", fontsize=8.6, color="#59399B", style="italic")

    ax.text(50, 97.5,
            "Arquitectura IoT + Big Data para mantenimiento predictivo en planta de manufactura",
            ha="center", va="center", fontsize=14, fontweight="bold", color="#1F2933")

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    fig.savefig(SALIDA, bbox_inches="tight", facecolor="white")
    print(f"Diagrama guardado en {os.path.abspath(SALIDA)}")


if __name__ == "__main__":
    main()
