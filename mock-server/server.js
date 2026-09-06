const http = require('http');
const PORT = 8000;

const clientes = [
  { id: 1, nombre: 'TechCorp SA', email: 'info@techcorp.com', telefono: '+54 11 1234-5678', empresa: 'TechCorp', activo: true },
  { id: 2, nombre: 'Digital Solutions', email: 'contacto@digital.com', telefono: '+54 11 2345-6789', empresa: 'Digital Solutions', activo: true },
  { id: 3, nombre: 'Innovar Group', email: 'hello@innovar.com', telefono: '+54 11 3456-7890', empresa: 'Innovar', activo: true },
  { id: 4, nombre: 'StartUp Labs', email: 'team@startup.com', telefono: '+54 11 4567-8901', empresa: 'StartUp Labs', activo: false },
  { id: 5, nombre: 'GlobalTrade', email: 'info@global.com', telefono: '+54 11 5678-9012', empresa: 'GlobalTrade', activo: true },
  { id: 6, nombre: 'DataMetrics', email: 'admin@data.com', telefono: '+54 11 6789-0123', empresa: 'DataMetrics', activo: true },
];

const comentarios = [
  { id: 1, cliente_id: 1, contenido: 'El servicio fue rapido y la atencion excelente', canal: 'web', estado: 'procesado', categoria: 'FELICITACION', fecha: '2026-08-15', procesado: true },
  { id: 2, cliente_id: 2, contenido: 'Tengo un problema con el producto que compre', canal: 'email', estado: 'procesado', categoria: 'SOPORTE', fecha: '2026-08-14', procesado: true },
  { id: 3, cliente_id: 3, contenido: 'Muy buena experiencia de compra', canal: 'web', estado: 'procesado', categoria: 'FELICITACION', fecha: '2026-08-13', procesado: true },
  { id: 4, cliente_id: 4, contenido: 'Quiero saber precios de los planes', canal: 'telefono', estado: 'procesado', categoria: 'CONSULTA', fecha: '2026-08-12', procesado: true },
  { id: 5, cliente_id: 5, contenido: 'El producto llego danado', canal: 'web', estado: 'pendiente', categoria: 'RECLAMO', fecha: '2026-08-11', procesado: false },
  { id: 6, cliente_id: 6, contenido: 'Excelente plataforma, muy intuitiva', canal: 'web', estado: 'procesado', categoria: 'FELICITACION', fecha: '2026-08-10', procesado: true },
];

