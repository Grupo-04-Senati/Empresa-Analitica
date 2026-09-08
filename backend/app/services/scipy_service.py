import numpy as np
import logging
from scipy import stats
from scipy.optimize import minimize
from scipy.interpolate import interp1d

logger = logging.getLogger(__name__)

def calcular_estadisticas(valores: list[float]) -> dict:
    arr = np.array(valores, dtype=float)
    media = round(float(np.mean(arr)), 2)
    mediana = round(float(np.median(arr)), 2)
    desviacion = round(float(np.std(arr, ddof=1)), 2)
    minimo = round(float(np.min(arr)), 2)
    maximo = round(float(np.max(arr)), 2)
    p25 = round(float(np.percentile(arr, 25)), 2)
    p75 = round(float(np.percentile(arr, 75)), 2)
    rango = round(maximo - minimo, 2)
    cv = round((desviacion / media * 100), 2) if media != 0 else 0

    if cv < 15:
        interpretacion = "Variabilidad baja — servicio consistente y predecible"
    elif cv < 30:
        interpretacion = "Variabilidad moderada — hay oportunidad de mejora en consistencia"
    else:
        interpretacion = "Variabilidad alta — servicio inconsistente, requiere atención inmediata"

    return {
        "cantidad": len(arr),
        "media": media,
        "mediana": mediana,
        "desviacion_estandar": desviacion,
        "minimo": minimo,
        "maximo": maximo,
        "percentil_25": p25,
        "percentil_75": p75,
        "rango": rango,
        "coeficiente_variacion": cv,
        "interpretacion": interpretacion,
    }

def optimizar_recursos(parametros: dict) -> dict:
    keys = list(parametros.keys())
    x0 = [float(v) for v in parametros.values()]

    n = len(x0)

    def costo(x):
        return sum(80 * x[i] + 50 * x[i] ** 2 + 10 * (x[i] - 3) ** 2 for i in range(len(x)))

    restriccion = {
        "type": "ineq",
        "fun": lambda x: sum(10 * xi for xi in x) + 5 * sum(x) - 40
    }

    bounds = [(0, 10) for _ in range(n)]

    result = minimize(
        costo, x0,
        method="SLSQP",
        bounds=bounds,
        constraints=[restriccion],
        options={"maxiter": 200, "ftol": 1e-8}
    )

    resultado = {keys[i]: round(float(result.x[i]), 2) for i in range(n)}
    costo_inicial = round(float(costo(x0)), 2)

    return {
        "resultado": resultado,
        "costo_optimizado": round(float(result.fun), 2),
        "costo_inicial": costo_inicial,
        "ahorro": round(costo_inicial - float(result.fun), 2),
        "convergio": result.success,
        "iteraciones": result.nit,
        "mensaje": "Optimización convergió correctamente" if result.success else "La optimización no convergió — intente con otros parámetros",
    }

def interpolar_datos(x: list[float], y: list[float], x_new: list[float]) -> dict:
    f = interp1d(x, y, kind="cubic", fill_value="extrapolate")
    y_new = f(x_new).tolist()
    return {"x": x_new, "y": [round(float(yi), 2) for yi in y_new]}

def calcular_correlacion(x: list[float], y: list[float]) -> dict:
    corr, pvalue = stats.pearsonr(x, y)
    return {"correlacion": round(float(corr), 4), "p_valor": round(float(pvalue), 4)}
