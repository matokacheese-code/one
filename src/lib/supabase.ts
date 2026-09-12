import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isConfigured = Boolean(url && key);
export const supabase = createClient(url || "https://placeholder.invalid", key || "placeholder", {
  auth: { persistSession: false, autoRefreshToken: false },
});
