import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://poikhicityheikmnfltb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sFwL6DfMfZ307T93i_Pr4w_22ZAiTl1';

function cleanStr(s: string): string {
  return s.replace(/[^\x00-\x7F]/g, '');
}

export const supabase = createClient(cleanStr(SUPABASE_URL), cleanStr(SUPABASE_KEY));
export const auth = supabase.auth;
