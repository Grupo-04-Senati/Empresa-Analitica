import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.nltk_service import (
    analizar_texto, calcular_frecuencias, clasificar,
    clasificar_con_entrenamiento, buscar_servicio, normalize_text,
    tokenizar_seguro, obtener_stopwords
)

def test_normalize_text():
    assert normalize_text("HOLA MUNDO") == "hola mundo"
    assert normalize_text("CRÉDITO") == "credito"
    assert normalize_text("niño") == "nino"

def test_tokenizar():
    tokens = tokenizar_seguro("El servicio fue rapido")
    assert isinstance(tokens, list)
    assert len(tokens) > 0

def test_stopwords():
    sw = obtener_stopwords()
    assert "de" in sw
    assert "la" in sw
    assert len(sw) > 20

def test_analizar_texto():
    result = analizar_texto("El servicio fue excelente y rapido")
    assert result["idioma"] == "es"
    assert result["cantidad_palabras"] > 0
    assert result["categoria"] in ["VENTAS", "RECLAMO", "FELICITACION", "SOPORTE", "CONSULTA"]
    assert result["sentimiento"] in ["positivo", "negativo", "neutro"]
    assert "tokens" in result
    assert "palabras_frecuentes" in result

def test_analizar_texto_vacio():
    result = analizar_texto("")
    assert result["cantidad_palabras"] == 0
    assert result["tokens"] == []

def test_clasificar_con_entrenamiento():
    result = clasificar_con_entrenamiento("El servicio fue excelente")
    assert "categoria" in result
    assert "confianza" in result
    assert "distribucion" in result
    assert result["metodo"] == "NaiveBayes entrenado"

def test_clasificar_entrenado_ventas():
    result = clasificar_con_entrenamiento("Quiero comprar un producto")
    assert result["categoria"] == "VENTAS"

def test_clasificar_entrenado_soporte():
    result = clasificar_con_entrenamiento("Necesito ayuda tecnica")
    assert result["categoria"] == "SOPORTE"

def test_clasificar_entrenado_reclamo():
    result = clasificar_con_entrenamiento("Reclamo por mal servicio")
    assert result["categoria"] == "RECLAMO"

def test_clasificar_entrenado_felicitacion():
    result = clasificar_con_entrenamiento("Excelente servicio muy satisfecho")
    assert result["categoria"] == "FELICITACION"

def test_buscar_servicio():
    resultados = buscar_servicio("Necesito ayuda con mi computadora")
    assert isinstance(resultados, list)
    assert len(resultados) > 0
    assert "servicio" in resultados[0]
    assert "relevancia" in resultados[0]

def test_buscar_servicio_vacio():
    resultados = buscar_servicio("")
    assert resultados == []

def test_frecuencias():
    textos = ["servicio excelente", "servicio rapido", "atencion excelente"]
    freqs = calcular_frecuencias(textos)
    assert isinstance(freqs, list)
    assert len(freqs) > 0
    assert "palabra" in freqs[0]
    assert "frecuencia" in freqs[0]

if __name__ == "__main__":
    test_normalize_text()
    test_tokenizar()
    test_stopwords()
    test_analizar_texto()
    test_analizar_texto_vacio()
    test_clasificar_con_entrenamiento()
    test_clasificar_entrenado_ventas()
    test_clasificar_entrenado_soporte()
    test_clasificar_entrenado_reclamo()
    test_clasificar_entrenado_felicitacion()
    test_buscar_servicio()
    test_buscar_servicio_vacio()
    test_frecuencias()
    print("All nltk tests passed!")
