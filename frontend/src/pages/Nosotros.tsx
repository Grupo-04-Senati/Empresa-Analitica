import { BarChart3, Shield, Brain, Users, Target, Heart, Lightbulb, Handshake } from 'lucide-react';

export default function Nosotros() {
  const equipo = [
    { nombre: 'Diego Luna', rol: 'Infraestructura', desc: 'Configuracion del servidor, despliegue en la nube, administracion de bases de datos y mantenimiento de la plataforma.', icon: Shield },
    { nombre: 'Deivyd Vidal', rol: 'Backend', desc: 'Logica del servidor, autenticacion de usuarios, seguridad de datos y desarrollo de endpoints protegidos.', icon: Brain },
    { nombre: 'Diego Carlin', rol: 'Frontend', desc: 'Interfaz de usuario, componentes React, diseno visual responsivo y experiencia de usuario.', icon: BarChart3 },
    { nombre: 'Tinoco Leon', rol: 'Soporte', desc: 'Soporte tecnico, resolucion de problemas, documentacion tecnica y pruebas de calidad.', icon: Users },
    { nombre: 'Ronal de la Cruz', rol: 'Backend', desc: 'Desarrollo de funcionalidades backend, integracion de servicios externos y optimizacion de rendimiento.', icon: Brain },
  ];

  const valores = [
    { icon: Lightbulb, title: 'Innovacion Tecnologica', desc: 'Utilizamos inteligencia artificial, procesamiento de lenguaje natural (NLP) y reconocimiento facial para revolucionar la atencion al cliente.' },
    { icon: Handshake, title: 'Trabajo en Equipo', desc: 'Trabajamos de forma colaborativa como equipo multidisciplinario, combinando habilidades en servidor, backend, frontend y soporte tecnico.' },
    { icon: Heart, title: 'Accesibilidad Total', desc: 'Creemos que la analitica empresarial debe ser accesible para todos. Nuestra plataforma es intuitiva y profesional.' },
    { icon: Target, title: 'Calidad y Seguridad', desc: 'Nos comprometemos a mantener estandares altos de calidad en codigo, diseno y experiencia de usuario, garantizando la seguridad de los datos.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-[#0a0e1a] to-[#111827] text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Quienes Somos</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Somos un equipo de 5 estudiantes de la SENATI, dedicados al desarrollo de software y el analisis de datos aplicado a la atencion al cliente.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Nuestra Mision</h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                Democratizar la atencion al cliente mediante herramientas de inteligencia artificial accesibles y profesionales. Nuestra plataforma de Call Center Inteligente permite a cualquier empresa analizar comentarios, detectar el sentimiento de sus clientes y clasificar automaticamente las consultas para una gestion mas eficiente.
              </p>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Nuestra Vision</h2>
              <p className="text-slate-600 leading-relaxed">
                Ser la plataforma de referencia en Latinoamerica para la gestion inteligente de call centers, ofreciendo herramientas gratuitas basadas en IA que permitan a las empresas entender y mejorar la experiencia de sus clientes en tiempo real.
              </p>
            </div>
            <div className="flex justify-center">
              <img src="/img/j.jpeg" alt="BADI Corp - Equipo" className="rounded-2xl shadow-lg max-h-80 object-cover" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Nuestros Valores</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-16">
          {valores.map((v, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <v.icon size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">{v.title}</h3>
                <p className="text-sm text-slate-500">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Nuestro Proceso de Desarrollo</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-16">
          {[
            { fase: 'Investigacion', desc: 'Analizamos las necesidades de las empresas de call center y las herramientas de IA disponibles para la clasificacion automatica de comentarios.' },
            { fase: 'Diseno y Arquitectura', desc: 'Disenamos la arquitectura del sistema, seleccionamos React, FastAPI, Supabase y NLTK para el procesamiento de lenguaje natural.' },
            { fase: 'Desarrollo', desc: 'Implementamos el frontend con React y TypeScript, el backend con FastAPI, integramos MediaPipe para reconocimiento facial y NLTK para NLP.' },
            { fase: 'Pruebas y Despliegue', desc: 'Realizamos pruebas exhaustivas, optimizamos el rendimiento y desplegamos en Vercel y Render para disponibilidad 24/7.' },
          ].map((p, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
              <h3 className="font-semibold text-slate-800 mb-2">{p.fase}</h3>
              <p className="text-sm text-slate-500">{p.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Integrantes del Equipo</h2>
        <p className="text-slate-500 text-center mb-8 max-w-xl mx-auto">Cada miembro aporto habilidades unicas al proyecto. Juntos, combinamos experiencia en infraestructura, backend, frontend, soporte y optimizacion.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {equipo.map((m, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 text-center hover:shadow-md transition">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <m.icon size={22} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-800">{m.nombre}</h3>
              <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-2">{m.rol}</p>
              <p className="text-sm text-slate-500">{m.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-center text-white">
          <h3 className="font-semibold text-lg mb-2">Tienes preguntas o sugerencias?</h3>
          <p className="text-blue-100 text-sm mb-4">Contactanos y te ayudaremos con lo que necesites.</p>
          <a href="mailto:equipo@badi-corp.com" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition">
            Contactanos
          </a>
        </div>
      </div>
    </div>
  );
}
