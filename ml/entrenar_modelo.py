"""
Entrenamiento offline del detector de anomalias (Isolation Forest).

Se entrena con datos del regimen NORMAL de cada maquina: el modelo aprende
como se ve la operacion sana y marca como anomalo todo lo que se aleja de
ese comportamiento. Es un enfoque no supervisado, adecuado aqui porque en
una planta real casi no hay ejemplos etiquetados de fallas.

Truco para usar un solo modelo con maquinas heterogeneas: en lugar de usar
los valores absolutos, se usan RAZONES contra el valor nominal de cada
maquina (vibracion observada / vibracion nominal). Asi una extrusora y una
bomba viven en el mismo espacio de features.

Uso:
    docker compose run --rm spark python3 /app/ml/entrenar_modelo.py
"""

import json
import os

import numpy as np
import pandas as pd
from joblib import dump
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

RUTA_SALIDA = os.getenv("RUTA_MODELO", os.path.join(os.path.dirname(__file__),
                                                    "modelo_anomalias.joblib"))
SEMILLA = 42
N_POR_MAQUINA = 6000

# Mismos valores nominales que usa el simulador
BASE = {
    "MAQ-01": {"vibracion_mm_s": 2.1, "temperatura_c": 62.0, "corriente_a": 18.5, "rpm": 1480},
    "MAQ-02": {"vibracion_mm_s": 3.4, "temperatura_c": 58.0, "corriente_a": 24.0, "rpm": 980},
    "MAQ-03": {"vibracion_mm_s": 2.8, "temperatura_c": 70.0, "corriente_a": 31.0, "rpm": 2950},
    "MAQ-04": {"vibracion_mm_s": 1.6, "temperatura_c": 54.0, "corriente_a": 12.0, "rpm": 1750},
}
RUIDO = {"vibracion_mm_s": 0.12, "temperatura_c": 0.8, "corriente_a": 0.5, "rpm": 12}
COLUMNAS = ["vibracion_mm_s", "temperatura_c", "corriente_a", "rpm"]


def generar_datos_normales(rng):
    """Simula operacion sana de las cuatro maquinas."""
    filas = []
    for maquina, nominal in BASE.items():
        for _ in range(N_POR_MAQUINA):
            fila = {"maquina": maquina}
            for col in COLUMNAS:
                fila[col] = nominal[col] + rng.normal(0, RUIDO[col])
            filas.append(fila)
    return pd.DataFrame(filas)


def construir_features(df, base=BASE):
    """Convierte lecturas absolutas en razones contra el valor nominal."""
    nominal = df["maquina"].map(lambda m: base.get(m, base["MAQ-01"]))
    salida = pd.DataFrame(index=df.index)
    for col in COLUMNAS:
        referencia = nominal.map(lambda d, c=col: d[c]).astype(float)
        salida[f"r_{col}"] = df[col].astype(float) / referencia
    return salida


def main():
    rng = np.random.default_rng(SEMILLA)
    datos = generar_datos_normales(rng)
    X = construir_features(datos)

    escalador = StandardScaler().fit(X)
    modelo = IsolationForest(
        n_estimators=200,
        contamination=0.01,   # se espera ~1% de ruido en el entrenamiento
        random_state=SEMILLA,
        n_jobs=-1,
    ).fit(escalador.transform(X))

    bundle = {
        "modelo": modelo,
        "escalador": escalador,
        "base": BASE,
        "columnas": COLUMNAS,
        "features": list(X.columns),
    }
    os.makedirs(os.path.dirname(RUTA_SALIDA), exist_ok=True)
    dump(bundle, RUTA_SALIDA)

    # Comprobacion rapida: una lectura sana y una con falla evidente
    prueba = pd.DataFrame([
        {"maquina": "MAQ-03", "vibracion_mm_s": 2.8, "temperatura_c": 70.0,
         "corriente_a": 31.0, "rpm": 2950},
        {"maquina": "MAQ-03", "vibracion_mm_s": 7.9, "temperatura_c": 88.0,
         "corriente_a": 42.0, "rpm": 2760},
    ])
    pred = modelo.predict(escalador.transform(construir_features(prueba)))
    print(json.dumps({
        "modelo_guardado_en": RUTA_SALIDA,
        "muestras_entrenamiento": len(X),
        "prediccion_lectura_sana": int(pred[0]),    # 1 = normal
        "prediccion_lectura_con_falla": int(pred[1]),  # -1 = anomalia
    }, indent=2))


if __name__ == "__main__":
    main()
