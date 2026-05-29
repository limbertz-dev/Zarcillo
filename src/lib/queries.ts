import { READINGS_COLUMNS, READINGS_TABLE, supabase } from "./supabase";
import type { Reading } from "./types";

export type FetchReadingsOptions = {
  deviceIds?: string[];
  limit?: number;
  since?: Date | string;
  until?: Date | string;
  ascending?: boolean;
};

export function formatSupabaseError(error: unknown): string {
  console.error("Supabase error:", error);
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; hint?: string };
    const parts: string[] = [];
    if (e.message) parts.push(e.message);
    if (e.details) parts.push(e.details);
    if (e.hint) parts.push(`Pista: ${e.hint}`);
    if (parts.length > 0) return parts.join(" — ");
  }
  if (error instanceof Error) return error.message;
  return "Error desconocido al consultar Supabase";
}

export async function fetchReadings(
  opts: FetchReadingsOptions = {},
): Promise<Reading[]> {
  const ascending = opts.ascending ?? false;
  let q = supabase
    .from(READINGS_TABLE)
    .select(READINGS_COLUMNS)
    .order("created_at", { ascending });

  if (opts.deviceIds && opts.deviceIds.length > 0) {
    q = q.in("device_id", opts.deviceIds);
  }
  if (opts.since) {
    const iso =
      opts.since instanceof Date ? opts.since.toISOString() : opts.since;
    q = q.gte("created_at", iso);
  }
  if (opts.until) {
    const iso =
      opts.until instanceof Date ? opts.until.toISOString() : opts.until;
    q = q.lte("created_at", iso);
  }
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as Reading[];
}

export async function fetchLastByDevice(): Promise<Record<string, Reading>> {
  const data = await fetchReadings({ limit: 100 });
  const map: Record<string, Reading> = {};
  for (const r of data) {
    if (!map[r.device_id]) map[r.device_id] = r;
  }
  return map;
}
