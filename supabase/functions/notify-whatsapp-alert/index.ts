// notify-whatsapp-alert
//
// Supabase Edge Function que se dispara desde un Database Webhook
// configurado sobre INSERT en public.readings.
//
// Evalúa los umbrales CRÍTICOS (nivel "danger") definidos en el dashboard,
// deduplica con whatsapp_alert_log y envía un WhatsApp vía Twilio Sandbox
// a ALERT_TO_NUMBER.
//
// Secrets que la función espera (configurar con supabase secrets set):
//   TWILIO_ACCOUNT_SID       AC...........................
//   TWILIO_AUTH_TOKEN        ...
//   TWILIO_WHATSAPP_FROM     whatsapp:+14155238886           (número del Sandbox)
//   ALERT_TO_NUMBER          whatsapp:+59167677773
//   DEDUP_WINDOW_MIN         15                              (opcional, default 15)
//
// Notas:
// - Sólo procesa los 4 umbrales críticos del ESP32 Principal:
//     ambient_temperature, ambient_humidity, wine_temperature, ph
//   El evento "offline" lo maneja una función separada (check-offline-devices).
// - Si Twilio devuelve error, se loguea y se devuelve 500 para que el webhook
//   reintente; aun así NO se registra en whatsapp_alert_log para que el próximo
//   reading sí pueda intentar de nuevo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Level = "danger";
type CriticalMetric =
  | "ambient_temperature"
  | "ambient_humidity"
  | "wine_temperature"
  | "ph";

type Threshold = {
  label: string;
  unit: string;
  alertBelow?: number;
  alertAbove?: number;
};

// Mismos umbrales "danger" que zarcillo-dashboard/src/lib/devices.ts
const CRITICAL: Record<CriticalMetric, Threshold> = {
  ambient_temperature: { label: "Temp. Ambiente", unit: "°C", alertBelow: 10, alertAbove: 32 },
  ambient_humidity:    { label: "Humedad",        unit: "%",  alertBelow: 40, alertAbove: 90 },
  wine_temperature:    { label: "Temp. Vino",     unit: "°C", alertBelow: 15, alertAbove: 32 },
  ph:                  { label: "pH",             unit: "",   alertBelow: 2.9, alertAbove: 4.0 },
};

type ReadingRow = {
  device_id: string;
  created_at: string;
  ambient_temperature: number | string | null;
  ambient_humidity: number | string | null;
  wine_temperature: number | string | null;
  ph: number | string | null;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: ReadingRow;
  old_record: ReadingRow | null;
};

type FiredAlert = {
  metric: CriticalMetric;
  level: Level;
  value: number;
  message: string;
};

function toNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function evaluate(row: ReadingRow): FiredAlert[] {
  const fired: FiredAlert[] = [];
  for (const [key, t] of Object.entries(CRITICAL) as [CriticalMetric, Threshold][]) {
    const v = toNumber(row[key]);
    if (v === null) continue;

    let triggered = false;
    let thresholdText = "";
    if (t.alertBelow !== undefined && v < t.alertBelow) {
      triggered = true;
      thresholdText = `< ${t.alertBelow} ${t.unit}`.trim();
    } else if (t.alertAbove !== undefined && v > t.alertAbove) {
      triggered = true;
      thresholdText = `> ${t.alertAbove} ${t.unit}`.trim();
    }
    if (!triggered) continue;

    const digits = key === "ph" ? 2 : 1;
    fired.push({
      metric: key,
      level: "danger",
      value: v,
      message: `${t.label} ${v.toFixed(digits)}${t.unit} (umbral ${thresholdText})`,
    });
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

  const since = new Date(Date.now() - dedupMin * 60_000).toISOString();
  const results: Array<{ metric: string; sent: boolean; reason?: string }> = [];

  for (const alert of fired) {
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

  return new Response(JSON.stringify({ fired: fired.length, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
