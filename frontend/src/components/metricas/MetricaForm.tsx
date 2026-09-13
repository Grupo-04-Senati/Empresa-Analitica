import { useState } from 'react';
import { Calculator, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';

interface MetricaFormProps {
  onCalcular: (data: { fecha_inicio: string; fecha_fin: string }) => Promise<void>;
}

export const MetricaForm = ({ onCalcular }: MetricaFormProps) => {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaInicio || !fechaFin) return;
    setLoading(true);
    try {
      await onCalcular({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={<Calculator size={18} className="text-blue-600" />} title="Calcular Metricas" />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              required
            />
          </div>
        </div>
        <Button type="submit" loading={loading} icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />} className="w-full">
          {loading ? 'Calculando...' : 'Calcular Estadisticas'}
        </Button>
      </form>
    </Card>
  );
};
