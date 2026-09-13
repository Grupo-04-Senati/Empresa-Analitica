import { useState, useEffect } from 'react';
import { Tags, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

interface CategoriaConDist extends Categoria {
  total: number;
}

const ML_COLORS: Record<string, string> = {
  FELICITACION: 'bg-emerald-500',
  RECLAMO: 'bg-red-500',
  SOPORTE: 'bg-blue-500',
  VENTAS: 'bg-amber-500',
  CONSULTA: 'bg-slate-400',
};

const ML_LABELS: Record<string, string> = {
  FELICITACION: 'Felicitacion',
  RECLAMO: 'Reclamo',
  SOPORTE: 'Soporte Tecnico',
  VENTAS: 'Ventas / Facturacion',
  CONSULTA: 'Consulta General',
};

const colores = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-slate-400',
];

export const Categorias = () => {
  const [categorias, setCategorias] = useState<CategoriaConDist[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const { data: cats } = await supabase.from('categorias').select('*').order('nombre');
      const { data: analisis } = await supabase.from('analisis_nlp').select('categoria_detectada');

      const conteo: Record<string, number> = {};
      if (analisis) {
        analisis.forEach((a: any) => {
          const cat = a.categoria_detectada;
          if (cat) conteo[cat] = (conteo[cat] || 0) + 1;
        });
      }

      if (cats) {
        const enriched = cats.map((c: any) => ({
          ...c,
          total: conteo[c.nombre] || 0,
        }));
        setCategorias(enriched);
      }
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategorias(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('categorias-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'analisis_nlp' }, () => { fetchCategorias(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, () => { fetchCategorias(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalAnalisis = categorias.reduce((acc, c) => acc + c.total, 0);
  const max = Math.max(...categorias.map((c) => c.total), 1);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Categorias ML</h2>
          <p className="text-slate-500 text-sm mt-1">Categorias determinadas automaticamente por Machine Learning</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Total Categorias</span>
            <Tags size={18} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{categorias.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Activas</span>
            <Tags size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{categorias.filter((c) => c.activo).length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Total Analisis</span>
            <Tags size={18} className="text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{totalAnalisis}</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : categorias.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Tags size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No hay categorias registradas</p>
          <p className="text-sm text-slate-400 mt-1">Ejecuta el SQL FIX_ML_CATEGORIAS.sql en Supabase SQL Editor</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorias.map((cat, i) => {
            const pct = totalAnalisis > 0 ? Math.round((cat.total / totalAnalisis) * 100) : 0;
            const barW = (cat.total / max) * 100;
            const colorClass = ML_COLORS[cat.nombre] || colores[i % colores.length];
            const label = ML_LABELS[cat.nombre] || cat.nombre;
            return (
              <div key={cat.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${colorClass}`} />
                    <h4 className="font-semibold text-slate-700">{label}</h4>
                  </div>
                </div>
                {cat.descripcion && (
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2">{cat.descripcion}</p>
                )}
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>Distribucion</span>
                  <span className="font-medium text-slate-700">{cat.total} ({pct}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${colorClass}`}
                    style={{ width: `${barW}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${cat.activo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="text-xs text-slate-500">{cat.activo ? 'Activa' : 'Inactiva'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Categorias;
