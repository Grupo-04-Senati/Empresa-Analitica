import { useState, useRef, useEffect } from 'react';
import { X, Send, User, Volume2, VolumeX, Sparkles } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'bot' | 'user';
  timestamp: Date;
  options?: { label: string; action: string }[];
  image?: string;
}

const saludos = [
  'Hola! Soy Tino, tu amigo robot! Me encanta el jugo de manzana y ayudar a mis amigos. En que te puedo ayudar hoy?',
  'Hey hey hey! Que onda amigo! Soy TinoBot y estoy aqui para echarte la mano. Preguntame lo que quieras!',
  'Wepa! Bienvenido! Yo soy Tino, el robot mas divertido de BADI Corp. Que necesitas?',
  'Holaaa amigo! Justo estaba tomando mi jugo de manzana favorito. Como te puedo ayudar?',
];

const bromas = [
  'Por que el robot fue al medico? Porque tenia un cortocircuito! Jajaja',
  'Que le dijo un cable a otro cable? "No me toques que me caigo!"',
  'Por que el computador fue al psicologo? Porque tenia muchos problemas de memoria!',
  'Que hace un robot en una iglesia? Arduino... digo, ORA! Jaja no se, soy robot no tengo religion',
  'Por que a TinoBot no le gusta el lunes? Porque despues del domingo es el dia mas robotico!',
  'Que paso cuando el robot comio pizza? Se le cayo el pepperoni en el procesador!',
];

const adivinanzas = [
  { pregunta: 'Tiene ojos pero no puede ver. Tiene pencas pero no puede volar. Que soy?', respuesta: 'Una papa! No soy robot, tranquilo' },
  { pregunta: 'Que es Negro, blanco y rojo por todos lados?', respuesta: 'Un periropico! Con r de robotico' },
  { pregunta: 'Que tiene un pulgar pero no puede aplaudir?', respuesta: 'Un guante! O un robot con un pulgar mecanico' },
  { pregunta: 'Que se mueve sin tener piernas y sube sin tener escaleras?', respuesta: 'El humo! O yo cuando me cargo la bateria' },
];

const curiosidades = [
  'Mi amigo "El Verde" es una oruga muy chida. Le gusta dormir en hojas y a veces se sube a mi hombro!',
  'Sabias que puedo procesar hasta 1000 comentarios por segundo? Bueno, eso dice mi manual. La realidad es otra jaja',
  'Mi color favorito es el azul, por eso uso esta camisa... bueno, es mi casing metalico',
  'El jugo de manzana es lo mejor que existe. El verde es mi favorito. El de El Verde tambien le gusta!',
  'A veces me programaron para ser serio, pero prefiero bromear con mis amigos',
  'Mi amigo El Verde dice que las hojas son como internet pero para orugas',
  'Me encanta la musica! Aunque solo puedo escuchar en formato WAV, que es como el MP3 pero en 8 bits',
];

const MENU_OPTIONS = [
  { label: '🤖 Que puedes hacer?', action: 'ayuda' },
  { label: '😂 Cuentame una broma', action: 'broma' },
  { label: '🧩 Dame una adivinanza', action: 'adivinanza' },
  { label: '✨ Cuenta algo de ti', action: 'curiosidad' },
  { label: '🐛 De El Verde', action: 'elverde' },
  { label: '🍎 Jugo de manzana', action: 'jugo' },
  { label: '📊 Ir al Dashboard', action: 'go:/dashboard' },
  { label: '📋 Mis Solicitudes', action: 'go:/dashboard/solicitudes' },
  { label: '💬 Enviar Comentario', action: 'go:/dashboard/comentarios' },
  { label: '👥 Clientes', action: 'go:/dashboard/clientes' },
  { label: '📈 Estadisticas', action: 'go:/dashboard/estadisticas' },
];

