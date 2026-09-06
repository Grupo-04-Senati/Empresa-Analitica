import { Users, MessageSquare, Clock, CheckCircle2, BrainCircuit, AlertTriangle } from 'lucide-react';

interface KpiData {
  totalClientes: number;
  totalComentarios: number;
  avgTiempoAtencion: number;
  porcentajeProcesados: number;
  totalAnalisis: number;
  comentariosPendientes: number;
}

interface KpiCardsProps {
  data: KpiData;
}

export const KpiCards = ({ data }: KpiCardsProps) => {
  const kpis = [
    { icono: Users, label: 'Clientes', valor: data.totalClientes.toString(), color: '#2563eb', bg: '#eff6ff' },
    { icono: MessageSquare, label: 'Comentarios', valor: data.totalComentarios.toLocaleString('es-ES'), color: '#059669', bg: '#ecfdf5' },
    { icono: Clock, label: 'Promedio', valor: data.avgTiempoAtencion > 0 ? `${data.avgTiempoAtencion} min` : '—', color: '#d97706', bg: '#fffbeb' },
    { icono: CheckCircle2, label: 'Procesados', valor: `${data.porcentajeProcesados}%`, color: '#7c3aed', bg: '#f5f3ff' },
    { icono: BrainCircuit, label: 'Análisis NLP', valor: data.totalAnalisis.toString(), color: '#0891b2', bg: '#ecfeff' },
    { icono: AlertTriangle, label: 'Pendientes', valor: data.comentariosPendientes.toString(), color: '#e11d48', bg: '#fff1f2' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {kpis.map((k) => {
        const Icon = k.icono;
        return (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ background: k.bg, color: k.color }}>
              <Icon size={18} />
            </span>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">{k.label}</p>
              <p className="text-lg font-bold text-slate-800">{k.valor}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
