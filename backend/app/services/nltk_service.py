import re
import unicodedata
from collections import Counter
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import SnowballStemmer

for resource in ["punkt", "punkt_tab", "stopwords", "vader_lexicon"]:
    try:
        nltk.download(resource, quiet=True)
    except Exception:
        pass

try:
    stemmer = SnowballStemmer("spanish")
except Exception:
    stemmer = None

def normalize_text(text: str) -> str:
    """Elimina acentos y diacríticos para comparación uniforme"""
    text = text.lower()
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

SPANISH_STOPWORDS_FALLBACK = {
    "de", "la", "que", "el", "en", "y", "a", "los", "del", "se", "las", "por", "un", "para", "con", "no", "una",
    "su", "al", "lo", "como", "mas", "pero", "sus", "le", "ya", "o", "este", "si", "porque", "esta", "entre",
    "cuando", "muy", "sin", "sobre", "tambien", "me", "hasta", "hay", "donde", "quien", "desde", "todo", "nos",
    "durante", "todos", "uno", "les", "ni", "contra", "otros", "ese", "eso", "ante", "ellos", "e", "esto", "mi",
    "mis", "tus", "tu", "es", "fue", "son", "era", "han", "he", "ha", "somos", "esta", "estan"
}

def obtener_stopwords() -> set[str]:
    try:
        raw_words = set(stopwords.words("spanish"))
        if len(raw_words) > 50:
            return {normalize_text(w) for w in raw_words}
    except Exception:
        pass
    return SPANISH_STOPWORDS_FALLBACK

# Categorías con vocabulario normalizado (sin acentos)
CATEGORIA_KEYWORDS = {
    "VENTAS": [
        "factura", "facturacion", "precio", "precios", "costo", "costos", "comprar", "compra", "plan",
        "planes", "contrato", "pagar", "pago", "descuento", "tarifa", "cotizacion", "cotizar", "presupuesto", "ventas"
    ],
    "RECLAMO": [
        "error", "falla", "lento", "demora", "pesimo", "pesima", "problema", "inaceptable", "terrible",
        "queja", "reclamo", "molesto", "molestia", "danado", "defectuoso", "mal", "malo", "mala", "malisimo",
        "tarde", "tardo", "estafa", "caro", "desastre", "horrible", "decepcion", "cancelar", "cancelacion", "perjuicio"
    ],
    "FELICITACION": [
        "gracias", "excelente", "bueno", "buena", "buenisimo", "buenisima", "gran", "rapido", "rapida",
        "felicitaciones", "felicidades", "felicito", "satisfecho", "satisfecha", "genial", "perfecto",
        "perfecta", "agradable", "eficiente", "intuitiva", "maravilloso", "maravillosa", "recomiendo", "impecable", "agradecido", "agradecida", "encanto", "encanta"
    ],
    "SOPORTE": [
        "sistema", "contrasena", "clave", "password", "acceso", "login", "pantalla", "soporte",
        "tecnico", "tecnica", "bug", "plataforma", "aplicacion", "app", "cuenta", "conexion", "configurar", "configuracion", "ayuda"
    ]
}

POSITIVAS = set(CATEGORIA_KEYWORDS["FELICITACION"] + ["util", "atento", "amable", "gusto", "gusta", "positivo"])
NEGATIVAS = set(CATEGORIA_KEYWORDS["RECLAMO"] + ["inutil", "nunca", "pesima", "negativo", "abuso", "injusto"])

def tokenizar_seguro(texto: str) -> list[str]:
    norm = normalize_text(texto)
    try:
        tokens = word_tokenize(norm, language="spanish")
    except Exception:
        tokens = re.findall(r"\b[a-z]{2,}\b", norm)
    return tokens

