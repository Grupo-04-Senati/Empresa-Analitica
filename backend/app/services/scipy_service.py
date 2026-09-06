import numpy as np
from scipy import stats
from scipy.optimize import minimize
from scipy.interpolate import interp1d

def calcular_estadisticas(valores: list[float]) -> dict:
    arr = np.array(valores)
    return {
        "cantidad": len(arr),
        "media": round(float(np.mean(arr)), 2),
        "mediana": round(float(np.median(arr)), 2),
        "desviacion_estandar": round(float(np.std(arr)), 2),
        "minimo": round(float(np.min(arr)), 2),
        "maximo": round(float(np.max(arr)), 2),
        "percentil_25": round(float(np.percentile(arr, 25)), 2),
        "percentil_75": round(float(np.percentile(arr, 75)), 2),
    }

def optimizar_recursos(parametros: dict) -> dict:
    keys = list(parametros.keys())
    x0 = [float(v) for v in parametros.values()]

    def costo(x):
        return sum((xi - 1) ** 2 for xi in x) + 0.1 * sum(x)

    result = minimize(costo, x0, method="BFGS")
    resultado = {keys[i]: round(float(result.x[i]), 2) for i in range(len(keys))}

    return {
        "resultado": resultado,
        "costo_optimizado": round(float(result.fun), 2),
        "convergio": result.success,
        "iteraciones": result.nit,
    }

def interpolar_datos(x: list[float], y: list[float], x_new: list[float]) -> dict:
    f = interp1d(x, y, kind="cubic", fill_value="extrapolate")
    y_new = f(x_new).tolist()
    return {"x": x_new, "y": [round(float(yi), 2) for yi in y_new]}

def calcular_correlacion(x: list[float], y: list[float]) -> dict:
    corr, pvalue = stats.pearsonr(x, y)
    return {"correlacion": round(float(corr), 4), "p_valor": round(float(pvalue), 4)}
