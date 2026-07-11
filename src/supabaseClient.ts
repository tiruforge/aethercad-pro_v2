// @ts-nocheck
// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase configuration keys are missing. " +
    "Please check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in your .env file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);