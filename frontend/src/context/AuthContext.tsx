import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  isCliente: boolean;
  canEdit: boolean;
  registerUser: (data: { nombre: string; email: string; password: string; rol?: UserRole }) => Promise<{ success: boolean; message?: string; userId?: number }>;
  loginUser: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginByUserId: (userId: number) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateUser: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isAdminRole(rol: string): boolean {
  const r = rol.toLowerCase();
  return r === 'admin' || r === 'analista' || r === 'supervisor';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const registeringRef = useRef(false);

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
            const activeProfile: UserProfile = {
              id: String(profile.id),
              nombre: profile.nombre || email.split('@')[0],
              email,
              rol: (profile.rol as UserRole) || 'usuario',
              activo: profile.activo ?? true,
            };
            setUser(activeProfile);
          } else {
            const activeProfile: UserProfile = {
              id: session.user.id,
              nombre: session.user.user_metadata?.nombre || email.split('@')[0],
              email,
              rol: 'usuario',
              activo: true,
            };
            setUser(activeProfile);
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
      if (registeringRef.current) return;
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

    registeringRef.current = true;

    const existingUser = await supabase.from('usuarios').select('id').eq('email', cleanEmail).maybeSingle();

    const { error: authError } = await auth.signUp({
      email: cleanEmail,
      password: data.password,
      options: { data: { nombre: data.nombre.trim(), rol: rolAsignado } },
    });

    if (authError && !authError.message.includes('already registered')) {
      registeringRef.current = false;
      return { success: false, message: authError.message };
    }

    if (existingUser.data) {
      await auth.signOut();
      registeringRef.current = false;
      return { success: true, userId: existingUser.data.id };
    }

    const { data: dbData, error: dbError } = await supabase.from('usuarios').insert({
      nombre: data.nombre.trim(),
      email: cleanEmail,
      password_hash: 'auth_managed',
      rol: rolAsignado,
      activo: true,
    }).select('id').single();

    if (dbError) {
      console.error('DB insert error:', dbError.message);
      await auth.signOut();
      registeringRef.current = false;
      return { success: false, message: 'Error al crear perfil: ' + dbError.message };
    }

    await auth.signOut();
    registeringRef.current = false;

    return { success: true, userId: dbData.id };
  }, []);

  const loginUser = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();

    const { data: authData, error: authError } = await auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (authError) {
      return { success: false, message: 'Correo o contraseña incorrectos.' };
    }

    let { data: profile } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, activo')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (!profile) {
      const nombre = authData.user?.user_metadata?.nombre || cleanEmail.split('@')[0];
      const { data: newProfile, error: insertErr } = await supabase
        .from('usuarios')
        .insert({
          nombre,
          email: cleanEmail,
          password_hash: 'auth_managed',
          rol: 'USUARIO',
          activo: true,
        })
        .select('id, nombre, email, rol, activo')
        .maybeSingle();

      if (insertErr) {
        console.error('Error creando perfil:', insertErr);
        await auth.signOut();
        return { success: false, message: 'Error al crear perfil: ' + insertErr.message };
      }
      profile = newProfile;
    }

    if (!profile) {
      await auth.signOut();
      return { success: false, message: 'No se pudo crear el perfil.' };
    }

    if (!profile.activo) {
      await auth.signOut();
      return { success: false, message: 'Tu cuenta está desactivada. Contacta al administrador.' };
    }

    const userProfile: UserProfile = {
      id: String(profile.id),
      nombre: profile.nombre || cleanEmail.split('@')[0],
      email: cleanEmail,
      rol: (profile.rol as UserRole) || 'usuario',
      activo: true,
    };

    setUser(userProfile);
    return { success: true };
  }, []);

  const loginByUserId = useCallback(async (userId: number) => {
    const { data: profile } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, activo')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    if (!profile.activo) {
      return { success: false, message: 'Tu cuenta esta desactivada. Contacta al administrador.' };
    }

    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const isDev = import.meta.env.DEV;
      const apiBase = isDev ? '' : API_BASE;

      const res = await fetch(`${apiBase}/api/auth/face-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Face login backend error:', errorData);
        const userProfile: UserProfile = {
          id: String(profile.id),
          nombre: profile.nombre || profile.email.split('@')[0],
          email: profile.email.toLowerCase(),
          rol: (profile.rol as UserRole) || 'usuario',
          activo: true,
        };
        setUser(userProfile);
        return { success: true };
      }

      const data = await res.json();
      if (data.action_link) {
        window.location.href = data.action_link;
        return { success: true, message: 'Iniciando sesion...' };
      }

      const userProfile: UserProfile = {
        id: String(profile.id),
        nombre: profile.nombre || profile.email.split('@')[0],
        email: profile.email.toLowerCase(),
        rol: (profile.rol as UserRole) || 'usuario',
        activo: true,
      };
      setUser(userProfile);
      return { success: true };
    } catch (err) {
      console.warn('Face login fallback:', err);
      const userProfile: UserProfile = {
        id: String(profile.id),
        nombre: profile.nombre || profile.email.split('@')[0],
        email: profile.email.toLowerCase(),
        rol: (profile.rol as UserRole) || 'usuario',
        activo: true,
      };
      setUser(userProfile);
      return { success: true };
    }
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
    const newUser = { ...user, ...data };
    setUser(newUser);
  }, [user]);

  const isAdmin = user ? isAdminRole(user.rol) : false;
  const isCliente = user ? !isAdminRole(user.rol) : false;
  const canEdit = isAdmin;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isCliente, canEdit, registerUser, loginUser, loginByUserId, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
