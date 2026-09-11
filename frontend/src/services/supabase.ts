import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://poikhicityheikmnfltb.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvaWtoaWNpdHloZWlrbW5mbHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTA3NDksImV4cCI6MjEwNDA2Njc0OX0.HfFPfnz6lt4stW-54lStWOKWy2imYWfwQXOWumjjWTY';

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
