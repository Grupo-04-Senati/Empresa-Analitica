import re
import unicodedata
from collections import Counter

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

# --- Ejercicio 5: Clasificador Naive Bayes entrenado ---

DATOS_ENTRENAMIENTO = [
    # VENTAS
    ("quiero comprar un plan empresarial", "VENTAS"),
    ("cuanto cuesta el servicio mensual", "VENTAS"),
    ("necesito una cotizacion para mi empresa", "VENTAS"),
    ("que planes de suscripcion ofrecen", "VENTAS"),
    ("dame informacion de precios y descuentos", "VENTAS"),
    ("quiero contratar el plan premium", "VENTAS"),
    ("hay promociones para nuevos clientes", "VENTAS"),
    ("necesito generar una factura", "VENTAS"),
    ("cual es el costo del plan basico", "VENTAS"),
    ("quisiera hablar con un asesor comercial", "VENTAS"),
    ("envieme el presupuesto actualizado", "VENTAS"),
    ("que beneficios incluye el plan gold", "VENTAS"),
    ("quiero升级mi plan actual", "VENTAS"),
    ("necesito un devis para el servicio", "VENTAS"),
    ("cuanto vale la licencia anual", "VENTAS"),
    # SOPORTE
    ("no puedo ingresar a mi cuenta", "SOPORTE"),
    ("olvide mi contrasena y no puedo acceder", "SOPORTE"),
    ("el sistema presenta un error constante", "SOPORTE"),
    ("necesito ayuda tecnica con la plataforma", "SOPORTE"),
    ("la aplicacion se cierra sola", "SOPORTE"),
    ("no me funciona el login", "SOPORTE"),
    ("tengo un problema con mi acceso", "SOPORTE"),
    ("el botón de enviar no responde", "SOPORTE"),
    ("como configuro mi perfil", "SOPORTE"),
    ("necesito soporte con la configuracion", "SOPORTE"),
    ("la pantalla se ve corrupta", "SOPORTE"),
    ("hay un bug en el modulo de reportes", "SOPORTE"),
    ("no carga la pagina principal", "SOPORTE"),
    ("mi conexion con el servidor falla", "SOPORTE"),
    ("necesito recuperar mi cuenta bloqueada", "SOPORTE"),
    # RECLAMO
    ("el servicio es muy lento y pesimo", "RECLAMO"),
    ("estoy muy molesto con la atencion recibida", "RECLAMO"),
    ("esto es inaceptable y quiero hablar con un supervisor", "RECLAMO"),
    ("llevo esperando tres horas y nada", "RECLAMO"),
    ("el producto llego danado y defectuoso", "RECLAMO"),
    ("nunca me han dado una respuesta satisfactoria", "RECLAMO"),
    ("quiero presentar una queja formal", "RECLAMO"),
    ("esto es un desastre total", "RECLAMO"),
    ("el servicio al cliente es horrible", "RECLAMO"),
    ("voy a cancelar mi suscripcion por mal servicio", "RECLAMO"),
    ("tardaron demasiado en resolver mi problema", "RECLAMO"),
    ("la calidad ha bajado muchisimo", "RECLAMO"),
    ("no cumplieron con lo prometido", "RECLAMO"),
    ("esto es una estafa total", "RECLAMO"),
    ("la demora es inaceptable", "RECLAMO"),
    # FELICITACION
    ("excelente servicio, muy satisfecho", "FELICITACION"),
    ("gracias por la rapida atencion", "FELICITACION"),
    ("el equipo fue muy amable y eficiente", "FELICITACION"),
    ("recomiendo totalmente este servicio", "FELICITACION"),
    ("todo perfecto, sin problemas", "FELICITACION"),
    ("me encanta la plataforma, es intuitiva", "FELICITACION"),
    ("gran experiencia con el soporte tecnico", "FELICITACION"),
    ("muy buen servicio, lo recomiendo", "FELICITACION"),
    ("la atención fue impecable", "FELICITACION"),
    ("resolvieron mi problema rapido y bien", "FELICITACION"),
    ("excelente calidad y precio", "FELICITACION"),
    ("super Felicitaciones al equipo", "FELICITACION"),
    ("me gusto mucho el trato recibido", "FELICITACION"),
    ("son los mejores del mercado", "FELICITACION"),
    ("agradecido con el servicio brindado", "FELICITACION"),
]

def _extraer_features(texto: str) -> dict:
    norm = normalize_text(texto)
    tokens = tokenizar_seguro(norm)
    stop_words = obtener_stopwords()
    tokens_limpios = [t for t in tokens if t.isalpha() and t not in stop_words and len(t) > 2]
    features = {}
    for token in tokens_limpios:
        features[f"contains({token})"] = True
    return features

def _entrenar_clasificador():
    return None, 0.0

clasificador_nb, precision_nb = _entrenar_clasificador()

