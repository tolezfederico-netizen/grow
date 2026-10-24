import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    "[Grow] Falta VITE_SUPABASE_URL en las variables de entorno. " +
      "Creá un archivo .env.local en client/ y admin/ con este valor.",
  );
}
if (!supabaseAnonKey) {
  throw new Error(
    "[Grow] Falta VITE_SUPABASE_ANON_KEY en las variables de entorno. " +
      "Creá un archivo .env.local en client/ y admin/ con este valor.",
  );
}

/** URL del proyecto de Supabase de esta instancia (para validar URLs propias). */
export const SUPABASE_URL: string = supabaseUrl;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