const tiempos = [
  { id: 1, cliente_id: 1, tiempo_minutos: 12.5, operador: 'Juan Perez', fecha: '2026-08-15' },
  { id: 2, cliente_id: 2, tiempo_minutos: 15.0, operador: 'Maria Garcia', fecha: '2026-08-15' },
  { id: 3, cliente_id: 3, tiempo_minutos: 18.3, operador: 'Carlos Lopez', fecha: '2026-08-14' },
  { id: 4, cliente_id: 4, tiempo_minutos: 20.1, operador: 'Ana Martinez', fecha: '2026-08-14' },
  { id: 5, cliente_id: 5, tiempo_minutos: 11.2, operador: 'Pedro Sanchez', fecha: '2026-08-13' },
  { id: 6, cliente_id: 6, tiempo_minutos: 14.8, operador: 'Laura Torres', fecha: '2026-08-13' },
];

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  const url = req.url.split('?')[0];

  if (url === '/api/health') return json(res, { status: 'ok' });
  
  // CLIENTES CRUD
  if (url === '/api/clientes' && req.method === 'GET') return json(res, clientes);
  if (url === '/api/clientes' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const nuevo = { id: clientes.length + 1, ...data, activo: true, created_at: new Date().toISOString() };
      clientes.unshift(nuevo);
      return json(res, nuevo, 201);
    });
    return;
  }
  if (url.startsWith('/api/clientes/') && req.method === 'DELETE') {
    const id = parseInt(url.split('/')[3]);
    const idx = clientes.findIndex(c => c.id === id);
    if (idx !== -1) clientes.splice(idx, 1);
    return json(res, { ok: true });
  }

  // COMENTARIOS CRUD
  if (url === '/api/comentarios' && req.method === 'GET') return json(res, comentarios);
  if (url === '/api/comentarios' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const nuevo = { 
        id: comentarios.length + 1, 
        cliente_id: data.cliente_id || 1, 
        contenido: data.contenido, 
        canal: data.canal || 'web', 
        estado: 'procesado', 
        categoria: data.categoria || 'CONSULTA', 
        fecha: new Date().toISOString(), 
        procesado: true 
      };
      comentarios.unshift(nuevo);
      return json(res, nuevo, 201);
    });
    return;
  }
  if (url.startsWith('/api/comentarios/') && req.method === 'DELETE') {
    const id = parseInt(url.split('/')[3]);
    const idx = comentarios.findIndex(c => c.id === id);
    if (idx !== -1) comentarios.splice(idx, 1);
    return json(res, { ok: true });
  }

  if (url === '/api/tiempos') return json(res, tiempos);

  if (url === '/api/dashboard') {
    return json(res, {
      total_clientes: clientes.length,
      total_comentarios: comentarios.length,
      promedio_atencion: 15.3,
      porcentaje_procesados: 94.2,
    });
  }

  if (url === '/api/nltk/analizar' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { texto } = JSON.parse(body || '{}');
      const rawText = (texto || '');
      const tLower = rawText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const palabras = tLower.split(/[^a-z]+/).filter(w => w.length > 2);
      
      let categoria = 'CONSULTA';
      let sentimiento = 'neutro';
      let posScore = 0;
      let negScore = 0;

      const posWords = ['gracias', 'excelente', 'bueno', 'buena', 'buenisimo', 'rapido', 'rapida', 'genial', 'perfecto', 'agradable', 'eficiente', 'intuitiva', 'recomiendo', 'felicidades', 'felicitaciones', 'satisfecho', 'satisfecha', 'encanta', 'encanto', 'bien'];
      const negWords = ['error', 'falla', 'lento', 'demora', 'pesimo', 'pesima', 'problema', 'inaceptable', 'terrible', 'queja', 'reclamo', 'molesto', 'danado', 'danada', 'mal', 'malo', 'mala', 'malisimo', 'tarde', 'tardo', 'estafa', 'caro', 'desastre', 'horrible', 'cancelar'];
      const ventasWords = ['factura', 'facturacion', 'precio', 'precios', 'costo', 'costos', 'comprar', 'compra', 'plan', 'planes', 'contrato', 'pagar', 'pago', 'descuento', 'tarifa', 'cotizacion', 'presupuesto'];
      const soporteWords = ['sistema', 'contrasena', 'clave', 'password', 'acceso', 'login', 'pantalla', 'soporte', 'tecnico', 'bug', 'plataforma', 'app', 'cuenta', 'conexion', 'configurar'];

      palabras.forEach(w => {
        if (posWords.some(pw => w.startsWith(pw.slice(0, 4)))) posScore += 2;
        if (negWords.some(nw => w.startsWith(nw.slice(0, 4)))) negScore += 2;
      });

      if (tLower.includes('no funciona') || tLower.includes('no sirve') || tLower.includes('muy lento') || tLower.includes('pesimo')) negScore += 4;
      if (tLower.includes('muchas gracias') || tLower.includes('excelente atencion') || tLower.includes('muy bueno')) posScore += 4;

      if (posScore > negScore || posWords.some(pw => tLower.includes(pw))) {
        categoria = 'FELICITACION';
        sentimiento = 'positivo';
      } else if (negScore > posScore || negWords.some(nw => tLower.includes(nw))) {
        categoria = 'RECLAMO';
        sentimiento = 'negativo';
      } else if (soporteWords.some(sw => tLower.includes(sw))) {
        categoria = 'SOPORTE';
        sentimiento = 'neutro';
      } else if (ventasWords.some(vw => tLower.includes(vw))) {
        categoria = 'VENTAS';
        sentimiento = 'neutro';
      }

      const freqMap = {};
      palabras.forEach(p => { freqMap[p] = (freqMap[p] || 0) + 1; });
      const topWords = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([p, f]) => ({ palabra: p, frecuencia: f }));

      return json(res, {
        idioma: 'es',
        cantidad_palabras: palabras.length,
        tokens: palabras,
        keywords: topWords.map(t => t.palabra),
        temas: [categoria, 'Atención al Cliente', 'Experiencia'],
        palabras_frecuentes: topWords,
        categoria: categoria,
        categoria_detectada: categoria,
        sentimiento: sentimiento,
        confianza: 94.5,
      });
    });
    return;
  }

  if (url === '/api/nltk/centro-inteligente') {
    return json(res, {
      clientes: clientes.length,
      comentarios: comentarios.length,
      promedioRespuesta: 15.3,
      procesados: 83.3,
    });
  }

  if (url === '/api/nltk/comentarios') {
    return json(res, comentarios.map(c => ({
      id: c.id,
      clienteId: c.cliente_id,
      clienteNombre: clientes.find(cl => cl.id === c.cliente_id)?.nombre || `Cliente #${c.cliente_id}`,
      empresa: clientes.find(cl => cl.id === c.cliente_id)?.empresa || 'Corporativo',
      texto: c.contenido,
      categoria: c.categoria,
      confianza: 92,
      sentimiento: c.categoria === 'FELICITACION' ? 'positivo' : c.categoria === 'RECLAMO' ? 'negativo' : 'neutro',
      procesado: c.procesado,
      fecha: c.fecha,
      canal: c.canal,
      estado: c.estado
    })));
  }

  if (url === '/api/nltk/categorias') {
    return json(res, [
      { nombre: 'SOPORTE', total: 42, porcentaje: 42, color: '#2563eb' },
      { nombre: 'VENTAS', total: 28, porcentaje: 28, color: '#059669' },
      { nombre: 'FELICITACION', total: 18, porcentaje: 18, color: '#d97706' },
      { nombre: 'RECLAMO', total: 12, porcentaje: 12, color: '#dc2626' }
    ]);
  }

  if (url === '/api/nltk/palabras-frecuentes') {
    return json(res, [
      { palabra: 'servicio', frecuencia: 34, color: '#2563eb' },
      { palabra: 'atención', frecuencia: 28, color: '#059669' },
      { palabra: 'rápido', frecuencia: 21, color: '#d97706' },
      { palabra: 'excelente', frecuencia: 18, color: '#7c3aed' },
      { palabra: 'soporte', frecuencia: 15, color: '#0891b2' },
    ]);
  }

  if (url === '/api/scipy/tiempos-atencion') {
    return json(res, [
      { hora: '08:00', minutos: 14.5, sla: 30 },
      { hora: '10:00', minutos: 18.2, sla: 30 },
      { hora: '12:00', minutos: 24.1, sla: 30 },
      { hora: '14:00', minutos: 19.8, sla: 30 },
      { hora: '16:00', minutos: 15.3, sla: 30 },
      { hora: '18:00', minutos: 12.0, sla: 30 },
    ]);
  }

  if (url === '/api/scipy/optimizacion') {
    return json(res, {
      areas: [
        { nombre: 'Atención Nivel 1', valor: 85, color: '#2563eb' },
        { nombre: 'Resolución Técnica', valor: 92, color: '#059669' },
        { nombre: 'Facturación', valor: 78, color: '#d97706' },
        { nombre: 'Tiempo de Espera', valor: 88, color: '#7c3aed' },
      ],
      recomendaciones: [
        {
          titulo: 'Optimizar asignación de operadores en horas punta',
          descripcion: 'El modelo SciPy minimize sugiere balancear 3 agentes adicionales en el turno de la tarde.',
          impacto: 'Alto',
          aplicada: false
        },
        {
          titulo: 'Estandarización de respuestas frecuentes',
          descripcion: 'Reducción del 25% en tiempo de respuesta aplicando clasificación NLTK.',
          impacto: 'Medio',
          aplicada: true
        }
      ],
      puntajeGeneral: 87
    });
  }

  if (url === '/api/scipy/interpolacion' && req.method === 'POST') {
    const puntos = [];
    const base = [12.0, 14.5, 15.0, 18.0, 20.5, 22.0];
    for (let i = 1; i <= 12; i++) {
      puntos.push({
        x: i,
        observado: i <= 6 ? base[i - 1] : null,
        interpolado: Math.round((11 + i * 1.1 + Math.sin(i)) * 10) / 10
      });
    }
    return json(res, { puntos, r2: 0.985, errorMedio: 0.42, errorRelativo: 0.03 });
  }

  if (url === '/api/scipy/estadisticas' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { valores } = JSON.parse(body || '{}');
      const valArr = Array.isArray(valores) && valores.length > 0 ? valores : [12, 15, 18, 20, 11, 25, 19, 17, 14, 21];
      const sorted = [...valArr].sort((a, b) => a - b);
      const media = valArr.reduce((a, b) => a + b, 0) / valArr.length;
      const mediana = sorted[Math.floor(sorted.length / 2)];
      const desv = Math.sqrt(valArr.reduce((acc, n) => acc + (n - media) ** 2, 0) / valArr.length);
      return json(res, {
        cantidad: valArr.length,
        media: Math.round(media * 100) / 100,
        mediana: Math.round(mediana * 100) / 100,
        desviacion_estandar: Math.round(desv * 100) / 100,
        minimo: Math.min(...valArr),
        maximo: Math.max(...valArr),
        percentil_25: sorted[Math.floor(sorted.length * 0.25)],
        percentil_75: sorted[Math.floor(sorted.length * 0.75)],
      });
    });
    return;
  }

  json(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  console.log(`Mock Server corriendo en http://localhost:${PORT}`);
});
