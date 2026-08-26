/**
 * Storage adapter.
 *
 * The whole app talks to storage through these two functions and nothing else.
 * That means moving from "saved in this browser" to "saved on a server the
 * whole team shares" is a change to THIS FILE ONLY — App.jsx never changes.
 *
 * Phase 1 (now):     localStorage — works offline, one browser, no login.
 * Phase 2 (later):   Supabase — shared data, real logins, roles.
 */

const MODE = import.meta.env.VITE_STORAGE_MODE || "local";

/* ---------------- Phase 1: localStorage ---------------- */
const local = {
  async get(key) {
    const value = window.localStorage.getItem(key);
    if (value === null) return null;
    return { key, value };
  },
  async set(key, value) {
    window.localStorage.setItem(key, value);
    return { key, value };
  },
  async remove(key) {
    window.localStorage.removeItem(key);
    return { key, deleted: true };
  },
};

/* ---------------- Phase 2: Supabase ----------------------
 * Uncomment after running `npm install @supabase/supabase-js`
 * and filling in .env. Keeps the exact same shape as above, so
 * flipping VITE_STORAGE_MODE=supabase is the only switch you flip.
 *
 * import { createClient } from "@supabase/supabase-js";
 *
 * const supabase = createClient(
 *   import.meta.env.VITE_SUPABASE_URL,
 *   import.meta.env.VITE_SUPABASE_ANON_KEY
 * );
 *
 * const remote = {
 *   async get(key) {
 *     const { data, error } = await supabase
 *       .from("app_state").select("value").eq("key", key).maybeSingle();
 *     if (error) throw error;
 *     return data ? { key, value: data.value } : null;
 *   },
 *   async set(key, value) {
 *     const { error } = await supabase
 *       .from("app_state").upsert({ key, value, updated_at: new Date().toISOString() });
 *     if (error) throw error;
 *     return { key, value };
 *   },
 *   async remove(key) {
 *     const { error } = await supabase.from("app_state").delete().eq("key", key);
 *     if (error) throw error;
 *     return { key, deleted: true };
 *   },
 * };
 * --------------------------------------------------------- */

export const storage = MODE === "supabase" ? local /* swap to `remote` */ : local;
