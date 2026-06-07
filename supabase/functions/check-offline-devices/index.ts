// check-offline-devices
//
// DESACTIVADA — "sin datos por más de 10 min" NO es una de las 5 alertas
// oficiales de Zarcillo, por lo que no se envía por WhatsApp.
//
// Las 5 alertas oficiales (todas en notify-whatsapp-alert) son:
//   1. wine_temperature > 32 °C
//   2. wine_temperature < 15 °C
//   3. light > 3000 ADC
//   4. ph < 2.9 o > 4.0  (null/0 se ignoran)
//   5. movement=true o |gyro_*| > 35 °/s
//
// El estado offline sigue siendo visible en el dashboard via
// computeDeviceStatus() en src/lib/status.ts (como info, no alerta).
//
// Esta función se mantiene como no-op para no romper el job pg_cron
// existente (zarcillo_check_offline, ver migración 20260605000001_offline_cron.sql).
// El cron sigue golpeando este endpoint cada 5 min; recibe 200 inmediato y no
// contacta a Twilio ni escribe en whatsapp_alert_log.
//
// Para reactivar: restaurar la implementación original desde git history.

Deno.serve(() => {
  return new Response(
    JSON.stringify({ disabled: "offline WhatsApp notifications turned off" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
