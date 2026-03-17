import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client for frontend (uses anon key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for backend API routes (uses service role key, bypasses RLS)
// Use this for server-side operations that need to bypass Row-Level Security
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
