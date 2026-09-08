import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
}

function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.headers) {
    const sanitized: Record<string, string> = {};
    const src = init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : (typeof init.headers === 'object' ? init.headers as Record<string, string> : {});
    for (const [k, v] of Object.entries(src)) {
      const safeKey = k.replace(/[^\x20-\x7E]/g, '_');
      const safeVal = (v as string).replace(/[^\x20-\x7E]/g, '_');
      sanitized[safeKey] = safeVal;
    }
    init = { ...init, headers: sanitized };
  }
  return window.fetch(input, init);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    fetch: safeFetch,
  },
});
export const auth = supabase.auth;
