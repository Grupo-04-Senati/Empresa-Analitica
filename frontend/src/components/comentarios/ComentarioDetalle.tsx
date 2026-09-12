import { BrainCircuit, Tag, Hash } from 'lucide-react';
import { Card } from '../ui/Card';

interface AnalisisNLP {
  idioma: string;
  categoria_detectada: string;
  confianza: number;
  palabras_frecuentes: string[];
}

interface ComentarioDetalleProps {
  contenido: string;
  analisis: AnalisisNLP | null;
}

export const ComentarioDetalle = ({ contenido, analisis }: ComentarioDetalleProps) => {
  if (!analisis) {
    return (
      <Card className="flex flex-col items-center justify-center text-center py-12">
        <BrainCircuit size={34} className="text-slate-400 mb-4" />
        <p className="font-semibold text-slate-700 mb-1">Sin análisis</p>
        <p className="text-sm text-slate-400">Este comentario aún no ha sido procesado por NLP.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <BrainCircuit size={18} className="text-blue-600" />
        <h3 className="font-semibold text-slate-700">Análisis NLP</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Categoría detectada</p>
          <p className="text-lg font-bold text-slate-800">{analisis.categoria_detectada}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Confianza</p>
          <p className="text-lg font-bold text-slate-800">{(analisis.confianza * 100).toFixed(0)}%</p>
          <div className="w-full h-2 bg-slate-200 rounded-full mt-2">
            <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${analisis.confianza * 100}%` }} />
          </div>
        </div>
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          <Hash size={13} /> Palabras clave
        </p>
        <div className="flex flex-wrap gap-2">
          {analisis.palabras_frecuentes.length > 0 ? (
            analisis.palabras_frecuentes.map((palabra, i) => (
              <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                {typeof palabra === 'string' ? palabra : palabra}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">Sin palabras clave</span>
          )}
        </div>
      </div>
    </Card>
  );
};
