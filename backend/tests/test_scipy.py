import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.scipy_service import calcular_estadisticas, optimizar_recursos, interpolar_datos, calcular_correlacion

def test_estadisticas_basicas():
    valores = [12, 15, 18, 20, 11, 25, 19, 17, 14, 21]
    result = calcular_estadisticas(valores)
    assert result["cantidad"] == 10
    assert result["media"] == 17.2
    assert result["minimo"] == 11
    assert result["maximo"] == 25
    assert "desviacion_estandar" in result
    assert "interpretacion" in result
    assert result["coeficiente_variacion"] > 0

def test_estadisticas_ddof():
    valores = [12, 15, 18, 20, 11, 25, 19, 17, 14, 21]
    result = calcular_estadisticas(valores)
    assert result["desviacion_estandar"] > 0
    assert result["rango"] == 14

def test_estadisticas_un_valor():
    result = calcular_estadisticas([10])
    assert result["cantidad"] == 1
    assert result["media"] == 10
    assert result["minimo"] == 10
    assert result["maximo"] == 10

def test_optimizacion():
    params = {"recurso_a": 3, "recurso_b": 5}
    result = optimizar_recursos(params)
    assert "resultado" in result
    assert "costo_optimizado" in result
    assert "convergio" in result
    assert "ahorro" in result
    assert isinstance(result["resultado"], dict)

def test_interpolacion():
    x = [1, 3, 4, 6]
    y = [12000, 14500, 15000, 18000]
    x_new = [2, 5]
    result = interpolar_datos(x, y, x_new)
    assert "x" in result
    assert "y" in result
    assert len(result["x"]) == 2
    assert len(result["y"]) == 2
    assert result["y"][0] > 12000
    assert result["y"][0] < 15000

def test_correlacion():
    x = [1, 2, 3, 4, 5]
    y = [2, 4, 6, 8, 10]
    result = calcular_correlacion(x, y)
    assert "correlacion" in result
    assert "p_valor" in result
    assert abs(result["correlacion"] - 1.0) < 0.001

if __name__ == "__main__":
    test_estadisticas_basicas()
    test_estadisticas_ddof()
    test_estadisticas_un_valor()
    test_optimizacion()
    test_interpolacion()
    test_correlacion()
    print("All scipy tests passed!")
