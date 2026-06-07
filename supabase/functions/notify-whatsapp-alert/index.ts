// notify-whatsapp-alert
//
// Supabase Edge Function que se dispara desde un Database Webhook configurado
// sobre INSERT en public.readings.
//
// ─── 5 ALERTAS OFICIALES (únicas que envían WhatsApp) ──────────────────────
//   1. Temperatura alta del vino  (esp32_nivel_2_001, wine_temperature > 32 °C)
//   2. Temperatura baja del vino  (esp32_nivel_2_001, wine_temperature < 15 °C)
//   3. Exceso de luz              (esp32_nivel_2_001, light > 3000 ADC)
//   4. pH inválido                (esp32_nivel_2_001, ph < 2.9 o > 4.0; null/0 se ignoran)
//   5. Movimiento MPU activo      (esp32_nivel_2_mpu_001, movement=true o |gyro_*|>35 °/s)
//
// Cualquier otra métrica (temperatura ambiente, humedad, accel_z, "sin datos
// por más de 10 min") NO envía WhatsApp — sólo se muestra en el dashboard.
//
// ─── Anti-spam ─────────────────────────────────────────────────────────────
// En producción cada par (device_id, metric) tiene una ventana de dedup de
// DEDUP_WINDOW_MIN minutos (default 15) en la tabla whatsapp_alert_log.
//
// ─── Modo DEMO (temporal) ──────────────────────────────────────────────────
// Para poder repetir alertas durante la prueba sin esperar el cooldown,
// definir secret DEMO_ALERT_SPAM=true. Mientras esté activo se omite la
// ventana de dedup y se envía un WhatsApp por cada INSERT que dispare una
// regla. Igualmente se sigue escribiendo en whatsapp_alert_log para auditar.
//
// ⚠ PRODUCCIÓN: borrar el secret (`supabase secrets unset DEMO_ALERT_SPAM`)
// o setearlo a "false" después de la demo para volver al cooldown normal
// de 15 minutos. Si se deja activo se va a saturar el WhatsApp del cliente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENV_DEVICE = "esp32_nivel_2_001";
const MPU_DEVICE = "esp32_nivel_2_mpu_001";

// Umbrales (espejo del dashboard — src/lib/devices.ts)
const WINE_LOW = 15;       // °C
const WINE_HIGH = 32;      // °C
const LIGHT_HIGH = 3000;   // ADC
const PH_LOW = 2.9;
const PH_HIGH = 4.0;
const GYRO_MAGNITUDE = 35; // °/s — corresponde a warnAbove/warnBelow de gyro_*

type ReadingRow = {
  device_id: string;
  created_at: string;
  wine_temperature: number | string | null;
  light: number | string | null;
  ph: number | string | null;
  movement: boolean | string | number | null;
  gyro_x: number | string | null;
  gyro_y: number | string | null;
  gyro_z: number | string | null;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: ReadingRow;
  old_record: ReadingRow | null;
};

type AlertLevel = "danger" | "warning";

type FiredAlert = {
  metric: string;
  level: AlertLevel;
  value: number | null;
  message: string;
};

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "t" || s === "1" || s === "yes";
  }
  return false;
}

function evaluate(row: ReadingRow): FiredAlert[] {
  const fired: FiredAlert[] = [];

  if (row.device_id === ENV_DEVICE) {
    // 1 + 2. Temperatura del vino
    const wine = toNumber(row.wine_temperature);
    if (wine !== null) {
      if (wine > WINE_HIGH) {
        fired.push({
          metric: "wine_temperature",
          level: "danger",
          value: wine,
          message: `Temperatura alta del vino: ${wine.toFixed(1)} °C (> ${WINE_HIGH} °C). Riesgo en la fermentación.`,
        });
      } else if (wine < WINE_LOW) {
        fired.push({
          metric: "wine_temperature",
          level: "danger",
          value: wine,
          message: `Temperatura baja del vino: ${wine.toFixed(1)} °C (< ${WINE_LOW} °C). Fermentación lenta o zona fría.`,
        });
      }
    }

    // 3. Exceso de luz
    const light = toNumber(row.light);
    if (light !== null && light > LIGHT_HIGH) {
      fired.push({
        metric: "light",
        level: "danger",
        value: light,
        message: `Exceso de luz: ${light.toFixed(0)} ADC (> ${LIGHT_HIGH}). Riesgo para la fermentación.`,
      });
    }

    // 4. pH inválido (ph < 2.9 o ph > 4.0).
    //    null y 0 se ignoran: significan "sensor sin conectar" y no son alerta.
    const ph = toNumber(row.ph);
    if (ph !== null && ph !== 0 && (ph < PH_LOW || ph > PH_HIGH)) {
      fired.push({
        metric: "ph",
        level: "warning",
        value: ph,
        message: `pH inválido: lectura ${ph.toFixed(2)} fuera de rango (${PH_LOW}–${PH_HIGH}).`,
      });
    }
  }

  if (row.device_id === MPU_DEVICE) {
    // 5. Movimiento activo (boolean del firmware o pico de giroscopio)
    const moving = toBool(row.movement);
    const gyroX = toNumber(row.gyro_x);
    const gyroY = toNumber(row.gyro_y);
    const gyroZ = toNumber(row.gyro_z);
    const gyroMax = Math.max(
      gyroX !== null ? Math.abs(gyroX) : 0,
      gyroY !== null ? Math.abs(gyroY) : 0,
      gyroZ !== null ? Math.abs(gyroZ) : 0,
    );
    const gyroSpike = gyroMax > GYRO_MAGNITUDE;

    if (moving || gyroSpike) {
      const reason = moving
        ? "movement=true"
        : `giroscopio ${gyroMax.toFixed(1)} °/s`;
      fired.push({
        metric: "movement",
        level: "warning",
        value: moving ? 1 : gyroMax,
        message: `Movimiento activo detectado (${reason}). Revisar estabilidad del hidrómetro.`,
      });
    }
  }

  return fired;
}