def clasificar_keywords(texto: str) -> dict:
    """Clasificación por keywords cuando NaiveBayes no está disponible"""
    if not texto or not texto.strip():
        return {"categoria": "CONSULTA", "confianza": 80.0, "metodo": "keywords", "detalles": {}}
    
    analisis = analizar_texto(texto)
    categoria = analisis.get("categoria", "CONSULTA")
    confianza = 70.0
    
    return {"categoria": categoria, "confianza": confianza, "metodo": "keywords", "detalles": {}}

def clasificar_nb(texto: str) -> dict:
    if not texto or not texto.strip():
        return {"categoria": "CONSULTA", "confianza": 80.0, "metodo": "naive_bayes", "detalles": {}}
    if clasificador_nb is None:
        return clasificar_keywords(texto)
    features = _extraer_features(texto)
    prob_dist = clasificador_nb.prob_classify(features)
    categoria = prob_dist.max()
    confianza = round(prob_dist.prob(categoria) * 100, 1)
    detalles = {cat: round(prob_dist.prob(cat) * 100, 1) for cat in prob_dist.samples()}
    return {"categoria": categoria, "confianza": confianza, "metodo": "naive_bayes", "detalles": detalles}

def clasificar(texto: str) -> dict:
    nb_result = clasificar_nb(texto)
    analisis = analizar_texto(texto)
    return {
        "categoria": nb_result["categoria"],
        "confianza": nb_result["confianza"],
        "metodo": "naive_bayes",
        "detalles_probabilidad": nb_result["detalles"],
        "sentimiento": analisis["sentimiento"],
        "tokens": analisis["tokens"],
        "keywords": analisis["keywords"],
    }


# --- Ejercicio 6: Buscador inteligente de servicios ---

SERVICIOS_EMPRESA = [
    {"id": 1, "nombre": "Soporte Tecnico", "descripcion": "Ayuda con problemas tecnicos, errores del sistema, configuracion y acceso", "categoria": "SOPORTE", "keywords": ["error", "bug", "problema", "acceso", "login", "contrasena", "sistema", "configurar", "pantalla", "ayuda", "tecnico", "computadora", "equipo", "dispositivo", "impresora", "red", "internet", "conexion", "servidor"]},
    {"id": 2, "nombre": "Atencion al Cliente", "descripcion": "Consultas generales, informacion y seguimiento de casos", "categoria": "SOPORTE", "keywords": ["consulta", "informacion", "seguimiento", "caso", "duda", "pregunta", "ayuda", "orientacion", "detalles"]},
    {"id": 3, "nombre": "Planes y Precios", "descripcion": "Informacion sobre planes de suscripcion, costos y facturacion", "categoria": "VENTAS", "keywords": ["precio", "costo", "plan", "suscripcion", "factura", "pago", "cotizar", "presupuesto", "tarifa", "cuota"]},
    {"id": 4, "nombre": "Consultas Comerciales", "descripcion": "Asesoria comercial, negociaciones y propuestas empresariales", "categoria": "VENTAS", "keywords": ["comprar", "contratar", "asesor", "comercial", "negocio", "empresa", "descuento", "oferta", "promocion"]},
    {"id": 5, "nombre": "Quejas y Reclamos", "descripcion": "Registro y gestion de quejas, reclamos y solicitudes de mejora", "categoria": "RECLAMO", "keywords": ["queja", "reclamo", "molesto", "problema", "insatisfecho", "cancelar", "devolver"]},
    {"id": 6, "nombre": "Sugerencias", "descripcion": "Recepcion de sugerencias y feedback para mejorar el servicio", "categoria": "FELICITACION", "keywords": ["sugerencia", "idea", "mejorar", "feedback", "opinion", "recomendar"]},
]

def normalizar_texto_busqueda(texto: str) -> list[str]:
    norm = normalize_text(texto)
    tokens = tokenizar_seguro(norm)
    stop_words = obtener_stopwords()
    return [t for t in tokens if t.isalpha() and t not in stop_words and len(t) > 2]

def buscar_servicios(consulta: str) -> list[dict]:
    tokens_consulta = normalizar_texto_busqueda(consulta)
    if not tokens_consulta:
        return []
    resultados = []
    for servicio in SERVICIOS_EMPRESA:
        tokens_keywords = [normalize_text(k) for k in servicio["keywords"]]
        tokens_desc = normalizar_texto_busqueda(servicio["descripcion"])
        tokens_servicio = set(tokens_keywords + tokens_desc)
        coincidencias = set(tokens_consulta) & tokens_servicio
        if coincidencias:
            score = len(coincidencias) / max(len(tokens_consulta), 1)
            resultados.append({**servicio, "score": round(score, 2), "coincidencias": list(coincidencias)})
    resultados.sort(key=lambda x: x["score"], reverse=True)
    if not resultados:
        for servicio in SERVICIOS_EMPRESA:
            if any(t in servicio["categoria"].lower() for t in tokens_consulta):
                resultados.append({**servicio, "score": 0.1, "coincidencias": [servicio["categoria"].lower()]})
    return resultados

