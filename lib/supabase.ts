import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export type Settings = {
  test_site: string; // e.g. https://learning-vkpy.atlassian.net
  test_org: string; // organization name as listed in admin.atlassian.com
  display_org_name: string; // e.g. Apex
};

let cached: Settings | null = null;

/** Reads public.recipe_settings once per run. */
export async function settings(): Promise<Settings> {
  if (cached) return cached;
  const { data, error } = await db().from("recipe_settings").select("key, value");
  if (error) throw error;
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  for (const k of ["test_site", "test_org", "display_org_name"]) {
    if (!map[k]) throw new Error(`recipe_settings is missing "${k}"`);
  }
  cached = map as Settings;
  return cached;
}
