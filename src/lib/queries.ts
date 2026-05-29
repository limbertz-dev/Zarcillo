import { READINGS_COLUMNS, READINGS_TABLE, supabase } from "./supabase";
import type { Reading } from "./types";

export type FetchReadingsOptions = {
  deviceIds?: string[];
  limit?: number;
  since?: Date | string;
  until?: Date | string;
  ascending?: boolean;
};

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
  if (error) throw error;
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
