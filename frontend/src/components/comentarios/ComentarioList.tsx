import { MessageSquare, Trash2 } from 'lucide-react';

interface Comentario {
  id: number;
  contenido: string;
  canal: string;
  categoria: string | null;
  estado: string;
  procesado: boolean;
  fecha: string;
  clientes?: { nombre: string; empresa: string } | null;
}

interface ComentarioListProps {
  comentarios: Comentario[];
  onDelete: (id: number) => void;
}

export const ComentarioList = ({ comentarios, onDelete }: ComentarioListProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-3 px-4 font-medium text-slate-500">Cliente</th>
            <th className="text-left py-3 px-4 font-medium text-slate-500">Contenido</th>
            <th className="text-left py-3 px-4 font-medium text-slate-500">Canal</th>
            <th className="text-left py-3 px-4 font-medium text-slate-500">Categoría</th>
            <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
            <th className="text-left py-3 px-4 font-medium text-slate-500">Procesado</th>
            <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th>
            <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {comentarios.map((c) => (
            <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
              <td className="py-3 px-4">
                <p className="font-medium text-slate-800">{c.clientes?.nombre || 'Sin cliente'}</p>
                {c.clientes?.empresa && <p className="text-xs text-slate-400">{c.clientes.empresa}</p>}
              </td>
              <td className="py-3 px-4 max-w-xs">
                <p className="text-slate-600 truncate">{c.contenido}</p>
              </td>
              <td className="py-3 px-4">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{c.canal}</span>
              </td>
              <td className="py-3 px-4">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{c.categoria || '—'}</span>
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' : c.estado === 'resuelto' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                  {c.estado === 'pendiente' ? 'Pendiente' : c.estado === 'resuelto' ? 'Resuelto' : c.estado}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.procesado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {c.procesado ? 'Procesado' : 'Pendiente'}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                {new Date(c.fecha).toLocaleDateString('es-ES')}
              </td>
              <td className="py-3 px-4 text-right">
                <button onClick={() => onDelete(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
          {comentarios.length === 0 && (
            <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">No hay comentarios</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
