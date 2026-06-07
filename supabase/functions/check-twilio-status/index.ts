// check-twilio-status
//
// Diagnóstico TEMPORAL para la demo: consulta a Twilio el estado real de
// entrega de un mensaje por su SID. Sirve para distinguir:
//   - delivered  → llegó al WhatsApp
//   - sent       → Twilio lo aceptó, esperando ACK del operador
//   - failed/undelivered → Twilio reporta error (ver error_code/error_message)
//
// Uso:
//   GET /functions/v1/check-twilio-status?sid=SMxxxxxxxxxxxxxxxxxxxxxxxx
//
// Borrar esta función después de la demo:
//   npx supabase functions delete check-twilio-status

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid");
  if (!sid) {
    return new Response(JSON.stringify({ error: "missing ?sid=" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) {
    return new Response(JSON.stringify({ error: "missing twilio secrets" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${sid}.json`;
  const auth = btoa(`${accountSid}:${authToken}`);
  const r = await fetch(twilioUrl, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const body = await r.text();

  // Reemitir lo más relevante para el diagnóstico
  try {
    const j = JSON.parse(body);
    return new Response(
      JSON.stringify({
        sid: j.sid,
        status: j.status,
        error_code: j.error_code,
        error_message: j.error_message,
        date_sent: j.date_sent,
        date_updated: j.date_updated,
        to: j.to,
        from: j.from,
        body: j.body,
      }, null, 2),
      { status: r.status, headers: { "Content-Type": "application/json" } },
    );
  } catch {
    return new Response(body, {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  }
});
