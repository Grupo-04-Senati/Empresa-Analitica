import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, Search, MessageSquare } from 'lucide-react';

interface FAQItem { id: number; pregunta: string; respuesta: string; categoria: string; }

const FAQ_DATA: FAQItem[] = [
  // GENERAL
  { id: 1, pregunta: 'Que es BADI Corp?', respuesta: 'BADI Corp es un Centro Inteligente de Analisis y Gestion para call centers. Es una plataforma web desarrollada por 5 estudiantes de la SENATI que integra inteligencia artificial, procesamiento de lenguaje natural (NLP), reconocimiento facial y analitica en tiempo real para ayudar a las empresas a gestionar sus interacciones con clientes de forma automatica y eficiente. Permite clasificar comentarios, analizar sentimientos, gestionar clientes y generar reportes automaticos.', categoria: 'General' },
  { id: 2, pregunta: 'Quienes pueden usar la plataforma?', respuesta: 'La plataforma tiene dos tipos de usuario: Administradores y Agentes. Los administradores tienen acceso total a todas las secciones incluyendo configuracion, categorias, auditoria y gestion de usuarios. Los agentes pueden analizar comentarios, ver clasificaciones, gestionar solicitudes y acceder a reportes. Ambos tipos pueden usar el reconocimiento facial para iniciar sesion.', categoria: 'General' },
  { id: 3, pregunta: 'Cuales son las principales funcionalidades?', respuesta: '1) Analisis de sentimiento con NLP y Machine Learning. 2) Clasificacion automatica de comentarios por categorias. 3) Reconocimiento facial para autenticacion. 4) Gestion de clientes con indicador de actividad en tiempo real. 5) Dashboard con metricas e interactivas. 6) Sistema de notificaciones automaticas. 7) Auditoria completa de acciones. 8) Reportes de NLP, estadistica y atencion. 9) Palabras frecuentes con graficos. 10) Interpolacion y optimizacion de datos numericos. 11) Limpieza de datos. 12) Asistente virtual TinoBot.', categoria: 'General' },

  // NLP Y SENTIMIENTO
  { id: 4, pregunta: 'Como funciona el analisis de sentimiento?', respuesta: 'Cuando un usuario ingresa un comentario, el sistema lo envia al backend de FastAPI donde NLTK procesa el texto: lo tokeniza, elimina stopwords en espanol, aplica stemming y analiza la polaridad. Compara las palabras contra diccionarios de terminos positivos (ej: excelente, perfecto, gracias) y negativos (ej: terrible, pesimo, error). Calcula un puntaje de sentimiento (positivo, negativo o neutro) y un porcentaje de confianza. Las palabras negativas reducen la confianza: cada palabra negativa penaliza -12% (maximo -35%), las señales mixtas penalizan -5% adicional, y el sentimiento negativo tiene un techo de 70% de confianza maxima.', categoria: 'NLP y Sentimiento' },
  { id: 5, pregunta: 'Que categorias detecta el sistema?', respuesta: 'El sistema clasifica comentarios en 5 categorias determinadas automaticamente por Machine Learning: FELICITACION (satisfaccion, agradecimiento, recomendaciones del cliente), RECLAMO (quejas, insatisfaccion, problemas, cancelaciones), SOPORTE (problemas tecnicos, errores, acceso, configuracion), VENTAS (facturacion, precios, planes, contratacion, cotizaciones) y CONSULTA (informacion general, dudas). Los administradores pueden crear categorias adicionales desde la seccion de Configuracion.', categoria: 'NLP y Sentimiento' },
  { id: 6, pregunta: 'Que es la confianza del analisis?', respuesta: 'La confianza es un porcentaje que indica que tan seguro esta el sistema sobre la clasificacion. Un texto claro como "Excelente servicio, muy satisfecho" obtiene 95-98% de confianza. Un texto ambiguo como "El servicio esta bien pero la factura llego mal" obtiene 50-60% porque tiene señales mixtas. Un texto completamente negativo como "Pesimo servicio, horrible" obtiene 25-35% porque las palabras negativas reducen la confianza. La confianza minima es 15% y la maxima es 98%.', categoria: 'NLP y Sentimiento' },
  { id: 7, pregunta: 'Puedo personalizar las palabras de analisis?', respuesta: 'Si. En la seccion "Analizar comentario" hay un editor de palabras expandible llamado "Palabras de Analisis (Admin)". Puedes agregar o eliminar palabras positivas, negativas y neutras. El sistema viene con 33 palabras positivas, 77 negativas y 10 neutras por defecto. Los cambios se guardan localmente en el navegador y se aplican al analisis local. Las palabras se usan como fallback cuando el backend no esta disponible.', categoria: 'NLP y Sentimiento' },
  { id: 8, pregunta: 'Que son las Palabras Frecuentes?', respuesta: 'La seccion "Palabras Frecuentes" muestra las palabras mas utilizadas en todos los comentarios almacenados. El sistema tokeniza todos los textos, elimina las stopwords (palabras comunes como "de", "la", "el"), y cuenta la frecuencia de cada palabra. Muestra un grafico de barras con las 15 palabras mas frecuentes y un grafico de tendencia temporal para ver como cambia el uso de palabras clave a lo largo del tiempo.', categoria: 'NLP y Sentimiento' },

  // RECONOCIMIENTO FACIAL
  { id: 9, pregunta: 'Que es el reconocimiento facial?', respuesta: 'BADI Corp utiliza MediaPipe Face Mesh y TensorFlow.js para el reconocimiento facial 100% en el navegador (sin enviar imagenes a un servidor). Detecta 478 landmarks (puntos de referencia) del rostro, genera un embedding facial (vector numerico unico) y lo compara con los rostros registrados usando distancia RMS. El umbral de coincidencia es de 0.35 (35%) para considerar que es la misma persona.', categoria: 'Reconocimiento Facial' },
  { id: 10, pregunta: 'Como funciona el registro facial?', respuesta: 'Al registrarte con tu rostro, el sistema te guia para capturar 5 poses: frente, izquierda, derecha, arriba y abajo. Para cada pose, debes mantener el rostro quieto hasta que la barra de progreso llegue al 100%. El sistema detecta si hay multiples rostros en la camara y te advierte. Si no detecta un rostro claro, muestra un mensaje de error. Los 5 embeddings se promedian para crear un vector final mas robusto que se almacena en Supabase.', categoria: 'Reconocimiento Facial' },
  { id: 11, pregunta: 'Como funciona el login facial?', respuesta: 'Al iniciar sesion con reconocimiento facial, el sistema captura tu rostro en tiempo real, genera un embedding y lo compara con todos los rostros registrados en la base de datos. Usa un sistema de 3 niveles: 1) Verificacion de region facial (cara visible), 2) Coincidencia de embedding (distancia RMS < 0.35), 3) Verificacion de margen (la mejor coincidencia debe superar a la segunda por al menos 5%). Si falla, puedes usar login manual con email y contrasena.', categoria: 'Reconocimiento Facial' },
  { id: 12, pregunta: 'Es seguro el reconocimiento facial?', respuesta: 'Si. Los embeddings faciales se calculan 100% en el navegador con TensorFlow.js, nunca se envian imagenes a un servidor. Los embeddings son vectores numericos irreversibles (no se puede reconstruir la imagen). Se almacenan en Supabase con Row Level Security. Si el registro facial falla 3 veces, la cuenta se desactiva por seguridad y el usuario debe re-registrarse.', categoria: 'Reconocimiento Facial' },

  // GESTION DE CLIENTES
  { id: 13, pregunta: 'Como se gestionan los clientes?', respuesta: 'La seccion de Clientes muestra todos los clientes registrados con su informacion basica (nombre, email, telefono, empresa, estado). Los clientes con el indicador verde estan "En Linea" (activos en los ultimos 5 minutos). El sistema actualiza automaticamente el campo last_seen cada 60 segundos cuando un cliente tiene sesion activa. El dashboard muestra el total de clientes en linea y permite buscar y filtrar por nombre o empresa.', categoria: 'Gestion de Clientes' },
  { id: 14, pregunta: 'Que es el heartbeat de clientes?', respuesta: 'El heartbeat es un mecanismo que mantiene actualizado el estado "En Linea" de cada cliente. Cada 60 segundos, el dashboard ejecuta una consulta directa a Supabase para actualizar el campo last_seen con la fecha y hora actual. Cuando un cliente cierra sesion o cambia de pagina, su last_seen deja de actualizarse. Si el last_seen tiene mas de 5 minutos de antiguedad, el cliente se marca como "Desconectado" con un punto gris.', categoria: 'Gestion de Clientes' },

  // CLASIFICACION Y CATEGORIAS
  { id: 15, pregunta: 'Como funciona la Clasificacion?', respuesta: 'La seccion de Clasificacion muestra todos los comentarios clasificados por categoria. Incluye un grafico donut con la distribucion porcentual, una lista de categorias con barras de progreso y una tabla detallada con fecha, canal, comentario, categoria asignada y porcentaje de confianza. Los filtros permiten ver solo comentarios de una categoria especifica. Los administradores pueden reasignar categorias manualmente haciendo clic en el boton de edicion.', categoria: 'Clasificacion y Categorias' },
  { id: 16, pregunta: 'Que son las Categorias ML?', respuesta: 'La seccion de Categorias ML muestra las 5 categorias determinadas automaticamente por Machine Learning con sus estadisticas de distribucion. Cada categoria muestra: nombre, descripcion, numero de comentarios clasificados, porcentaje de distribucion y estado (Activa/Inactiva). Los administradores pueden crear nuevas categorias adicionales desde Configuracion. Las categorias ML son fijas y estan definidas en el backend con keywords especificas para cada una.', categoria: 'Clasificacion y Categorias' },
  { id: 17, pregunta: 'Que canales de comunicacion soporta?', respuesta: 'El sistema soporta 6 canales de comunicacion: Web (formularios web), WhatsApp (mensajes de WhatsApp), Email (correos electronicos), Redes Sociales (Facebook, Instagram, Twitter), Presencial (atencion en persona) y Telefono (llamadas). Cada comentario registra su canal de origen, lo que permite analizar que canales generan mas interacciones y como varia el sentimiento por canal.', categoria: 'Clasificacion y Categorias' },

  // DASHBOARD Y REPORTES
  { id: 18, pregunta: 'Que muestra el Dashboard?', respuesta: 'El dashboard principal muestra metricas clave en tiempo real: total de clientes activos, total de comentarios procesados, distribucion por categorias NLP, sentimiento promedio, tiempos de atencion y tendencias. Incluye graficos interactivos de tendencias de comentarios, distribucion por canal, y indicadores de rendimiento del call center. Los datos se actualizan automaticamente via Realtime de Supabase.', categoria: 'Dashboard y Reportes' },
  { id: 19, pregunta: 'Que tipos de reportes hay?', respuesta: 'Hay 3 tipos de reportes: 1) Reportes de NLP: analisis detallado de sentimiento, categorias detectadas, palabras clave y tendencias de comentarios. 2) Reportes Estadisticos: metricas numericas, distribuciones, correlaciones y graficos de datos del call center. 3) Reportes de Atencion: tiempos de respuesta, eficiencia por agente, volumen de solicitudes y metricas de servicio al cliente.', categoria: 'Dashboard y Reportes' },

  // AUDITORIA Y SEGURIDAD
  { id: 20, pregunta: 'Que es la Auditoria?', respuesta: 'El sistema de Auditoria registra automaticamente cada accion importante realizada en la plataforma: INSERT (nuevos registros), UPDATE (modificaciones), DELETE (eliminaciones), CLASIFICACION_AUTO (clasificaciones automaticas por ML), NOTIFICACION_AUTO (notificaciones generadas automaticamente) y PROCESAR_COMENTARIO (analisis de comentarios). Cada registro incluye: usuario que ejecuto la accion, tabla afectada, datos anteriores y nuevos, fecha/hora y direccion IP. Solo los administradores pueden ver la auditoria.', categoria: 'Auditoria y Seguridad' },
  { id: 21, pregunta: 'Como se generan las notificaciones?', respuesta: 'Las notificaciones se generan automaticamente mediante triggers en la base de datos PostgreSQL y pg_cron. El sistema detecta: reclamos urgentes (notifian al admin inmediatamente), patrones inusuales en el volumen de comentarios, comentarios con sentimiento extremadamente negativo, y felicitaciones destacadas. Las notificaciones pueden ser automaticas (generadas por triggers) o manuales (creadas por administradores). Se actualizan en tiempo real via Supabase Realtime.', categoria: 'Auditoria y Seguridad' },
  { id: 22, pregunta: 'Como se protegen los datos?', respuesta: '1) Autenticacion segura con Supabase Auth y contrasenas encriptadas (bcrypt). 2) Row Level Security (RLS) en todas las tablas de PostgreSQL. 3) Reconocimiento facial con embeddings irreversibles calculados en el navegador. 4) Sistema de auditoria que registra todas las acciones. 5) Encriptacion en transito (HTTPS). 6) Tokens JWT con expiracion. 7) Desactivacion automatica de cuentas tras 3 intentos fallidos de login facial.', categoria: 'Auditoria y Seguridad' },

  // TECNOLOGIAS
  { id: 23, pregunta: 'Que tecnologias usa el Frontend?', respuesta: 'React 18 con TypeScript para la interfaz de usuario. Tailwind CSS para el diseno responsivo. Recharts para graficos interactivos (donut, barras, lineas). React Router para navegacion. Lucide React para iconografia. MediaPipe Face Mesh y TensorFlow.js para reconocimiento facial en el navegador. Vite como bundler de desarrollo. Desplegado en Vercel con deploy automatico desde GitHub.', categoria: 'Tecnologias' },
  { id: 24, pregunta: 'Que tecnologias usa el Backend?', respuesta: 'FastAPI (Python) como framework web de alto rendimiento. NLTK para procesamiento de lenguaje natural (tokenizacion, stemming, stopwords en espanol). SciPy para operaciones estadisticas avanzadas. SQLAlchemy como ORM para PostgreSQL. Supabase como base de datos PostgreSQL gestionada con autenticacion, Realtime y Row Level Security integrados. Desplegado en Render con Docker.', categoria: 'Tecnologias' },
  { id: 25, pregunta: 'Que es Supabase y por que lo usan?', respuesta: 'Supabase es una plataforma de base de datos PostgreSQL en la nube que proporciona: autenticacion de usuarios, Row Level Security (RLS), Realtime (actualizaciones en tiempo real via WebSockets), Storage (almacenamiento de archivos), y Edge Functions. Lo usamos porque nos permite tener una base de datos segura y escalable sin necesidad de configurar un servidor de base de datos manualmente, y su sistema de Realtime permite que las actualizaciones se reflejen instantaneamente en todos los clientes conectados.', categoria: 'Tecnologias' },

  // CIENCIA DE DATOS
  { id: 26, pregunta: 'Que es Scientific Data?', respuesta: 'La seccion de Scientific Data contiene herramientas de analisis numerico: 1) Estadisticas: media, mediana, desviacion estandar, percentiles de datos numericos. 2) Interpolacion: estimacion de valores faltantes usando metodos lineales, polinomiales y spline. 3) Optimizacion: resolucion de problemas de optimizacion con restricciones usando SciPy. Estas herramientas son utiles para analizar metricas del call center como tiempos de respuesta y volumen de llamadas.', categoria: 'Ciencia de Datos' },
  { id: 27, pregunta: 'Que es Limpieza de Datos?', respuesta: 'La seccion de Limpieza de Datos permite cargar archivos CSV y realizar operaciones de limpieza: eliminacion de duplicados, tratamiento de valores nulos (relleno con media, mediana, eliminacion), normalizacion de datos, conversion de tipos de datos, y filtrado de outliers. Los datos limpios se pueden exportar para su uso en reportes y graficos. Esta herramienta es util para preparar datos antes del analisis estadistico.', categoria: 'Ciencia de Datos' },

  // SOPORTE
  { id: 28, pregunta: 'Que es TinoBot?', respuesta: 'TinoBot es nuestro asistente virtual integrado en la plataforma. Aparece como un boton flotante azul en la esquina inferior derecha de todas las paginas. Puedes hacerle preguntas sobre como usar el sistema y te guiara a la seccion correspondiente. Por ejemplo, si preguntas "donde veo los clientes?" te respondira "Puedes ver los clientes en la seccion CLIENTES". Los administradores pueden personalizar sus respuestas.', categoria: 'Soporte' },
  { id: 29, pregunta: 'Que son las Solicitudes?', respuesta: 'Las Solicitudes son tickets de soporte que los usuarios pueden crear cuando necesitan ayuda. Cada solicitud incluye: titulo, descripcion, prioridad (baja, media, alta, urgente), estado (pendiente, en progreso, resuelto, cerrado) y fecha de creacion. Los administradores pueden asignar solicitudes a agentes especificos y dar seguimiento hasta su resolucion. Las solicitudes se actualizan en tiempo real.', categoria: 'Soporte' },
  { id: 30, pregunta: 'Que es Configuracion?', respuesta: 'La seccion de Configuracion (solo administradores) permite: crear, editar y eliminar categorias de clasificacion, gestionar usuarios del sistema (crear, activar, desactivar), configurar parametros del sistema, y administrar las palabras clave que el NLP utiliza para el analisis de sentimiento. Es el panel de control principal para personalizar el comportamiento de la plataforma segun las necesidades del call center.', categoria: 'Soporte' },
];

