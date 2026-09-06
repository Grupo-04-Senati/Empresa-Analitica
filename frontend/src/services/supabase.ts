import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://poikhicityheikmnfltb.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_sFwL6DfMfZ307T93i_Pr4w_22ZAiTl1';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const auth = supabase.auth;
