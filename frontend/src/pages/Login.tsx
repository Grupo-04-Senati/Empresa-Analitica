import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2, BrainCircuit, Shield, Zap, ArrowRight, Scan } from 'lucide-react';
import { FaceCapture } from '../components/FaceCapture';
import { hasAnyFaceRegistered } from '../services/faceRecognition';
import { faceApiCheckRegistered, faceApiHealth } from '../services/faceApi';

const Particles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: Math.random() * 2 + 1,
        o: Math.random() * 0.5 + 0.2,
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${p.o})`; ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.1 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { loginUser, loginByUserId } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFaceLogin, setShowFaceLogin] = useState(false);
  const [faceChecking, setFaceChecking] = useState(false);

  const handleFaceLogin = useCallback(async () => {
    setFaceChecking(true);
    setErrorMsg('');
    try {
      const backendOk = await faceApiHealth();
      if (!backendOk) {
        setErrorMsg('Servidor de reconocimiento facial no disponible. Usa email y contrasena.');
        setFaceChecking(false);
        return;
      }
      const count = await faceApiCheckRegistered();
      if (count === 0) {
        setErrorMsg('No hay usuarios con rostro registrado. Primero debes registrarte desde "Crear Cuenta".');
        setFaceChecking(false);
        return;
      }
      setShowFaceLogin(true);
    } catch {
      setErrorMsg('Error al verificar el servidor de reconocimiento.');
    } finally {
      setFaceChecking(false);
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor ingresa tu correo y contrasena.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Ingresa un correo electronico valido.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await loginUser(email.trim(), password);
      if (!res.success) {
        setErrorMsg(res.message || 'Error al iniciar sesion.');
      } else {
        navigate('/');
      }
    } catch {
      setErrorMsg('Error de conexion. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, loginUser, navigate]);

  const features = [
    { icon: <BrainCircuit size={20} />, title: 'Procesamiento NLP', desc: 'Analisis de sentimiento y categorizacion automatica' },
    { icon: <Shield size={20} />, title: 'Seguridad Empresarial', desc: 'Autenticacion segura con Supabase Auth' },
    { icon: <Zap size={20} />, title: 'Metricas en Tiempo Real', desc: 'Dashboards interactivos y reportes automaticos' },
  ];

  return (
    <div className="flex min-h-screen bg-white">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950">
        <Particles />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.12),transparent_60%)]" />
        <div className="relative z-10 flex flex-col justify-between w-full px-12 py-10">
          <div>
            <div className="flex items-center gap-3 mb-16">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg shadow-lg shadow-blue-500/25">N</div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">NEXUS Corp</h1>
                <span className="text-[11px] font-semibold tracking-[0.2em] text-blue-400 uppercase">Plataforma de Analisis</span>
              </div>
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-4">
              Centro Inteligente de<br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Analisis y Gestion</span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed max-w-md mb-12">
              Potencia tu empresa con inteligencia artificial, analisis de sentimiento y metricas en tiempo real.
            </p>
            <div className="space-y-5">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors shrink-0">{f.icon}</div>
                  <div>
                    <h4 className="text-white font-semibold text-sm">{f.title}</h4>
                    <p className="text-slate-400 text-sm">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-slate-500 text-xs">&copy; 2026 NEXUS Corp. Todos los derechos reservados.</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/25">N</div>
            <div>
              <h1 className="text-slate-800 font-bold leading-tight">NEXUS Corp</h1>
              <span className="text-[10px] font-semibold tracking-[0.2em] text-blue-500 uppercase">Plataforma de Analisis</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Bienvenido de Nuevo</h2>
            <p className="text-slate-500 text-sm">Inicia sesion para continuar</p>
          </div>

          <div className="space-y-3 mb-6">
            {errorMsg && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm animate-[fadeIn_0.3s_ease]">
                <AlertCircle size={16} className="shrink-0" /><span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm animate-[fadeIn_0.3s_ease]">
                <CheckCircle size={16} className="shrink-0" /><span>{successMsg}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo Electronico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                maxLength={200}
                autoComplete="email"
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contrasena</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres"
                  maxLength={128}
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl bg-white border border-slate-300 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><span>Iniciar Sesion</span><ArrowRight size={16} /></>}
            </button>
            <button
              type="button"
              onClick={handleFaceLogin}
              disabled={faceChecking}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50"
            >
              {faceChecking ? <Loader2 size={18} className="animate-spin" /> : <Scan size={18} />}
              <span>{faceChecking ? 'Verificando...' : 'Iniciar sesion con mi rostro'}</span>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            No tienes una cuenta?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">Registrate aqui</Link>
          </p>
          <p className="mt-4 text-center text-xs text-slate-400">
            Despues de registrarte, confirma tu email desde la bandeja de entrada.
          </p>
        </div>
      </div>

      {showFaceLogin && (
        <FaceCapture
          mode="login"
          onLoginMatch={async (userId, nombre) => {
            setShowFaceLogin(false);
            setIsLoading(true);
            try {
              const res = await loginByUserId(userId);
              if (res.success) {
                setSuccessMsg(`Bienvenido ${nombre}! Redirigiendo...`);
                setTimeout(() => navigate('/'), 1500);
              } else {
                setErrorMsg(res.message || 'Error al iniciar sesion con rostro.');
              }
            } catch {
              setErrorMsg('Error de conexion.');
            } finally {
              setIsLoading(false);
            }
          }}
          onClose={() => setShowFaceLogin(false)}
        />
      )}
    </div>
  );
};

export default Login;
