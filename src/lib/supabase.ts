import { createClient } from "@supabase/supabase-js";
import type { ProfileRow } from "../types/portfolio";

// ---------------------------------------------------------------------------
// Supabase client — singleton pattern para evitar múltiples conexiones
// Env vars inyectadas por Vite: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// ---------------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "[PortfolioPro] Missing Supabase env vars.\n" +
      "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file."
  );
}

// Database type — extiende con más tablas si el schema crece
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "updated_at">;
        Update: Partial<ProfileRow>;
      };
    };
  };
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
