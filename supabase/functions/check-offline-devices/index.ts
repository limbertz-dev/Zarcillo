// check-offline-devices
//
// Edge Function ejecutada periódicamente (cada 5 min vía pg_cron, ver
// migración 20260605000001_offline_cron.sql).
//
// Para cada device_id de la lista DEVICES, busca el max(created_at) en
// readings. Si es mayor que OFFLINE_WINDOW_MIN o no existe, envía una
// alerta crítica por WhatsApp (con dedup en whatsapp_alert_log usando la
// pseudo-métrica "offline").

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEVICES = [
  { id: "esp32_nivel_2_001",     label: "ESP32 Principal" },
  { id: "esp32_nivel_2_mpu_001", label: "ESP32 MPU6050" },
];

const OFFLINE_WINDOW_MIN = 10; // mismo valor que ONLINE_WINDOW_MS del dashboard

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

Deno.serve(async () => {
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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const cutoff = new Date(Date.now() - OFFLINE_WINDOW_MIN * 60_000);
  const dedupSince = new Date(Date.now() - dedupMin * 60_000).toISOString();
  const results: Array<{ device: string; offline: boolean; sent: boolean; reason?: string }> = [];

  for (const device of DEVICES) {
    const { data: last, error: readErr } = await supabase
      .from("readings")
      .select("created_at")
      .eq("device_id", device.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (readErr) {
      results.push({ device: device.id, offline: false, sent: false, reason: `query: ${readErr.message}` });
      continue;
    }

    const lastSeen = last && last.length > 0 ? new Date(last[0].created_at) : null;
    const isOffline = lastSeen === null || lastSeen < cutoff;
    if (!isOffline) {
      results.push({ device: device.id, offline: false, sent: false });
      continue;
    }

    const { data: recent } = await supabase
      .from("whatsapp_alert_log")
      .select("id")
      .eq("device_id", device.id)
      .eq("metric", "offline")
      .gte("sent_at", dedupSince)
      .limit(1);

    if (recent && recent.length > 0) {
      results.push({ device: device.id, offline: true, sent: false, reason: "dedup window" });
      continue;
    }

    const lastSeenText = lastSeen
      ? lastSeen.toLocaleString("es-BO", { timeZone: "America/La_Paz" })
      : "nunca";
    const body = [
      "🚨 *Alerta Zarcillo*",
      `Dispositivo: ${device.label} (${device.id})`,
      `Sin datos por más de ${OFFLINE_WINDOW_MIN} minutos`,
      `Última lectura: ${lastSeenText}`,
    ].join("\n");

    const sent = await sendTwilio(toNumber, fromNumber, accountSid, authToken, body);
    if (!sent.ok) {
      results.push({ device: device.id, offline: true, sent: false, reason: sent.error });
      continue;
    }

    await supabase.from("whatsapp_alert_log").insert({
      device_id: device.id,
      metric: "offline",
      level: "danger",
      value: null,
      message: `Sin lecturas por más de ${OFFLINE_WINDOW_MIN} minutos`,
      to_number: toNumber,
      twilio_sid: sent.sid,
    });

    results.push({ device: device.id, offline: true, sent: true });
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
