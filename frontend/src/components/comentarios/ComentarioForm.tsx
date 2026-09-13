import { useState } from 'react';
import { Send, BrainCircuit } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Cliente {
  id: number;
  nombre: string;
  empresa: string;
}

interface ComentarioFormProps {
  clientes: Cliente[];
  onSubmit: (data: { cliente_id: number | null; contenido: string; canal: string; autoProcesar: boolean }) => Promise<void>;
}

const canalOptions = ['web', 'email', 'telefono', 'chat', 'redes'];

export const ComentarioForm = ({ clientes, onSubmit }: ComentarioFormProps) => {
  const [contenido, setContenido] = useState('');
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [canal, setCanal] = useState('web');
  const [autoProcesar, setAutoProcesar] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contenido.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        cliente_id: clienteId || null,
        contenido: contenido.trim(),
        canal,
        autoProcesar,
      });
      setContenido('');
      setClienteId('');
      setCanal('web');
      setAutoProcesar(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Cliente</label>
        <select
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        >
          <option value="">Sin cliente</option>
          {clientes.map((cl) => (
            <option key={cl.id} value={cl.id}>{cl.nombre} — {cl.empresa || 'N/A'}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Canal</label>
        <select
          value={canal}
          onChange={(e) => setCanal(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        >
          {canalOptions.map((o) => (
            <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Comentario</label>
        <textarea
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
          placeholder="Escribe el comentario..."
          rows={4}
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="autoProcesar"
          checked={autoProcesar}
          onChange={(e) => setAutoProcesar(e.target.checked)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="autoProcesar" className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
          <BrainCircuit size={14} className="text-purple-500" />
          Procesar automáticamente (NLP)
        </label>
      </div>
      <Button type="submit" loading={loading} icon={<Send size={16} />} className="w-full">
        {loading ? 'Guardando...' : 'Publicar'}
      </Button>
    </form>
  );
};