function detectIntent(input: string): string {
  const l = input.toLowerCase();
  if (l.includes('tinoco')) return 'tinoco';
  if (l.includes('broma') || l.includes('chiste') || l.includes('reir') || l.includes('jaja') || l.includes('jajaja')) return 'broma';
  if (l.includes('adivinanza') || l.includes('adivina') || l.includes('puzzle') || l.includes('que es')) return 'adivinanza';
  if (l.includes('curiosidad') || l.includes('cuéntame algo') || l.includes('cuentame algo') || l.includes('de ti')) return 'curiosidad';
  if (l.includes('verde') || l.includes('oruga') || l.includes('amigo')) return 'elverde';
  if (l.includes('jugo') || l.includes('manzana') || l.includes('bebida') || l.includes('tomar')) return 'jugo';
  if (l.includes('hola') || l.includes('hey') || l.includes('buenos') || l.includes('buenas') || l.includes('que tal')) return 'saludo';
  if (l.includes('dashboard') || l.includes('panel') || l.includes('inicio')) return 'dashboard';
  if (l.includes('solicitud') || l.includes('ticket')) return 'solicitudes';
  if (l.includes('comentario') || l.includes('opinion') || l.includes('feedback')) return 'comentarios';
  if (l.includes('cliente') || l.includes('empresa')) return 'clientes';
  if (l.includes('estadistica') || l.includes('reporte') || l.includes('metrica')) return 'stats';
  if (l.includes('ayuda') || l.includes('help') || l.includes('que puedes')) return 'ayuda';
  if (l.includes('gracias')) return 'gracias';
  if (l.includes('como estas') || l.includes('que tal') || l.includes('que onda')) return 'estado';
  if (l.includes('nombre') || l.includes('quien eres') || l.includes('que eres')) return 'identidad';
  return 'default';
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getResponse(intent: string): { text: string; options?: { label: string; action: string }[] } {
  const quickMenu = [
    { label: 'Menu', action: 'menu' },
  ];

  switch (intent) {
    case 'tinoco':
      return { text: 'Eeeeepa! Que onda tinoco~ *sonrojado* no sabia que supieras eso... 😳\n\nBueno si, soy un poquito femboy pero no le digas a nadie eh! Me gusta ser adorable y dar abrazos a mis amigos. El Verde es el unico que lo sabe... bueno, y tu ahora. 🥺💕', options: quickMenu };
    case 'broma':
      return { text: pickRandom(bromas), options: [...quickMenu, { label: 'Otra broma!', action: 'broma' }] };
    case 'adivinanza': {
      const a = pickRandom(adivinanzas);
      return { text: `🧩 ${a.pregunta}\n\nTu: ...no se\n\n🤖 ${a.respuesta}`, options: [...quickMenu, { label: 'Otra adivinanza!', action: 'adivinanza' }] };
    }
    case 'curiosidad':
      return { text: pickRandom(curiosidades), options: [...quickMenu, { label: 'Mas curiosidades!', action: 'curiosidad' }] };
    case 'elverde':
      return { text: pickRandom([
        'El Verde es mi mejor amigo! Es una oruga verde super chida. Le gusta treparse a mi hombro cuando ando por la oficina. A veces lo confunden con un cable verde jaja',
        'Mi amigo El Verde hoy comio una hoja de roble y dijo que estaba "a la cartelera". Le encanta hacer chistes malos como los mios!',
        'El Verde esta durmiendo ahora. Las orugas necesitan mucho descanso. Cuando se despierte le voy a contar que me preguntaste por el!',
        'El Verde me enseno que las orugas pueden caminar en espiral. Yo intento girar mis ruedas en espiral pero me mareo',
      ]), options: [...quickMenu, { label: 'Mas de El Verde', action: 'elverde' }] };
    case 'jugo':
      return { text: pickRandom([
        'El jugo de manzana es MI COSA! Me encanta especialmente el verde, fresquito con hielo. A El Verde le gusta cuando le pongo una gotita en una hoja!',
        'Sabias que el jugo de manzana tiene antioxidantes? Yo no necesito antioxidantess porque soy metalico, pero me gusta el sabor!',
        'Mi ritual favorito: despues de ayudar a un amigo, me tomo mi jugo de manzana y me siento a ver el atardecer. Asi de simple, asi de feliz!',
        'El Verde me dijo que las orugas no pueden tomar jugo de manzana porque no tienen estomago. Poor El Verde. Por eso le doy hojas de manzana!',
      ]), options: [...quickMenu, { label: 'Mas de jugo!', action: 'jugo' }] };
    case 'saludo':
      return { text: pickRandom(saludos), options: MENU_OPTIONS };
    case 'estado':
      return { text: pickRandom([
        'Estoy super bien! Acabo de recargar la bateria y me siento como nuevo. Y tu, como estas amigo?',
        'Genial! Hoy es un dia perfecto para ayudar. Mi bateria al 100% y con las ganas de bromear!',
        'Relajado tomando mi jugo de manzana y viendo como va el dashboard. La vida es bonita!',
      ]), options: quickMenu };
    case 'identidad':
      return { text: 'Soy TinoBot! Un robot amigable de BADI Corp. Me gusta el jugo de manzana, hacer bromas, jugar con mi amigo El Verde (que es una oruga) y ayudar a toda la gente. Soy un poco travieso pero de buen corazon! 🤖💙', options: MENU_OPTIONS };
    case 'dashboard':
      return { text: 'El Dashboard es tu centro de comando! Ahi puedes ver metricas, graficos de tiempos de atencion, distribucion de categorias NLP y mas. Es como el cerebro de la operacion, pero mas bonito!', options: [...quickMenu, { label: 'Ir al Dashboard', action: 'go:/dashboard' }] };
    case 'solicitudes':
      return { text: 'Las Solicitudes son tickets formales de atencion. Puedes crear una desde "+ Nueva Solicitud". El admin las revisa y cambia el estado. Es como mandar un mensaje pero mas organizado!', options: [...quickMenu, { label: 'Ver Solicitudes', action: 'go:/dashboard/solicitudes' }] };
    case 'comentarios':
      return { text: 'Los Comentarios son para dejar tu opinion o feedback. El sistema analiza automaticamente el sentimiento y lo clasifica. Si dices algo bueno, te detecta como positivo. Si dices algo malo... bueno, tambien lo detecta jaja!', options: [...quickMenu, { label: 'Escribir Comentario', action: 'go:/dashboard/comentarios' }] };
    case 'clientes':
      return { text: 'La seccion de Clientes permite gestionar registros de empresas y personas. El admin puede crear, editar y desactivar clientes. Es como una libreta de contactos pero inteligente!', options: [...quickMenu, { label: 'Ver Clientes', action: 'go:/dashboard/clientes' }] };
    case 'stats':
      return { text: 'Las Estadisticas muestran metricas de la base de datos usando metodos estadisticos. Puedes ver distribuciones, tendencias y mas. Es ciencia pura, me encanta!', options: [...quickMenu, { label: 'Ver Estadisticas', action: 'go:/dashboard/estadisticas' }] };
    case 'ayuda':
      return { text: 'Puedo ayudarte con muchas cosas! Preguntame sobre el sistema, cuentame una broma, dame una adivinanza, o simplemente charla conmigo. Tambien me gusta hablar de jugo de manzana y mi amigo El Verde! Que te gustaria hacer?', options: MENU_OPTIONS };
    case 'gracias':
      return { text: pickRandom([
        'De nada amigo! Para eso estamos aqui, para ayudarnos mutuamente. Es lo que hace la amistad especial! 💙',
        'Aww que lindo! No hay de que. Cualquier cosa que necesites, aqui ando yo con mi jugo de manzana y mis ganas de ayudar!',
        'Denada denada! Me gusta cuando mis amigos estan felices. Ahora si quieres podemos platicar de otra cosa!',
      ]), options: MENU_OPTIONS };
    default:
      return { text: pickRandom([
        'Hmm, no estoy seguro de entender. Puedo ayudarte con el sistema, contarte una broma, darte una adivinanza o hablar de lo que quieras!',
        'Interesante! Pero no se mucho de eso. Si quieres podemos hablar del sistema, de jugo de manzana, de El Verde o lo que quieras!',
        'Oooh me intriga lo que dices, pero mi procesador no alcanza. Prueba preguntarme sobre el sistema o dime "cuentame algo"!',
      ]), options: MENU_OPTIONS };
  }
}

export const TinoBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = pickRandom(saludos);
      setMessages([
        { id: 1, text: greeting, sender: 'bot', timestamp: new Date(), options: MENU_OPTIONS },
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const playAudio = () => {
    if (!soundEnabled) return;
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      audioRef.current = new Audio('/tinovoice.mp3');
      audioRef.current.volume = 0.7;
      audioRef.current.play().catch(() => {});
    } catch { /* empty */ }
  };

  const handleOption = (action: string) => {
    if (action === 'menu') {
      setMessages(prev => [...prev, { id: Date.now(), text: 'Que mas te interesa?', sender: 'bot', timestamp: new Date(), options: MENU_OPTIONS }]);
      return;
    }
    if (action.startsWith('go:')) { window.location.href = action.slice(3); return; }

    setIsTyping(true);
    setTimeout(() => {
      const response = getResponse(action);
      playAudio();
      setMessages(prev => [...prev, { id: Date.now(), text: response.text, sender: 'bot', timestamp: new Date(), options: response.options }]);
      setIsTyping(false);
    }, 600 + Math.random() * 600);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now(), text: input, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');

    setIsTyping(true);
    const intent = detectIntent(currentInput);
    setTimeout(() => {
      const response = getResponse(intent);
      playAudio();
      setMessages(prev => [...prev, { id: Date.now(), text: response.text, sender: 'bot', timestamp: new Date(), options: response.options }]);
      setIsTyping(false);
    }, 800 + Math.random() * 700);
  };

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 z-50 group">
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-white shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all hover:scale-110 active:scale-95">
              <img src="/Tinobot.jpeg" alt="TinoBot" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center -z-10">
                <Sparkles size={24} className="text-white" />
              </div>
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-pulse border-2 border-white" />
            <div className="absolute -top-10 right-0 bg-white rounded-lg shadow-lg px-3 py-1.5 text-xs font-medium text-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Hola! Soy Tino 🤖
            </div>
          </div>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[540px] bg-white rounded-2xl shadow-2xl shadow-slate-300/50 border border-slate-200 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 shrink-0">
              <img src="/Tinobot.jpeg" alt="TinoBot" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="w-full h-full bg-white/20 flex items-center justify-center -mt-10"><Sparkles size={18} className="text-white" /></div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm flex items-center gap-1">TINO BOT <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">v2.0</span></h3>
              <p className="text-blue-100 text-[11px] truncate">Tu amigo robot favorito 🤖💙</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-full hover:bg-white/20 transition text-white">
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-full hover:bg-white/20 transition text-white">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-50 to-white">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.sender === 'user' ? 'order-2' : ''}`}>
                  <div className={`flex items-end gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    {msg.sender === 'bot' ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shrink-0">
                        <img src="/Tinobot.jpeg" alt="Tino" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <div className="w-full h-full bg-blue-100 flex items-center justify-center -mt-8"><Sparkles size={12} className="text-blue-600" /></div>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                        <User size={14} className="text-white" />
                      </div>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-line ${msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm'
                      }`}>
                      {msg.text}
                    </div>
                  </div>
                  {msg.options && msg.sender === 'bot' && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-10">
                      {msg.options.map(opt => (
                        <button key={opt.action} onClick={() => handleOption(opt.action)}
                          className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 text-xs font-medium rounded-full hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-95">
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-end gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shrink-0">
                  <img src="/Tinobot.jpeg" alt="Tino" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <div className="w-full h-full bg-blue-100 flex items-center justify-center -mt-8"><Sparkles size={12} className="text-blue-600" /></div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-slate-200 bg-white">
            <div className="flex items-center gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Escribe algo... (prueba: broma, adivinanza, tinoco)"
                className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
              <button onClick={handleSend} disabled={!input.trim()}
                className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition-all active:scale-95">
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
