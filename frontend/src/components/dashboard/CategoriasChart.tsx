import { Tags } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';

interface CategoriaDist {
  nombre: string;
  total: number;
  porcentaje: number;
}

interface CategoriasChartProps {
  data: CategoriaDist[];
}

const colors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2', '#4f46e5', '#16a34a'];

export const CategoriasChart = ({ data }: CategoriasChartProps) => {
  return (
    <Card>
      <CardHeader icon={<Tags size={18} className="text-purple-600" />} title="Categorías NLP" />
      {data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
          Sin categorías disponibles
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto">
          {data.map((c, i) => (
            <div key={c.nombre}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />
                  <span className="text-sm text-slate-700">{c.nombre}</span>
                </div>
                <span className="text-xs font-medium text-slate-500">{c.porcentaje}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${c.porcentaje}%`, background: colors[i % colors.length] }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