function buildWhatsAppBody(deviceId: string, createdAt: string, alert: FiredAlert): string {
  const when = new Date(createdAt).toLocaleString("es-BO", { timeZone: "America/La_Paz" });
  return [
    "🚨 *Alerta Zarcillo*",
    `Dispositivo: ${deviceId}`,
    alert.message,
    `Hora: ${when}`,
  ].join("\n");
}

async function sendTwilio(
  to: string,
  from: string,
  accountSid: string,
  authToken: string,
  body: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const auth = btoa(`${accountSid}:${authToken}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Twilio ${res.status}: ${text}` };
  }
  const json = await res.json();
  return { ok: true, sid: json.sid };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken  = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");
  const toNumber   = Deno.env.get("ALERT_TO_NUMBER");
  const dedupMin   = Number(Deno.env.get("DEDUP_WINDOW_MIN") ?? "15");
  // DEMO_ALERT_SPAM: si está "true", se omite la ventana de cooldown y se
  // envía un WhatsApp por cada disparo (ver header del archivo).
  // Producción: borrar el secret para volver al cooldown normal.
  const demoSpam   = (Deno.env.get("DEMO_ALERT_SPAM") ?? "").toLowerCase() === "true";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!accountSid || !authToken || !fromNumber || !toNumber || !supabaseUrl || !serviceKey) {
    return new Response("Missing required secrets", { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json() as WebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "readings") {
    return new Response(JSON.stringify({ skipped: "not an INSERT on readings" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = payload.record;
  const fired = evaluate(row);
  if (fired.length === 0) {
    return new Response(JSON.stringify({ fired: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Anti-spam: si DEMO_ALERT_SPAM=true o DEDUP_WINDOW_MIN<=0, se omite.
  const dedupDisabled = demoSpam || dedupMin <= 0;
  const since = new Date(Date.now() - dedupMin * 60_000).toISOString();
  const results: Array<{ metric: string; sent: boolean; reason?: string }> = [];

  for (const alert of fired) {
    if (!dedupDisabled) {
      const { data: recent, error: dedupErr } = await supabase
        .from("whatsapp_alert_log")
        .select("id")
        .eq("device_id", row.device_id)
        .eq("metric", alert.metric)
        .gte("sent_at", since)
        .limit(1);

      if (dedupErr) {
        results.push({ metric: alert.metric, sent: false, reason: `dedup query: ${dedupErr.message}` });
        continue;
      }
      if (recent && recent.length > 0) {
        results.push({ metric: alert.metric, sent: false, reason: "dedup window" });
        continue;
      }
    }

    const body = buildWhatsAppBody(row.device_id, row.created_at, alert);
    const sent = await sendTwilio(toNumber, fromNumber, accountSid, authToken, body);

    if (!sent.ok) {
      results.push({ metric: alert.metric, sent: false, reason: sent.error });
      continue;
    }

    await supabase.from("whatsapp_alert_log").insert({
      device_id: row.device_id,
      metric: alert.metric,
      level: alert.level,
      value: alert.value,
      message: alert.message,
      to_number: toNumber,
      twilio_sid: sent.sid,
    });

    results.push({ metric: alert.metric, sent: true });
  }

  return new Response(JSON.stringify({ fired: fired.length, demoSpam, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
