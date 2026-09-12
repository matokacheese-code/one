import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { normalizedOrder } from "./normalize.ts";

const API = "https://open-api.choiceqr.com";
const REQUEST_INTERVAL_MS = 5_000;
const MAX_PAGES = 200;
const MAX_RETRIES = 6;
const USER_AGENT = "MATOKA-Sales-Sync/1.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

let lastRequestStartedAt = 0;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function retryAfterMs(value: string | null): number {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

async function pacedFetch(url: string, token: string): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const remaining = REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt);
    if (remaining > 0) await sleep(remaining);
    lastRequestStartedAt = Date.now();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (response.status !== 429) return response;
    if (attempt === MAX_RETRIES) throw new Error("ChoiceQR rate limit exceeded after retries");
    const backoff = Math.max(REQUEST_INTERVAL_MS, retryAfterMs(response.headers.get("Retry-After")), 2 ** attempt * 1_000);
    await sleep(backoff);
  }
  throw new Error("ChoiceQR request failed");
}

async function jsonRequest(url: string, token: string): Promise<unknown> {
  const response = await pacedFetch(url, token);
  if (!response.ok) throw new Error(`ChoiceQR request failed with status ${response.status}`);
  return response.json();
}

function records(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  for (const candidate of [value.orders, value.data, (value.data as Record<string, unknown> | undefined)?.orders, value.items]) {
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
  }
  return [];
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const token = Deno.env.get("CHOICE_TOKEN_MATOKA");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!token || !supabaseUrl || !serviceKey) throw new Error("Required server configuration is missing");
    const placePayload = await jsonRequest(`${API}/place`, token) as Record<string, unknown>;
    const chain = placePayload.chain as Record<string, unknown> | undefined;
    const branches = Array.isArray(chain?.branches) ? chain.branches as Record<string, unknown>[] : [];
    const branchIds = branches.map(branch => branch.id).filter(id => id != null).map(String);
    if (!branchIds.length) throw new Error("ChoiceQR returned no branch IDs");
    const till = new Date();
    const from = new Date(till.getTime() - 30 * 86_400_000);
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    let fetched = 0, upserted = 0, skipped = 0, pages = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({ branches: branchIds.join(","), perPage: "100", from: from.toISOString(), till: till.toISOString(), page: String(page) });
      const payload = await jsonRequest(`${API}/orders/list/archive?${params}`, token);
      const orders = records(payload);
      pages = page;
      if (orders.length === 0) break;
      fetched += orders.length;
      const normalized = orders.map(normalizedOrder).filter((row): row is NonNullable<typeof row> => row !== null);
      skipped += orders.length - normalized.length;
      for (let offset = 0; offset < normalized.length; offset += 100) {
        const batch = normalized.slice(offset, offset + 100);
        const { error } = await supabase.from("sales_snapshot").upsert(batch, { onConflict: "order_id" });
        if (error) throw new Error(`Database upsert failed: ${error.code ?? "unknown"}`);
        upserted += batch.length;
      }
    }
    return new Response(JSON.stringify({ ok: true, branches: branchIds.length, pages, fetched, upserted, skipped }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected sync error";
    console.error("MATOKA ChoiceQR sync failed:", message);
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
