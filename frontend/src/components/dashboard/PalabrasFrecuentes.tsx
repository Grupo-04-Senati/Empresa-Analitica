import { BrainCircuit, Hash } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';

interface PalabraFreq {
  palabra: string;
  frecuencia: number;
}

interface PalabrasFrecuentesProps {
  data: PalabraFreq[];
}

export const PalabrasFrecuentes = ({ data }: PalabrasFrecuentesProps) => {
  return (
    <Card>
      <CardHeader icon={<Hash size={18} className="text-amber-600" />} title="Palabras Más Frecuentes" />
      {data.length === 0 ? (
        <div className="h-[80px] flex items-center justify-center text-slate-400 text-sm">
          Sin palabras frecuentes disponibles
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.map((w) => (
            <span
              key={w.palabra}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border"
              style={{
                fontSize: `${Math.max(12, Math.min(16, 12 + w.frecuencia / 3))}px`,
                color: '#4f46e5',
                background: '#eef2ff',
                borderColor: '#c7d2fe',
              }}
            >
              <BrainCircuit size={14} />
              {w.palabra}
              <span className="text-xs text-indigo-400 ml-1">{w.frecuencia}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
};
