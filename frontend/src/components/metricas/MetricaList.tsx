import { BarChart3, TrendingUp, Activity } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';

interface StatItem {
  label: string;
  valor: string;
  icono: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bg: string;
}

interface MetricaListProps {
  stats: StatItem[];
}

export const MetricaList = ({ stats }: MetricaListProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => {
        const Icon = s.icono;
        return (
          <Card key={s.label} className="flex items-center gap-3">
            <span className={`flex items-center justify-center w-10 h-10 rounded-xl ${s.bg} ${s.color}`}>
              <Icon size={20} />
            </span>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">{s.label}</p>
              <p className="text-lg font-bold text-slate-800">{s.valor}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
