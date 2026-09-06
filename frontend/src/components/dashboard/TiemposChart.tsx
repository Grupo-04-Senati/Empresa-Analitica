import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';

interface TiempoPunto {
  fecha: string;
  minutos: number;
  sla: number;
}

interface TiemposChartProps {
  data: TiempoPunto[];
}

export const TiemposChart = ({ data }: TiemposChartProps) => {
  return (
    <Card>
      <CardHeader icon={<Clock size={18} className="text-blue-600" />} title="Tiempos de Atención" />
      {data.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
          Sin datos de tiempos
        </div>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="tiempoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Area type="monotone" dataKey="minutos" name="Minutos" stroke="#2563eb" strokeWidth={2.5} fill="url(#tiempoGrad)" />
              <Area type="monotone" dataKey="sla" name="SLA" stroke="#d97706" strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};
