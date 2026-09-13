import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, HelpCircle, BarChart3, Users, ClipboardList, MessageSquare, Settings } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'bot' | 'user';
  timestamp: Date;
  options?: { label: string; action: string }[];
}

const topics = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, description: 'Ver metricas y graficos' },
  { id: 'solicitudes', label: 'Solicitudes', icon: ClipboardList, description: 'Crear y gestionar tickets' },
  { id: 'comentarios', label: 'Comentarios', icon: MessageSquare, description: 'Enviar feedback' },
  { id: 'clientes', label: 'Clientes', icon: Users, description: 'Gestionar clientes' },
  { id: 'categorias', label: 'Categorias', icon: Settings, description: 'Administrar categorias NLP' },
];

const responses: Record<string, { text: string; options?: { label: string; action: string }[] }> = {
  dashboard: {
    text: 'El Dashboard muestra un resumen de tu actividad. Como usuario ves tus solicitudes y comentarios. Como admin ves metricas globales, graficos de tiempos de atencion y distribucion de categorias NLP.',
    options: [
      { label: 'Ver Dashboard', action: 'go:/ ' },
      { label: 'Volver al menu', action: 'menu' },
    ],
  },
  solicitudes: {
    text: 'Las Solicitudes son tickets formales de atencion. Puedes crear una nueva solicitud desde el boton "+ Nueva Solicitud". El admin puede cambiar el estado (Pendiente, En Proceso, Resuelto).',
    options: [
      { label: 'Crear solicitud', action: 'go:/solicitudes' },
      { label: 'Volver al menu', action: 'menu' },
    ],
  },
  comentarios: {
    text: 'Los Comentarios son para dejar tu opinion o feedback. El sistema analiza automaticamente el sentimiento (positivo/negativo) y lo clasifica en categorias como VENTAS, SOPORTE, RECLAMO, etc.',
    options: [
      { label: 'Escribir comentario', action: 'go:/comentarios' },
      { label: 'Volver al menu', action: 'menu' },
    ],
  },
  clientes: {
    text: 'La seccion de Clientes permite gestionar los registros de empresas y personas. El admin puede crear, editar y desactivar clientes. Los usuarios solo ven su propio perfil.',
    options: [
      { label: 'Ver clientes', action: 'go:/clientes' },
      { label: 'Volver al menu', action: 'menu' },
    ],
  },
  categorias: {
    text: 'Las Categorias NLP son creadas por el admin para clasificar comentarios. Ejemplos: VENTAS, SOPORTE, RECLAMO, FELICITACION, CONSULTA. El sistema usa estas categorias para analizar automaticamente los comentarios.',
    options: [
      { label: 'Ver categorias', action: 'go:/categorias' },
      { label: 'Volver al menu', action: 'menu' },
    ],
  },
  inicio: {
    text: 'Bienvenido a BADI Corp! Tu plataforma de analisis inteligente. Puedes navegar por el menu lateral para acceder a todas las funcionalidades.',
    options: [
      { label: 'Ir al Dashboard', action: 'go:/ ' },
      { label: 'Volver al menu', action: 'menu' },
    ],
  },
  ayuda: {
    text: 'Puedo ayudarte a entender como funciona el sistema. Selecciona un tema del menu o pregunta directamente.',
    options: topics.map((t) => ({ label: t.label, action: t.id })),
  },
  default: {
    text: 'No estoy seguro de entender. Puedo explicarte sobre: Dashboard, Solicitudes, Comentarios, Clientes o Categorias. Selecciona un tema del menu.',
    options: topics.map((t) => ({ label: t.label, action: t.id })),
  },
};

export const TinoBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 1,
          text: 'Hola! Soy TINO BOT, tu asistente virtual de BADI Corp. Puedo ayudarte a entender como funciona el sistema. Que tema te interesa?',
          sender: 'bot',
          timestamp: new Date(),
          options: topics.map((t) => ({ label: t.label, action: t.id })),
        },
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleOption = (action: string) => {
    if (action === 'menu') {
      setShowMenu(true);
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), text: 'Que otro tema te interesa?', sender: 'bot', timestamp: new Date(), options: topics.map((t) => ({ label: t.label, action: t.id })) },
      ]);
      return;
    }

    if (action.startsWith('go:')) {
      window.location.href = action.slice(3);
      return;
    }

    const response = responses[action] || responses.default;
    setShowMenu(false);
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), text: response.text, sender: 'bot', timestamp: new Date(), options: response.options },
    ]);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now(), text: input, sender: 'user', timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    const lower = input.toLowerCase();
    let responseKey = 'default';
    if (lower.includes('dashboard') || lower.includes('inicio') || lower.includes('panel')) responseKey = 'dashboard';
    else if (lower.includes('solicitud') || lower.includes('ticket')) responseKey = 'solicitudes';
    else if (lower.includes('comentario') || lower.includes('opinion') || lower.includes('feedback')) responseKey = 'comentarios';
    else if (lower.includes('cliente') || lower.includes('empresa')) responseKey = 'clientes';
    else if (lower.includes('categor') || lower.includes('nlp') || lower.includes('analisis')) responseKey = 'categorias';
    else if (lower.includes('ayuda') || lower.includes('help') || lower.includes('como')) responseKey = 'ayuda';

    setTimeout(() => {
      const response = responses[responseKey];
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), text: response.text, sender: 'bot', timestamp: new Date(), options: response.options },
      ]);
    }, 500);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center hover:shadow-blue-600/50 transition-all hover:scale-110 active:scale-95"
      >
        {isOpen ? <X size={24} /> : <Bot size={24} />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[500px] bg-white rounded-2xl shadow-2xl shadow-slate-200/50 border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">TINO BOT</h3>
              <p className="text-blue-100 text-xs">Asistente virtual BADI Corp</p>
            </div>
            <span className="ml-auto w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.sender === 'user' ? 'order-2' : ''}`}>
                  <div className={`flex items-end gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-blue-600' : 'bg-slate-200'}`}>
                      {msg.sender === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-slate-600" />}
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                  {msg.options && msg.sender === 'bot' && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
                      {msg.options.map((opt) => (
                        <button
                          key={opt.action}
                          onClick={() => handleOption(opt.action)}
                          className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 text-xs font-medium rounded-full hover:bg-blue-50 hover:border-blue-300 transition-all"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-slate-200 bg-white">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Escribe tu pregunta..."
                className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TinoBot;
