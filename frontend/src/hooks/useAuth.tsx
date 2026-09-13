import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase, auth } from '../services/supabase';

export type UserRole = 'admin' | 'analista' | 'supervisor' | 'usuario' | 'ADMIN' | 'ANALISTA' | 'SUPERVISOR' | 'USUARIO';

export interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  activo: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isAnalyst: boolean;
  registerUser: (data: { nombre: string; email: string; password: string; rol?: UserRole }) => Promise<{ success: boolean; message?: string }>;
  loginUser: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateUser: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function hasAdminAccess(rol: string): boolean {
  const r = rol.toLowerCase();
  return r === 'admin' || r === 'analista' || r === 'supervisor';
}

function hasAnalystAccess(rol: string): boolean {
  const r = rol.toLowerCase();
  return r === 'admin' || r === 'analista';
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session } } = await auth.getSession();
        if (session?.user?.email) {
          const email = session.user.email.toLowerCase();
          const { data: profile } = await supabase
            .from('usuarios')
            .select('id, nombre, email, rol, activo')
            .eq('email', email)
            .maybeSingle();

          if (profile) {
            setUser({
              id: String(profile.id),
              nombre: profile.nombre || email.split('@')[0],
              email,
              rol: (profile.rol as UserRole) || 'usuario',
              activo: profile.activo ?? true,
            });
          } else {
            setUser({
              id: session.user.id,
              nombre: session.user.user_metadata?.nombre || email.split('@')[0],
              email,
              rol: 'usuario',
              activo: true,
            });
          }
        }
      } catch (err) {
        console.warn('Session init error:', err);
      } finally {
        setLoading(false);
      }
    };
    initSession();

    const { data: { subscription } } = auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email) {
        const email = session.user.email.toLowerCase();
        const { data: profile } = await supabase
          .from('usuarios')
          .select('id, nombre, email, rol, activo')
          .eq('email', email)
          .maybeSingle();

        if (profile) {
          setUser({
            id: String(profile.id),
            nombre: profile.nombre || email.split('@')[0],
            email,
            rol: (profile.rol as UserRole) || 'usuario',
            activo: profile.activo ?? true,
          });
        }
      } else {
        setUser(null);
      }
    });

    return () => { subscription?.unsubscribe(); };
  }, []);

  const registerUser = useCallback(async (data: { nombre: string; email: string; password: string; rol?: UserRole }) => {
    const cleanEmail = data.email.trim().toLowerCase();
    const rolAsignado = data.rol ? data.rol.toUpperCase() : 'USUARIO';

    const { error: authError } = await auth.signUp({
      email: cleanEmail,
      password: data.password,
      options: { data: { nombre: data.nombre.trim(), rol: rolAsignado } },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return { success: false, message: 'Este correo ya está registrado.' };
      }
      return { success: false, message: authError.message };
    }

    const { error: dbError } = await supabase.from('usuarios').insert({
      nombre: data.nombre.trim(),
      email: cleanEmail,
      password_hash: 'auth_managed',
      rol: rolAsignado,
      activo: true,
    });

    if (dbError) {
      console.warn('DB insert warning:', dbError.message);
    }

    return { success: true };
  }, []);

  const loginUser = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();

    const { error: authError } = await auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (authError) {
      return { success: false, message: 'Correo o contraseña incorrectos.' };
    }

    const { data: profile } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, activo')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (!profile) {
      await auth.signOut();
      return { success: false, message: 'No se encontró el perfil de usuario. Regístrate primero.' };
    }

    if (!profile.activo) {
      await auth.signOut();
      return { success: false, message: 'Tu cuenta está desactivada. Contacta al administrador.' };
    }

    setUser({
      id: String(profile.id),
      nombre: profile.nombre || cleanEmail.split('@')[0],
      email: cleanEmail,
      rol: (profile.rol as UserRole) || 'usuario',
      activo: true,
    });

    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    try { await auth.signOut(); } catch {}
    setUser(null);
  }, []);

  const updateUser = useCallback(async (data: Partial<UserProfile>) => {
    if (!user) return;
    const updates: Record<string, unknown> = {};
    if (data.nombre) updates.nombre = data.nombre;
    if (data.rol) updates.rol = data.rol;
    if (data.activo !== undefined) updates.activo = data.activo;
    updates.updated_at = new Date().toISOString();

    await supabase.from('usuarios').update(updates).eq('email', user.email);
    setUser({ ...user, ...data });
  }, [user]);

  const isAdmin = user ? hasAdminAccess(user.rol) : false;
  const isAnalyst = user ? hasAnalystAccess(user.rol) : false;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isAnalyst, registerUser, loginUser, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
