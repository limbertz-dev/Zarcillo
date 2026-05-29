/**
 * lib/status.ts
 *
 * Lógica de estado del sistema de fermentación.
 *
 * ── Funciones ORIGINALES (no modificadas) ────────────────────────────────────
 *   · computeDeviceStatus()   — estado online/offline por dispositivo
 *   · computeSystemStatus()   — estado global derivado de dispositivos
 *
 * ── Funciones NUEVAS (para la pantalla /estado) ──────────────────────────────
 *   · evaluateFermentationStatus() — evalúa alertas y estado completo
 *
 * ── MIGRACIÓN A DATOS REALES ─────────────────────────────────────────────────
 * En app/estado/page.tsx, reemplazar MOCK_ENV_READING / MOCK_MPU_READING
 * por el resultado de useReadings(). Toda esta lógica permanece intacta.
 */

import { DEVICE_IDS, METRICS, ONLINE_WINDOW_MS } from "./devices";
import { toNumber, toBool } from "./format";
import type { Reading, SystemStatus, AlertEvent, ReadingMetric } from "./types";

// ─── Re-exportar SystemStatus para que status-cards.tsx pueda importarlo ─────
export type { SystemStatus, AlertEvent };

// ─── Evaluación de la temperatura del vino (etapa de fermentación) ───────────
// Umbrales orientados a tinto joven. Bilateral: detecta frío y calor.

export type WineTempStage =
  | "cold-critical"
  | "cold"
  | "optimal"
  | "warm"
  | "hot";

export type WineTempAssessment = {
  stage: WineTempStage;
  label: string;
  description: string;
  status: "normal" | "warning" | "alert";
  color: string;
  temperature: number | null;
  optimalMin: number;
  optimalMax: number;
  scaleMin: number;
  scaleMax: number;
};

const WINE_SCALE = { min: 10, max: 32, optMin: 18, optMax: 25 };

