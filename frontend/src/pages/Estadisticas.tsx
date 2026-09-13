import { useState, useEffect } from 'react';
import { Calculator, BrainCircuit, Database, Loader2, RefreshCw, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react';
import { apiGet } from '@/services/api';
import { calculoStatsLocal } from '@/services/scipy';

interface EstadisticasBackend {
  tiene_datos: boolean;
  stats_tiempos: {
    cantidad: number;
    media: number;
    mediana: number;
    desviacion_estandar: number;
    minimo: number;
    maximo: number;
    percentil_25: number;
    percentil_75: number;
  } | null;
  categorias: { nombre: string; total: number }[];
  total_comentarios: number;
  procesados: number;
  total_analisis: number;
}

const KpiCard = ({ icono: Icon, valor, subtitulo, color, bg }: { icono: any; valor: string | number; subtitulo: string; color: string; bg: string }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
    <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${bg} ${color}`}><Icon size={20} /></span>
    <div>
      <p className="text-xl font-bold text-slate-800">{valor}</p>
      <p className="text-xs text-slate-500">{subtitulo}</p>
    </div>
  </div>
);

const Estadisticas = () => {
  const [stats, setStats] = useState<EstadisticasBackend | null>(null);
  const [statsLocal, setStatsLocal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBtn, setLoadingBtn] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const backendData = await apiGet<EstadisticasBackend>('/api/reportes/estadisticas');
      setStats(backendData);
      if (backendData?.stats_tiempos) {
        setStatsLocal(backendData.stats_tiempos);
      } else {
        setStatsLocal(null);
      }
    } catch {
      setStats(null);
      setStatsLocal(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const tieneDatos = stats?.tiene_datos && statsLocal && statsLocal.cantidad >= 2;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Estadísticas Avanzadas</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis de datos de la base de datos usando SciPy</p>
        </div>
        <button onClick={fetchData} disabled={loadingBtn} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2 transition disabled:opacity-50">
          <RefreshCw size={16} className={loadingBtn ? 'animate-spin' : ''} /> Recalcular
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !stats?.tiene_datos ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Recopilando datos insuficientes para el modelado</h3>
          <p className="text-slate-400 text-sm">Las estadísticas se calcularán automáticamente cuando haya datos en la base.</p>
          <p className="text-slate-400 text-xs mt-2">Se necesitan al menos 2 registros de tiempos de atención.</p>
        </div>
      ) : tieneDatos ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard icono={Database} valor={statsLocal.cantidad} subtitulo="Registros totales" color="text-blue-600" bg="bg-blue-50" />
            <KpiCard icono={Calculator} valor={`${statsLocal.media} min`} subtitulo="Media de tiempos" color="text-emerald-600" bg="bg-emerald-50" />
            <KpiCard icono={BarChart3} valor={`${statsLocal.desviacion_estandar} min`} subtitulo="Desviación estándar" color="text-amber-600" bg="bg-amber-50" />
            <KpiCard icono={TrendingUp} valor={`${statsLocal.mediana} min`} subtitulo="Mediana" color="text-purple-600" bg="bg-purple-50" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Mínimo', valor: statsLocal.minimo, color: 'text-emerald-600' },
              { label: 'Máximo', valor: statsLocal.maximo, color: 'text-red-600' },
              { label: 'P25', valor: statsLocal.percentil_25, color: 'text-blue-600' },
              { label: 'P75', valor: statsLocal.percentil_75, color: 'text-purple-600' },
              { label: 'Media', valor: statsLocal.media, color: 'text-emerald-600' },
              { label: 'Mediana', valor: statsLocal.mediana, color: 'text-purple-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.valor} min</p>
              </div>
            ))}
          </div>

          {statsLocal.desviacion_estandar > statsLocal.media * 0.5 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Alta variabilidad detectada</p>
                <p className="text-sm text-amber-700">La desviación estándar ({statsLocal.desviacion_estandar} min) es alta comparada con la media ({statsLocal.media} min), lo que indica tiempos de atención inconsistentes.</p>
              </div>
            </div>
          )}

          {stats?.total_comentarios !== undefined && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <BrainCircuit size={18} className="text-blue-600" />
                <h3 className="font-semibold text-slate-700">Resumen de Datos</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-2xl font-bold text-slate-800">{stats.total_comentarios}</p><p className="text-xs text-slate-500">Comentarios totales</p></div>
                <div><p className="text-2xl font-bold text-emerald-600">{stats.procesados}</p><p className="text-xs text-slate-500">Procesados</p></div>
                <div><p className="text-2xl font-bold text-blue-600">{stats.total_analisis}</p><p className="text-xs text-slate-500">Análisis NLP</p></div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Recopilando datos insuficientes para el modelado</h3>
          <p className="text-slate-400 text-sm">Se encontraron {stats?.tiene_datos ? 'algunos' : '0'} registros, pero se necesitan al menos 2.</p>
          <p className="text-slate-400 text-xs mt-2">Registra tiempos de atención para comenzar el modelado.</p>
        </div>
      )}
    </div>
  );
};

export default Estadisticas;
