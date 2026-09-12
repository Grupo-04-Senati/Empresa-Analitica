import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'https://empresa-analitica.onrender.com';

function sanitizeHeader(s: string): string {
  return s.replace(/[^\x00-\x7F]/g, '');
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  };
  
  if (token) {
    headers['Authorization'] = sanitizeHeader(`Bearer ${token}`);
  }

  const sanitizedHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    sanitizedHeaders[sanitizeHeader(k)] = sanitizeHeader(v);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: sanitizedHeaders,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, `Error ${res.status}: ${errorText}`);
  }

  return res.json();
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'GET' });
}

export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function apiPut<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'DELETE' });
}