export const FAQ = () => {
  const [busqueda, setBusqueda] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const filtrados = FAQ_DATA.filter((f) => {
    const texto = `${f.pregunta} ${f.respuesta} ${f.categoria}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const categorias = [...new Set(filtrados.map((f) => f.categoria))];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <HelpCircle size={28} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Centro de Ayuda</h1>
          <p className="text-slate-500 text-sm mt-2">Encuentra respuestas sobre BADI Corp y como funciona nuestra plataforma</p>
        </div>

        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en preguntas frecuentes..." className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm" />
        </div>

        <div className="space-y-6">
          {categorias.map((cat) => (
            <div key={cat}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{cat}</h3>
              <div className="space-y-2">
                {filtrados.filter((f) => f.categoria === cat).map((f) => (
                  <div key={f.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <button type="button" onClick={() => setOpenId(openId === f.id ? null : f.id)} className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-slate-50 transition">
                      <span className="text-sm font-medium text-slate-700 pr-4">{f.pregunta}</span>
                      {openId === f.id ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                    </button>
                    {openId === f.id && (
                      <div className="px-4 pb-4 border-t border-slate-100">
                        <p className="text-sm text-slate-600 mt-3 leading-relaxed">{f.respuesta}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <div className="text-center py-16">
              <MessageSquare size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No se encontraron preguntas</p>
            </div>
          )}
        </div>

        <div className="mt-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-center text-white">
          <h3 className="font-semibold mb-2">No encontraste lo que buscabas?</h3>
          <p className="text-blue-100 text-sm mb-4">Crea una solicitud y nuestro equipo te ayudara personalizadamente.</p>
          <a href="/dashboard/solicitudes" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition">
            Crear Solicitud
          </a>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
