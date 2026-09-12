import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/dashboard';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

import Landing from '../pages/Landing';
import ComentariosPublico from '../pages/ComentariosPublico';
import DashboardInicio from '../pages/dashboard';
import Clientes from '../pages/Clientes';
import ClientesNuevo from '../pages/ClientesNuevo';
import Auditoria from '../pages/Auditoria';
import AnalizarComentario from '../pages/AnalizarComentario';
import Categorias from '../pages/Categorias';
import Clasificacion from '../pages/Clasificacion';
import Estadisticas from '../pages/Estadisticas';
import ConfigCategorias from '../pages/ConfigCategorias';
import Comentarios from '../pages/Comentarios';
import Solicitudes from '../pages/Solicitudes';
import TiempoAtencion from '../pages/TiempoAtencion';
import PalabrasFrecuentes from '../pages/PalabrasFrecuentes';
import Interpolacion from '../pages/Interpolacion';
import Optimizacion from '../pages/Optimizacion';
import ReportesNLP from '../pages/ReportesNLP';
import ReportesEstadisticas from '../pages/ReportesEstadisticas';
import ReportesAtencion from '../pages/ReportesAtencion';
import Usuarios from '../pages/Usuarios';
import AdminUsuarios from '../pages/AdminUsuarios';
import Perfil from '../pages/Perfil';
import Login from '../pages/Login';
import { Register } from '../pages/Register';
import LimpiezaDatos from '../pages/LimpiezaDatos';
import Notificaciones from '../pages/Notificaciones';
import FAQ from '../pages/FAQ';

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50 flex-col gap-4"><Loader2 size={32} className="animate-spin text-blue-600" /><p className="text-slate-500 text-sm">Cargando...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const GuestGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50 flex-col gap-4"><Loader2 size={32} className="animate-spin text-blue-600" /><p className="text-slate-500 text-sm">Cargando...</p></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/comentarios" element={<ComentariosPublico />} />
    <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
    <Route path="/register" element={<GuestGuard><Register /></GuestGuard>} />
    <Route path="/perfil" element={<AuthGuard><Perfil /></AuthGuard>} />
    <Route path="/faq" element={<AuthGuard><FAQ /></AuthGuard>} />

    <Route path="/dashboard" element={<AuthGuard><DashboardLayout /></AuthGuard>}>
      <Route index element={<DashboardInicio />} />
      <Route path="clientes" element={<Clientes />} />
      <Route path="clientes/nuevo" element={<ClientesNuevo />} />
      <Route path="solicitudes" element={<Solicitudes />} />
      <Route path="comentarios" element={<Comentarios />} />
      <Route path="tiempo-atencion" element={<TiempoAtencion />} />
      <Route path="auditoria" element={<AdminGuard><Auditoria /></AdminGuard>} />
      <Route path="analizar-comentario" element={<AnalizarComentario />} />
      <Route path="palabras-frecuentes" element={<PalabrasFrecuentes />} />
      <Route path="categorias" element={<AdminGuard><Categorias /></AdminGuard>} />
      <Route path="clasificacion" element={<Clasificacion />} />
      <Route path="estadisticas" element={<Estadisticas />} />
      <Route path="interpolacion" element={<Interpolacion />} />
      <Route path="optimizacion" element={<Optimizacion />} />
      <Route path="reportes" element={<Navigate to="/dashboard/reportes/atencion" replace />} />
      <Route path="reportes/atencion" element={<ReportesAtencion />} />
      <Route path="reportes/nlp" element={<ReportesNLP />} />
      <Route path="reportes/estadisticas" element={<ReportesEstadisticas />} />
      <Route path="usuarios" element={<AdminGuard><Usuarios /></AdminGuard>} />
      <Route path="admin/usuarios" element={<AdminGuard><AdminUsuarios /></AdminGuard>} />
      <Route path="configuracion" element={<AdminGuard><ConfigCategorias /></AdminGuard>} />
      <Route path="limpieza-datos" element={<AdminGuard><LimpiezaDatos /></AdminGuard>} />
      <Route path="notificaciones" element={<AdminGuard><Notificaciones /></AdminGuard>} />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;
