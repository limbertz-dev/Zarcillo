import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan las variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: { eventsPerSecond: 5 },
  },
});

export const READINGS_TABLE = "readings";

export const READINGS_COLUMNS =
  "device_id, level, created_at, ambient_temperature, ambient_humidity, wine_temperature, light, accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z, movement, dashboard_lamp";

export type { Reading, DeviceId } from "./types";
