import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Shield, Brain, MessageSquare, Users, HelpCircle, ChevronRight, Star } from 'lucide-react';

function Particles({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement> }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 160, 255, ${p.alpha})`;
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(100, 160, 255, ${0.08 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [canvasRef]);

  return null;
}

export default function Landing() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const features = [
    { icon: Brain, title: 'Procesamiento NLP', desc: 'Analisis de sentimiento y categorizacion automatica de comentarios' },
    { icon: Shield, title: 'Seguridad Empresarial', desc: 'Autenticacion segura con Supabase Auth y reconocimiento facial' },
    { icon: BarChart3, title: 'Metricas en Tiempo Real', desc: 'Dashboards interactivos y reportes automaticos' },
  ];

  const sections = [
    { icon: Users, label: 'Quienes Somos', desc: 'Conoce a nuestro grupo', path: '/nosotros' },
    { icon: MessageSquare, label: 'Comentarios', desc: 'Dejanos tu feedback', path: '/comentarios' },
    { icon: HelpCircle, label: 'FAQ', desc: 'Preguntas frecuentes', path: '/faq-public' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white relative overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <Particles canvasRef={canvasRef} />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide">NEXUS Corp</h1>
              <p className="text-[10px] text-blue-300 tracking-widest uppercase">Analitica & Desarrollo</p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 max-w-6xl mx-auto w-full">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-2">
              Centro Inteligente de
            </h2>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
              <span className="text-blue-400">Analisis y Gestion</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 max-w-lg">
              Potencia tu empresa con inteligencia artificial, analisis de sentimiento y metricas en tiempo real.
            </p>

            <div className="space-y-5 mb-12">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <f.icon size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{f.title}</h3>
                    <p className="text-sm text-slate-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <div className="fixed right-6 bottom-6 flex flex-col gap-3 z-20 items-end">
          <button onClick={() => navigate('/login')} className="group flex items-center gap-3 bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-500/30 transition-all duration-300 overflow-hidden">
            <span className="max-w-0 group-hover:max-w-[160px] overflow-hidden whitespace-nowrap text-sm font-semibold text-white transition-all duration-300 ease-out pl-0 group-hover:pl-5">Register/Login</span>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Users size={18} />
            </div>
          </button>
          {sections.map((s, i) => (
            <button key={i} onClick={() => navigate(s.path)} className="group flex items-center gap-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-blue-500/50 rounded-full shadow-lg transition-all duration-300 overflow-hidden">
              <span className="max-w-0 group-hover:max-w-[140px] overflow-hidden whitespace-nowrap text-xs text-slate-300 group-hover:text-white transition-all duration-300 ease-out pl-0 group-hover:pl-4">{s.label}</span>
              <div className="w-10 h-10 bg-slate-700 group-hover:bg-blue-600/30 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-all duration-300">
                <s.icon size={16} className="text-slate-300 group-hover:text-blue-300" />
              </div>
            </button>
          ))}
        </div>

        <footer className="px-8 py-4 text-center text-xs text-slate-600">
          &copy; 2026 NEXUS Corp. Todos los derechos reservados.
        </footer>
      </div>
    </div>
  );
}