def analizar_texto(texto: str) -> dict:
    if not texto or not texto.strip():
        return {
            "idioma": "es",
            "cantidad_palabras": 0,
            "tokens": [],
            "keywords": [],
            "temas": ["General"],
            "palabras_frecuentes": [],
            "categoria": "CONSULTA",
            "categoria_detectada": "CONSULTA",
            "sentimiento": "neutro",
            "confianza": 80.0
        }

    norm_text = normalize_text(texto)
    raw_tokens = tokenizar_seguro(norm_text)
    stop_words = obtener_stopwords()
    
    tokens_limpios = [t for t in raw_tokens if t.isalpha() and t not in stop_words and len(t) > 2]

    # Stems
    if stemmer:
        try:
            stems = [stemmer.stem(t) for t in tokens_limpios]
        except Exception:
            stems = tokens_limpios
    else:
        stems = tokens_limpios

    # 1. Puntuación de categorías
    scores = {cat: 0 for cat in CATEGORIA_KEYWORDS}
    for t in tokens_limpios:
        for cat, kws in CATEGORIA_KEYWORDS.items():
            if any(t == kw or (len(kw) > 4 and t.startswith(kw[:4])) for kw in kws):
                scores[cat] += 2

    # Verificación de frases clave compuestas
    if any(p in norm_text for p in ["muchas gracias", "muy bueno", "muy buena", "excelente atencion", "buen servicio", "me encanta", "los felicito"]):
        scores["FELICITACION"] += 5
    if any(p in norm_text for p in ["no funciona", "muy lento", "pesimo servicio", "mala atencion", "no sirve", "no responde", "llego danado", "tardo demasiado"]):
        scores["RECLAMO"] += 5
    if any(p in norm_text for p in ["no puedo ingresar", "olvide mi clave", "olvide mi contrasena", "error en el sistema", "soporte tecnico"]):
        scores["SOPORTE"] += 5
    if any(p in norm_text for p in ["cuanto cuesta", "informacion de precios", "planes disponibles", "quiero comprar", "generar factura"]):
        scores["VENTAS"] += 5

    categoria = "CONSULTA"
    confianza_pct = 85.0
    max_score = max(scores.values()) if scores else 0

    if max_score > 0:
        categoria = max(scores, key=scores.get)
        confianza_pct = min(98.0, 75.0 + (max_score * 5.0))

    # 2. Análisis de Sentimiento
    pos_matches = sum(1 for t in tokens_limpios if any(t == kw or (len(kw) > 4 and t.startswith(kw[:4])) for kw in POSITIVAS))
    neg_matches = sum(1 for t in tokens_limpios if any(t == kw or (len(kw) > 4 and t.startswith(kw[:4])) for kw in NEGATIVAS))

    # Frases de polaridad
    if any(p in norm_text for p in ["gracias", "excelente", "muy bien", "me gusto", "me encanta", "perfecto", "buen trabajo"]):
        pos_matches += 3
    if any(p in norm_text for p in ["no me gusto", "no funciona", "pesimo", "horrible", "mala", "lento", "demora", "cancelar"]):
        neg_matches += 3

    if categoria == "FELICITACION" or pos_matches > neg_matches:
        sentimiento = "positivo"
    elif categoria == "RECLAMO" or neg_matches > pos_matches:
        sentimiento = "negativo"
    else:
        sentimiento = "neutro"

    # 3. Frecuencia y keywords
    conteo = Counter(tokens_limpios)
    palabras_frecuentes = [{"palabra": w, "frecuencia": c} for w, c in conteo.most_common(10)]
    keywords = [w for w, _ in conteo.most_common(6)]
    if not keywords and tokens_limpios:
        keywords = tokens_limpios[:3]

    temas_map = {
        "VENTAS": ["Facturación", "Planes Comerciales", "Ventas"],
        "RECLAMO": ["Calidad de Servicio", "Incidencias", "Atención al Cliente"],
        "FELICITACION": ["Satisfacción", "Calidad de Servicio", "Fidelización"],
        "SOPORTE": ["Soporte Técnico", "Acceso y Plataforma", "Sistemas"],
        "CONSULTA": ["Atención al Cliente", "Información General"]
    }
    temas = temas_map.get(categoria, ["Atención al Cliente", "Experiencia de Usuario"])

    return {
        "idioma": "es",
        "cantidad_palabras": len(tokens_limpios),
        "tokens": stems,
        "keywords": keywords,
        "temas": temas,
        "palabras_frecuentes": palabras_frecuentes,
        "categoria": categoria,
        "categoria_detectada": categoria,
        "sentimiento": sentimiento,
        "confianza": round(confianza_pct, 1)
    }

def calcular_frecuencias(textos: list[str]) -> list[dict]:
    stop_words = obtener_stopwords()
    all_tokens = []
    for texto in textos:
        raw_tokens = tokenizar_seguro(texto)
        all_tokens.extend([t for t in raw_tokens if t not in stop_words and len(t) > 2])
    freq = Counter(all_tokens)
    return [{"palabra": p, "frecuencia": f} for p, f in freq.most_common(20)]

def clasificar(texto: str) -> dict:
    return analizar_texto(texto)