export function evaluateWineStage(
  temperature: number | null,
): WineTempAssessment {
  const base = {
    optimalMin: WINE_SCALE.optMin,
    optimalMax: WINE_SCALE.optMax,
    scaleMin: WINE_SCALE.min,
    scaleMax: WINE_SCALE.max,
  };

  if (temperature === null || Number.isNaN(temperature)) {
    return {
      ...base,
      stage: "optimal",
      label: "Sin datos",
      description: "No hay lectura reciente de la sonda DS18B20.",
      status: "normal",
      color: "#64748b",
      temperature: null,
    };
  }
  if (temperature < 12) {
    return {
      ...base,
      stage: "cold-critical",
      label: "Frío crítico",
      description: "Fermentación prácticamente detenida. Elevar la temperatura del recinto.",
      status: "alert",
      color: "#3b82f6",
      temperature,
    };
  }
  if (temperature < WINE_SCALE.optMin) {
    return {
      ...base,
      stage: "cold",
      label: "Frío",
      description: "Fermentación lenta. Conviene acercarse al rango óptimo (18–25 °C).",
      status: "warning",
      color: "#06b6d4",
      temperature,
    };
  }
  if (temperature <= WINE_SCALE.optMax) {
    return {
      ...base,
      stage: "optimal",
      label: "Óptimo",
      description: "Rango ideal de fermentación. Mantener las condiciones actuales.",
      status: "normal",
      color: "#10b981",
      temperature,
    };
  }
  if (temperature <= 28) {
    return {
      ...base,
      stage: "warm",
      label: "Tibio",
      description: "Fermentación acelerada. Vigilar aromas volátiles y posible parada.",
      status: "warning",
      color: "#f59e0b",
      temperature,
    };
  }
  return {
    ...base,
    stage: "hot",
    label: "Caliente",
    description: "Riesgo crítico para la fermentación. Enfriar el mosto inmediatamente.",
    status: "alert",
    color: "#ef4444",
    temperature,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN ORIGINAL — no modificada
// ═══════════════════════════════════════════════════════════════════════════════

export type DeviceStatus = {
  deviceId: string;
  lastSeen: string | null;
  online: boolean;
};

export function computeDeviceStatus(
  readings: Reading[],
  now: number = Date.now(),
): DeviceStatus[] {
  const lastByDevice: Record<string, string> = {};
  for (const r of readings) {
    const existing = lastByDevice[r.device_id];
    if (!existing || new Date(r.created_at) > new Date(existing)) {
      lastByDevice[r.device_id] = r.created_at;
    }
  }
  return DEVICE_IDS.map((id) => {
    const lastSeen = lastByDevice[id] ?? null;
    const online =
      lastSeen !== null && now - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS;
    return { deviceId: id, lastSeen, online };
  });
}

export function computeSystemStatus(
  devices: DeviceStatus[],
  hasError = false,
): SystemStatus {
  if (hasError) return "error";
  const offlineCount = devices.filter((d) => !d.online).length;
  if (offlineCount === 0) return "ok";
  if (offlineCount >= devices.length) return "error";
  return "warn";
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN NUEVA — pantalla /estado
// ═══════════════════════════════════════════════════════════════════════════════

// Umbrales de luz sincronizados con firmware/src/main.cpp
const LDR_DARK_THRESHOLD = 1500;
const LDR_SATURATED      = 4000;

export type DeviceOnlineStatus = {
  deviceId: string;
  label: string;
  online: boolean;
  lastSeenIso: string | null;
  minutesAgo: number | null;
};

export type FermentationStatus = {
  overall: SystemStatus;
  summary: string;
  detail: string;
  alerts: AlertEvent[];
  sensorStatuses: Record<string, import("./devices").MetricStatus>;
  devices: DeviceOnlineStatus[];
  wine: WineTempAssessment;
};

// ── Helpers internos ──────────────────────────────────────────────────────────

function isOnline(lastSeenIso: string | null): boolean {
  if (!lastSeenIso) return false;
  return Date.now() - new Date(lastSeenIso).getTime() < ONLINE_WINDOW_MS;
}

function minutesAgo(isoStr: string | null): number | null {
  if (!isoStr) return null;
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 60_000);
}

function metricAlert(
  metric: ReadingMetric,
  value: number | null,
  deviceId: string,
  lastSeenIso: string,
): AlertEvent | null {
  if (value === null || Number.isNaN(value)) return null;
  const meta = METRICS[metric];

  if (meta.alertAbove !== undefined && value > meta.alertAbove) {
    return {
      id: `${metric}-alert`,
      device_id: deviceId,
      metric,
      level: "danger",
      message: `${meta.label} por encima del límite crítico (${value.toFixed(meta.digits)} ${meta.unit} > ${meta.alertAbove} ${meta.unit})`,
      value,
      created_at: lastSeenIso,
    };
  }
  if (meta.warnAbove !== undefined && value > meta.warnAbove) {
    return {
      id: `${metric}-warn`,
      device_id: deviceId,
      metric,
      level: "warning",
      message: `${meta.label} elevada (${value.toFixed(meta.digits)} ${meta.unit} > ${meta.warnAbove} ${meta.unit})`,
      value,
      created_at: lastSeenIso,
    };
  }
  return null;
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Evalúa el estado global del proceso a partir de la última lectura
 * de cada dispositivo. Compatible con datos reales de useReadings().
 */
export function evaluateFermentationStatus(
  envLatest: Reading | null,
  mpuLatest: Reading | null,
): FermentationStatus {
  const alerts: AlertEvent[] = [];
  const sensorStatuses: Record<string, import("./devices").MetricStatus> = {};

  const envLastSeen = envLatest?.created_at ?? null;
  const mpuLastSeen = mpuLatest?.created_at ?? null;

  // ── Conectividad ────────────────────────────────────────────────────────
  const envOnline = isOnline(envLastSeen);
  const mpuOnline = isOnline(mpuLastSeen);

  const devices: DeviceOnlineStatus[] = [
    {
      deviceId: "esp32_nivel_2_001",
      label: "ESP32 Principal",
      online: envOnline,
      lastSeenIso: envLastSeen,
      minutesAgo: minutesAgo(envLastSeen),
    },
    {
      deviceId: "esp32_nivel_2_mpu_001",
      label: "ESP32 MPU6050",
      online: mpuOnline,
      lastSeenIso: mpuLastSeen,
      minutesAgo: minutesAgo(mpuLastSeen),
    },
  ];

  if (!envOnline) {
    alerts.push({
      id: "offline-env",
      device_id: "esp32_nivel_2_001",
      metric: "offline",
      level: "danger",
      message:
        "ESP32 Principal sin señal — no se reciben lecturas de temperatura ni humedad",
      value: null,
      created_at: envLastSeen ?? new Date().toISOString(),
    });
  }
  if (!mpuOnline) {
    alerts.push({
      id: "offline-mpu",
      device_id: "esp32_nivel_2_mpu_001",
      metric: "offline",
      level: "warning",
      message:
        "ESP32 MPU6050 sin señal — movimiento y vibración no disponibles",
      value: null,
      created_at: mpuLastSeen ?? new Date().toISOString(),
    });
  }

  // ── Métricas de ambiente ────────────────────────────────────────────────
  const envMetrics: ReadingMetric[] = [
    "ambient_temperature",
    "ambient_humidity",
    "wine_temperature",
    "light",
  ];

  if (envLatest && envLastSeen) {
    for (const m of envMetrics) {
      const val  = toNumber(envLatest[m]);
      const meta = METRICS[m];

      let status: import("./devices").MetricStatus = "normal";
      if (val !== null) {
        if (meta.alertAbove !== undefined && val > meta.alertAbove)
          status = "alert";
        else if (meta.warnAbove !== undefined && val > meta.warnAbove)
          status = "warning";
      }
      sensorStatuses[m] = status;

      const a = metricAlert(m, val, envLatest.device_id, envLastSeen);
      if (a) alerts.push(a);
    }

    // Vino: comprobación bilateral (frío + caliente) basada en etapas
    const wineVal = toNumber(envLatest.wine_temperature);
    const wineAssess = evaluateWineStage(wineVal);
    if (wineVal !== null && wineAssess.status !== "normal") {
      const isLow = wineVal < WINE_SCALE.optMin;
      const level: AlertEvent["level"] =
        wineAssess.status === "alert" ? "danger" : "warning";
      alerts.push({
        id: `wine-stage-${wineAssess.stage}`,
        device_id: envLatest.device_id,
        metric: "wine_temperature",
        level,
        message: isLow
          ? `Temp. del vino ${wineVal.toFixed(1)} °C — ${wineAssess.label.toLowerCase()}: ${wineAssess.description}`
          : `Temp. del vino ${wineVal.toFixed(1)} °C — ${wineAssess.label.toLowerCase()}: ${wineAssess.description}`,
        value: wineVal,
        created_at: envLastSeen,
      });
      // Si la etapa empeora el status, lo elevamos
      const current = sensorStatuses["wine_temperature"] ?? "normal";
      const order = { normal: 0, warning: 1, alert: 2 } as const;
      if (order[wineAssess.status] > order[current]) {
        sensorStatuses["wine_temperature"] = wineAssess.status;
      }
    }

    // Luz: lógica especial (oscuro / saturado)
    const ldrVal = toNumber(envLatest.light);
    if (ldrVal !== null) {
      if (ldrVal < LDR_DARK_THRESHOLD) {
        alerts.push({
          id: "light-dark",
          device_id: envLatest.device_id,
          metric: "light",
          level: "warning",
          message: `Luminosidad baja (${ldrVal} lux) — posible exposición inadecuada de la cuba`,
          value: ldrVal,
          created_at: envLastSeen,
        });
        if (sensorStatuses["light"] === "normal")
          sensorStatuses["light"] = "warning";
      } else if (ldrVal >= LDR_SATURATED) {
        alerts.push({
          id: "light-saturated",
          device_id: envLatest.device_id,
          metric: "light",
          level: "warning",
          message: `Luminosidad muy alta (${ldrVal} lux) — luz directa puede afectar la fermentación`,
          value: ldrVal,
          created_at: envLastSeen,
        });
        if (sensorStatuses["light"] === "normal")
          sensorStatuses["light"] = "warning";
      }
    }
  }

  // ── MPU6050 ─────────────────────────────────────────────────────────────
  if (mpuLatest && mpuLastSeen) {
    const moving = toBool(mpuLatest.movement);
    if (moving) {
      alerts.push({
        id: "movement-detected",
        device_id: mpuLatest.device_id,
        metric: "movement",
        level: "warning",
        message: "Movimiento detectado en la cuba de fermentación",
        value: 1,
        created_at: mpuLastSeen,
      });
    }

    const accelZ = toNumber(mpuLatest.accel_z);
    if (accelZ !== null && Math.abs(accelZ - 1.0) > 0.3) {
      alerts.push({
        id: "accel-z-anomaly",
        device_id: mpuLatest.device_id,
        metric: "accel_z",
        level: "info",
        message: `Vibración inusual detectada (accel_z = ${accelZ.toFixed(3)} g)`,
        value: accelZ,
        created_at: mpuLastSeen,
      });
    }
  }

  // ── Deduplicar y ordenar alertas ────────────────────────────────────────
  const seen = new Set<string>();
  const uniqueAlerts = alerts.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
  const levelOrder: Record<string, number> = { danger: 0, warning: 1, info: 2 };
  uniqueAlerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  // ── Estado general ───────────────────────────────────────────────────────
  const hasDanger  = uniqueAlerts.some((a) => a.level === "danger");
  const hasWarning = uniqueAlerts.some((a) => a.level === "warning");

  let overall: SystemStatus;
  let summary: string;
  let detail: string;

  if (!envOnline && !mpuOnline) {
    overall = "error";
    summary = "Sin conexión con los sensores";
    detail  = "Ningún dispositivo está enviando datos. Verificar conectividad.";
  } else if (hasDanger) {
    overall = "error";
    summary = "Condición crítica activa";
    detail  = "Hay una o más alertas críticas que requieren atención inmediata.";
  } else if (hasWarning) {
    overall = "warn";
    summary = "Fermentación en curso con advertencias";
    detail  = "El proceso continúa, pero existen condiciones fuera del rango óptimo.";
  } else {
    overall = "ok";
    summary = "Fermentación en condiciones óptimas";
    detail  = "Todos los parámetros dentro de los rangos normales de operación.";
  }

  const wine = evaluateWineStage(
    envLatest ? toNumber(envLatest.wine_temperature) : null,
  );

  return {
    overall,
    summary,
    detail,
    alerts: uniqueAlerts,
    sensorStatuses,
    devices,
    wine,
  };
}
