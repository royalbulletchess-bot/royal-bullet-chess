import { createClient } from '@supabase/supabase-js';

// Service role client — ONLY use in API routes (server-side)
// This bypasses RLS policies and has full database access
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
