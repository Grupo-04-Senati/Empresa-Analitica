import { useState, useEffect } from 'react';
import { Calculator, BrainCircuit, Database, Loader2, RefreshCw, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react';
import { supabase } from '@/services/supabase';

const KpiCard = ({ icono: Icon, valor, subtitulo, color, bg }: { icono: any; valor: string | number; subtitulo: string; color: string; bg: string }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
    <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${bg} ${color}`}><Icon size={20} /></span>
    <div><p className="text-xl font-bold text-slate-800">{valor}</p><p className="text-xs text-slate-500">{subtitulo}</p></div>
  </div>
);

const Estadisticas = () => {
  const [stats, setStats] = useState<any>(null);
  const [resumen, setResumen] = useState({ totalComentarios: 0, procesados: 0, totalAnalisis: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tiemposRes, comRes, nlpRes] = await Promise.all([
        supabase.from('tiempos_atencion').select('tiempo_minutos'),
        supabase.from('comentarios').select('id, procesado'),
        supabase.from('analisis_nlp').select('id'),
      ]);

      const comData = comRes.data || [];
      setResumen({ totalComentarios: comData.length, procesados: comData.filter(c => c.procesado).length, totalAnalisis: (nlpRes.data || []).length });

      const tiempos = (tiemposRes.data || []).map(r => Number(r.tiempo_minutos)).filter(t => !isNaN(t));
      if (tiempos.length >= 2) {
        const sorted = [...tiempos].sort((a, b) => a - b);
        const avg = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
        const mediana = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
        const varianza = tiempos.reduce((sum, t) => sum + (t - avg) ** 2, 0) / tiempos.length;
        setStats({
          cantidad: tiempos.length,
          media: Math.round(avg * 100) / 100,
          mediana: Math.round(mediana * 100) / 100,
          desviacion_estandar: Math.round(Math.sqrt(varianza) * 100) / 100,
          minimo: sorted[0], maximo: sorted[sorted.length - 1],
          percentil_25: sorted[Math.floor(sorted.length * 0.25)],
          percentil_75: sorted[Math.floor(sorted.length * 0.75)],
        });
      } else { setStats(null); }
    } catch { /* empty */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Estadisticas Avanzadas</h2>
          <p className="text-slate-500 text-sm mt-1">Analisis de datos de la base de datos usando SciPy</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2 transition disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Recalcular
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !stats ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Recopilando datos insuficientes para el modelado</h3>
          <p className="text-slate-400 text-sm">Las estadisticas se calcularan automaticamente cuando haya datos en la base.</p>
          <p className="text-slate-400 text-xs mt-2">Se necesitan al menos 2 registros de tiempos de atencion.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard icono={Database} valor={stats.cantidad} subtitulo="Registros totales" color="text-blue-600" bg="bg-blue-50" />
            <KpiCard icono={Calculator} valor={`${stats.media} min`} subtitulo="Media de tiempos" color="text-emerald-600" bg="bg-emerald-50" />
            <KpiCard icono={BarChart3} valor={`${stats.desviacion_estandar} min`} subtitulo="Desviacion estandar" color="text-amber-600" bg="bg-amber-50" />
            <KpiCard icono={TrendingUp} valor={`${stats.mediana} min`} subtitulo="Mediana" color="text-purple-600" bg="bg-purple-50" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Minimo', valor: stats.minimo, color: 'text-emerald-600' },
              { label: 'Maximo', valor: stats.maximo, color: 'text-red-600' },
              { label: 'P25', valor: stats.percentil_25, color: 'text-blue-600' },
              { label: 'P75', valor: stats.percentil_75, color: 'text-purple-600' },
              { label: 'Media', valor: stats.media, color: 'text-emerald-600' },
              { label: 'Mediana', valor: stats.mediana, color: 'text-purple-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.valor} min</p>
              </div>
            ))}
          </div>

          {stats.desviacion_estandar > stats.media * 0.5 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Alta variabilidad detectada</p>
                <p className="text-sm text-amber-700">La desviacion estandar ({stats.desviacion_estandar} min) es alta comparada con la media ({stats.media} min), lo que indica tiempos de atencion inconsistentes.</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><BrainCircuit size={18} className="text-blue-600" /> Resumen de Datos</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-2xl font-bold text-slate-800">{resumen.totalComentarios}</p><p className="text-xs text-slate-500">Comentarios totales</p></div>
              <div><p className="text-2xl font-bold text-emerald-600">{resumen.procesados}</p><p className="text-xs text-slate-500">Procesados</p></div>
              <div><p className="text-2xl font-bold text-blue-600">{resumen.totalAnalisis}</p><p className="text-xs text-slate-500">Analisis NLP</p></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Estadisticas;
