import { METRICS, ONLINE_WINDOW_MS } from "./devices";
import { toBool, toNumber } from "./format";
import { computeDeviceStatus } from "./status";
import type { AlertEvent, AlertLevel, Reading, ReadingMetric } from "./types";

const THRESHOLD_METRICS: ReadingMetric[] = [
  "ambient_temperature",
  "wine_temperature",
  "ambient_humidity",
];

function metricLevel(metric: ReadingMetric, value: number): AlertLevel | null {
  const meta = METRICS[metric];
  if (meta.alertAbove !== undefined && value > meta.alertAbove) return "danger";
  if (meta.warnAbove !== undefined && value > meta.warnAbove) return "warning";
  return null;
}

export function buildAlerts(
  readings: Reading[],
  now: number = Date.now(),
): AlertEvent[] {
  const events: AlertEvent[] = [];

  for (const r of readings) {
    for (const metric of THRESHOLD_METRICS) {
      const v = toNumber(r[metric]);
      if (v === null) continue;
      const level = metricLevel(metric, v);
      if (!level) continue;
      const meta = METRICS[metric];
      events.push({
        id: `${r.device_id}-${r.created_at}-${metric}`,
        device_id: r.device_id,
        metric,
        level,
        value: v,
        created_at: r.created_at,
        message: `${meta.label} ${v.toFixed(meta.digits)}${meta.unit} (umbral ${meta.alertAbove ?? meta.warnAbove}${meta.unit})`,
      });
    }

    if (toBool(r.movement)) {
      events.push({
        id: `${r.device_id}-${r.created_at}-movement`,
        device_id: r.device_id,
        metric: "movement",
        level: "warning",
        value: "true",
        created_at: r.created_at,
        message: "Movimiento detectado en el sensor MPU6050",
      });
    }
  }

  const devices = computeDeviceStatus(readings, now);
  for (const d of devices) {
    if (!d.online) {
      events.push({
        id: `${d.deviceId}-offline`,
        device_id: d.deviceId,
        metric: "offline",
        level: "danger",
        value: d.lastSeen,
        created_at: d.lastSeen ?? new Date(now).toISOString(),
        message: d.lastSeen
          ? `Sin datos por más de ${Math.round(ONLINE_WINDOW_MS / 60000)} minutos`
          : "Sin lecturas registradas",
      });
    }
  }

  return events.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
