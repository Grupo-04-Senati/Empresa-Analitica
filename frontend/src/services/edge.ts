import { supabase } from './supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

export async function edgeFunction<T>(name: string, body?: unknown): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Edge Function error ${res.status}: ${err}`);
  }
  return res.json();
}
