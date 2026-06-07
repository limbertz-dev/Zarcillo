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

const WINE_SCALE = { min: 10, max: 35, optMin: 18, optMax: 28 };

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
  if (temperature < 15) {
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
      description: "Fermentación lenta. Conviene acercarse al rango óptimo (18–28 °C).",
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
  if (temperature <= 32) {
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

// Rango oficial del proyecto: pH inválido sólo si está fuera de [2.9, 4.0].
// (Antes era [2.5, 4.5], "realista para vino". Se unificó con la regla oficial
//  para que dashboard, /estado y WhatsApp coincidan.)
const OFFICIAL_WINE_PH = { min: 2.9, max: 4.0 };

function isValidWinePh(value: number | null): boolean {
  // null y 0 cuentan como "sin lectura" → no son inválidos, sólo desconocidos.
  if (value === null || !Number.isFinite(value) || value === 0) return false;
  return value >= OFFICIAL_WINE_PH.min && value <= OFFICIAL_WINE_PH.max;
}

function phIsMissing(value: number | null): boolean {
  return value === null || !Number.isFinite(value) || value === 0;
}

export function evaluateCurrentZoneStatus(
  latest: Reading | null,
  nowMs: number,
): WineTempAssessment {
  const wineTemp = latest ? toNumber(latest.wine_temperature) : null;
  const base = evaluateWineStage(wineTemp);

  const lastSeen = latest?.created_at ?? null;
  const lastMs = lastSeen ? new Date(lastSeen).getTime() : Number.NaN;
  const online =
    latest !== null &&
    Number.isFinite(lastMs) &&
    nowMs > 0 &&
    nowMs - lastMs < ONLINE_WINDOW_MS;

  if (!online) {
    // "Sin datos por más de 10 min" NO es una de las 5 alertas oficiales —
    // queda como estado informativo (status normal, no dispara alerta principal).
    return {
      ...base,
      label: "Sin conexión",
      description:
        "No hay lectura reciente del ESP32 principal. Verificar conexión antes de evaluar la zona.",
      status: "normal",
      color: "#64748b",
    };
  }

  const ambientTemp = toNumber(latest.ambient_temperature);
  const ambientHumidity = toNumber(latest.ambient_humidity);
  const light = toNumber(latest.light);
  const ph = toNumber(latest.ph);
  const context = [
    ambientTemp !== null ? `ambiente ${ambientTemp.toFixed(1)} °C` : null,
    ambientHumidity !== null ? `humedad ${ambientHumidity.toFixed(1)} %` : null,
  ].filter(Boolean);
  const contextText = context.length > 0 ? ` Contexto: ${context.join(", ")}.` : "";

  // Etapas "cold-critical" (<15) y "hot" (>32) ya están en status="alert"
  // por evaluateWineStage → coincide con alertas oficiales #1 y #2.
  if (base.status !== "normal") {
    return {
      ...base,
      description: `${base.description}${contextText}`,
    };
  }

  // Alerta oficial #3 — Exceso de luz (light > 3000 ADC).
  // El umbral intermedio "luz elevada" (>1500) ya no se reporta como alerta;
  // queda sólo el valor amarillo en la tarjeta de luz del dashboard.
  if (light !== null && light > 3000) {
    return {
      ...base,
      label: "Exceso de luz",
      description:
        `La temperatura del vino está en rango, pero el LDR marca luz alta (${light.toFixed(0)} ADC > 3000). Proteger la cuba de luz directa.${contextText}`,
      status: "alert",
      color: "#f59e0b",
    };
  }

  // Alerta oficial #4 — pH inválido (ph < 2.9 o ph > 4.0).
  // null y 0 (sensor desconectado) NO disparan alerta.
  if (!phIsMissing(ph) && !isValidWinePh(ph)) {
    return {
      ...base,
      label: "pH inválido",
      description:
        `La temperatura del vino está en rango, pero el pH (${(ph as number).toFixed(2)}) está fuera del rango oficial ${OFFICIAL_WINE_PH.min}–${OFFICIAL_WINE_PH.max}. Revisar sensor o calibración.${contextText}`,
      status: "warning",
      color: "#14b8a6",
    };
  }

  return {
    ...base,
    description: `${base.description}${contextText}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEREDICTO DE FERMENTACIÓN — "¿el vino ya fermentó?" (pantalla /estado simple)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Los sensores no miden azúcar/densidad directamente, así que la finalización de
// la fermentación se INFIERE de la estabilización del proceso sobre el registro
// histórico:
//   1. La fermentación alcohólica es exotérmica → mientras está activa, el mosto
//      se mantiene por encima del ambiente y/o su temperatura sigue variando.
//   2. El pH se desplaza mientras hay actividad y se estabiliza al terminar.
// Cuando la temperatura del vino y el pH dejan de variar (baja actividad) sobre
// una ventana suficiente, se considera que la fermentación se completó.
//
// Todos los umbrales están en FP para poder ajustarlos en la defensa.

export type FermentationVerdict = "ready" | "finishing" | "active" | "unknown";

export type FermentationProgress = {
  verdict: FermentationVerdict;
  title: string;
  message: string;
  progress: number; // 0..1  (1 = listo)
  activity: number; // 0..1  (1 = fermentación muy activa)
  wineTemp: number | null;
  ambientTemp: number | null;
  delta: number | null; // vino − ambiente
  ph: number | null;
  etaText: string | null;
  basis: string;
  sampleCount: number;
  spanHours: number;
};

const FP = {
  minSamples: 8, // lecturas mínimas para emitir veredicto
  minSpanMin: 10, // minutos mínimos de historial
  minCompletedHours: 48,
  quietHours: 6,
  wineSlopeRef: 0.5, // C/h de variacion de temp = actividad plena
  wineRangeRef: 4.0,
  phSlopeRef: 0.05, // pH/h de variacion = actividad plena
  phRangeRef: 0.4,
  accelStdRef: 0.08,
  gyroStdRef: 8,
  movementRateRef: 0.15,
  readyActivity: 0.15, // actividad ≤ → fermentación completa
  activeActivity: 0.5, // actividad ≥ → fermentación activa
};

type WinePoint = { t: number; wine: number; amb: number | null; ph: number | null };
type MpuPoint = {
  t: number;
  accelX: number | null;
  accelY: number | null;
  accelZ: number | null;
  gyroX: number | null;
  gyroY: number | null;
  gyroZ: number | null;
  movement: boolean;
};

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Pendiente por regresión lineal, expresada en unidades por hora.
function slopePerHour(pts: { t: number; v: number }[]): number {
  const n = pts.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of pts) {
    sx += p.t; sy += p.v; sxx += p.t * p.t; sxy += p.t * p.v;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return ((n * sxy - sx * sy) / denom) * 3_600_000;
}

// Índice de actividad [0,1] de un conjunto de puntos: combina la variación de
// temperatura del vino, la variación de pH y el exceso térmico sobre el ambiente.
function rangeOf(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function envActivityOf(pts: WinePoint[]): number {
  if (pts.length < 2) return 0;
  const wineSlope = Math.abs(slopePerHour(pts.map((p) => ({ t: p.t, v: p.wine }))));
  const wineRange = rangeOf(pts.map((p) => p.wine));
  const phPts = pts
    .filter((p) => isValidWinePh(p.ph))
    .map((p) => ({ t: p.t, v: p.ph as number }));
  const phSlope = phPts.length >= 2 ? Math.abs(slopePerHour(phPts)) : 0;
  const phRange = rangeOf(phPts.map((p) => p.v));

  return clamp01(
    Math.max(
      wineSlope / FP.wineSlopeRef,
      wineRange / FP.wineRangeRef,
      phPts.length >= 2
        ? Math.max(phSlope / FP.phSlopeRef, phRange / FP.phRangeRef)
        : 0,
    ),
  );
}

function mpuActivityOf(pts: MpuPoint[]): number {
  if (pts.length < 2) return 0;
  const accelStd = Math.max(
    stdDev(pts.map((p) => p.accelX).filter((v): v is number => v !== null)),
    stdDev(pts.map((p) => p.accelY).filter((v): v is number => v !== null)),
    stdDev(pts.map((p) => p.accelZ).filter((v): v is number => v !== null)),
  );
  const gyroStd = Math.max(
    stdDev(pts.map((p) => p.gyroX).filter((v): v is number => v !== null)),
    stdDev(pts.map((p) => p.gyroY).filter((v): v is number => v !== null)),
    stdDev(pts.map((p) => p.gyroZ).filter((v): v is number => v !== null)),
  );
  const movementRate =
    pts.filter((p) => p.movement).length / Math.max(pts.length, 1);

  return clamp01(
    Math.max(
      accelStd / FP.accelStdRef,
      gyroStd / FP.gyroStdRef,
      movementRate / FP.movementRateRef,
    ),
  );
}

function formatHours(h: number): string {
  if (h < 1) return `≈ ${Math.max(5, Math.round(h * 60))} min`;
  if (h < 24) return `≈ ${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `≈ ${(h / 24).toFixed(1)} días`;
}

/**
 * Evalúa si el vino ya fermentó a partir del historial (orden cronológico:
 * viejo → nuevo) de la ESP32 Principal.
 */
export function evaluateFermentationProgress(
  readingsChrono: Reading[],
): FermentationProgress {
  const envPts: WinePoint[] = readingsChrono
    .filter((r) => r.device_id === "esp32_nivel_2_001")
    .map((r) => ({
      t: new Date(r.created_at).getTime(),
      wine: toNumber(r.wine_temperature),
      amb: toNumber(r.ambient_temperature),
      ph: toNumber(r.ph),
    }))
    .filter((p): p is WinePoint => p.wine !== null && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  const mpuPts: MpuPoint[] = readingsChrono
    .filter((r) => r.device_id === "esp32_nivel_2_mpu_001")
    .map((r) => ({
      t: new Date(r.created_at).getTime(),
      accelX: toNumber(r.accel_x),
      accelY: toNumber(r.accel_y),
      accelZ: toNumber(r.accel_z),
      gyroX: toNumber(r.gyro_x),
      gyroY: toNumber(r.gyro_y),
      gyroZ: toNumber(r.gyro_z),
      movement: toBool(r.movement),
    }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  const latest = envPts.length > 0 ? envPts[envPts.length - 1] : null;
  const wineTemp = latest?.wine ?? null;
  const ambientTemp = latest?.amb ?? null;
  const ph = isValidWinePh(latest?.ph ?? null) ? latest?.ph ?? null : null;
  const delta =
    wineTemp !== null && ambientTemp !== null ? wineTemp - ambientTemp : null;

  const firstTime = Math.min(
    envPts[0]?.t ?? Number.POSITIVE_INFINITY,
    mpuPts[0]?.t ?? Number.POSITIVE_INFINITY,
  );
  const lastTime = Math.max(
    envPts[envPts.length - 1]?.t ?? 0,
    mpuPts[mpuPts.length - 1]?.t ?? 0,
  );
  const spanMs = Number.isFinite(firstTime) ? lastTime - firstTime : 0;
  const spanHours = spanMs / 3_600_000;

  if (
    envPts.length < FP.minSamples ||
    mpuPts.length < Math.max(4, Math.floor(FP.minSamples / 2)) ||
    spanMs < FP.minSpanMin * 60_000
  ) {
    return {
      verdict: "unknown",
      title: "Datos insuficientes",
      message:
        "Falta historial de temperatura y movimiento para emitir un veredicto confiable.",
      progress: 0,
      activity: 1,
      wineTemp,
      ambientTemp,
      delta,
      ph,
      etaText: null,
      basis: `${envPts.length} lectura(s) de zona y ${mpuPts.length} lectura(s) MPU en ${spanHours.toFixed(1)} h.`,
      sampleCount: envPts.length + mpuPts.length,
      spanHours,
    };
  }

  const envActivity = envActivityOf(envPts);
  const mpuActivity = mpuActivityOf(mpuPts);
  const activity = clamp01(Math.max(envActivity, mpuActivity));
  const timeProgress = clamp01(spanHours / FP.minCompletedHours);
  const progress = clamp01((1 - activity) * 0.75 + timeProgress * 0.25);
  const enoughTime = spanHours >= FP.minCompletedHours;
  const quietEnough = spanHours >= FP.quietHours && mpuActivity <= FP.readyActivity;
  const stableTemperature = envActivity <= FP.readyActivity;

  const mid = firstTime + spanMs / 2;
  const firstHalf = envPts.filter((p) => p.t <= mid);
  const secondHalf = envPts.filter((p) => p.t > mid);
  let etaText: string | null = null;
  if (firstHalf.length >= 2 && secondHalf.length >= 2) {
    const a1 = envActivityOf(firstHalf);
    const a2 = envActivityOf(secondHalf);
    const ratePerHour = (a2 - a1) / Math.max(spanHours / 2, 0.1);
    if (activity > FP.readyActivity && ratePerHour < -0.005) {
      const hoursLeft = (activity - FP.readyActivity) / -ratePerHour;
      etaText = `${formatHours(hoursLeft)} para estabilizarse`;
    }
  }

  let verdict: FermentationVerdict;
  let title: string;
  let message: string;
  if (activity >= FP.activeActivity) {
    verdict = "active";
    title = "Fermentación activa";
    message =
      "El MPU6050 o las variables del proceso siguen variando; no hay estabilidad suficiente.";
  } else if (quietEnough && stableTemperature && enoughTime) {
    verdict = "ready";
    title = "Fermentación probablemente completada";
    message =
      "El movimiento, la temperatura del vino y las métricas válidas se mantuvieron estables durante el tiempo mínimo.";
  } else if (quietEnough && stableTemperature) {
    verdict = "finishing";
    title = "Fermentación estabilizándose";
    message =
      "El MPU6050 está quieto y la temperatura se mantiene estable, pero aún falta cumplir el tiempo mínimo.";
  } else {
    verdict = "finishing";
    title = "Fermentación estabilizándose";
    message =
      "La actividad está bajando, pero todavía no hay evidencia suficiente para considerarla completada.";
  }

  const deltaText =
    delta !== null
      ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} °C vs ambiente`
      : "sin ambiente";
  const phText = ph !== null ? `pH válido ${ph.toFixed(2)}` : "pH no usado";
  const basis =
    `Vino ${wineTemp?.toFixed(1)} °C (${deltaText}), ${phText}. ` +
    `Actividad zona ${(envActivity * 100).toFixed(0)} %, MPU ${(mpuActivity * 100).toFixed(0)} %, ` +
    `${spanHours.toFixed(1)} h (${envPts.length} zona, ${mpuPts.length} MPU).`;

  return {
    verdict,
    title,
    message,
    progress,
    activity,
    wineTemp,
    ambientTemp,
    delta,
    ph,
    etaText,
    basis,
    sampleCount: envPts.length + mpuPts.length,
    spanHours,
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

const DASHBOARD_DOMAIN_ALERTS_ENABLED = false;
const LDR_DARK_THRESHOLD = 1500;
const LDR_SATURATED = 4000;

// ── Helpers internos ──────────────────────────────────────────────────────────

function isOnline(lastSeenIso: string | null): boolean {
  if (!lastSeenIso) return false;
  return Date.now() - new Date(lastSeenIso).getTime() < ONLINE_WINDOW_MS;
}

function minutesAgo(isoStr: string | null): number | null {
  if (!isoStr) return null;
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 60_000);
}

function formatMetricValue(value: number, digits: number, unit: string): string {
  const formatted = value.toFixed(digits);
  return unit ? `${formatted} ${unit}` : formatted;
}

function metricAlert(
  metric: ReadingMetric,
  value: number | null,
  deviceId: string,
  lastSeenIso: string,
): AlertEvent | null {
  if (value === null || Number.isNaN(value)) return null;
  const meta = METRICS[metric];

  if (meta.alertBelow !== undefined && value < meta.alertBelow) {
    return {
      id: `${metric}-alert-low`,
      device_id: deviceId,
      metric,
      level: "danger",
      message: `${meta.label} por debajo del limite critico (${formatMetricValue(value, meta.digits, meta.unit)} < ${formatMetricValue(meta.alertBelow, meta.digits, meta.unit)})`,
      value,
      created_at: lastSeenIso,
    };
  }
  if (meta.warnBelow !== undefined && value < meta.warnBelow) {
    return {
      id: `${metric}-warn-low`,
      device_id: deviceId,
      metric,
      level: "warning",
      message: `${meta.label} baja (${formatMetricValue(value, meta.digits, meta.unit)} < ${formatMetricValue(meta.warnBelow, meta.digits, meta.unit)})`,
      value,
      created_at: lastSeenIso,
    };
  }
  if (meta.alertAbove !== undefined && value > meta.alertAbove) {
    return {
      id: `${metric}-alert`,
      device_id: deviceId,
      metric,
      level: "danger",
      message: `${meta.label} por encima del límite crítico (${formatMetricValue(value, meta.digits, meta.unit)} > ${formatMetricValue(meta.alertAbove, meta.digits, meta.unit)})`,
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
      message: `${meta.label} elevada (${formatMetricValue(value, meta.digits, meta.unit)} > ${formatMetricValue(meta.warnAbove, meta.digits, meta.unit)})`,
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

  // "Sin datos por más de 10 min" NO es una de las 5 alertas oficiales.
  // Se mantiene como info (visible en la lista, pero NO escala el estado global
  // a danger/warning y NO se manda por WhatsApp).
  if (!envOnline) {
    alerts.push({
      id: "offline-env",
      device_id: "esp32_nivel_2_001",
      metric: "offline",
      level: "info",
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
      level: "info",
      message:
        "ESP32 MPU6050 sin señal — movimiento y vibración no disponibles",
      value: null,
      created_at: mpuLastSeen ?? new Date().toISOString(),
    });
  }

  // ── Métricas de ambiente ────────────────────────────────────────────────
  // Sólo se generan alertas oficiales para wine_temperature, light y ph.
  // ambient_temperature y ambient_humidity ya no son alertas oficiales; sólo se
  // calcula sensorStatuses para mantener el coloreado de las tarjetas del
  // dashboard tal como estaba (decisión del usuario para la demo).
  const envSensorMetrics: ReadingMetric[] = [
    "ambient_temperature",
    "ambient_humidity",
    "wine_temperature",
    "light",
    "ph",
  ];
  const envAlertMetrics: ReadingMetric[] = [
    "wine_temperature",
    "light",
    "ph",
  ];

  if (envLatest && envLastSeen) {
    for (const m of envSensorMetrics) {
      const val  = toNumber(envLatest[m]);
      const meta = METRICS[m];

      let status: import("./devices").MetricStatus = "normal";
      if (val !== null) {
        // pH=0 = sensor desconectado → no contamos como alerta (regla oficial).
        const isPhMissing = m === "ph" && val === 0;
        if (!isPhMissing) {
          if (
            (meta.alertBelow !== undefined && val < meta.alertBelow) ||
            (meta.alertAbove !== undefined && val > meta.alertAbove)
          )
            status = "alert";
          else if (
            (meta.warnBelow !== undefined && val < meta.warnBelow) ||
            (meta.warnAbove !== undefined && val > meta.warnAbove)
          )
            status = "warning";
        }
      }
      sensorStatuses[m] = status;

      // Sólo emitir alertas para las métricas oficiales (#1-#4).
      if (!envAlertMetrics.includes(m)) continue;
      // pH=0 = sensor desconectado, no es alerta oficial.
      if (m === "ph" && val === 0) continue;
      const a = metricAlert(m, val, envLatest.device_id, envLastSeen);
      if (a) alerts.push(a);
    }

    // Vino: comprobación bilateral (frío + caliente) basada en etapas
    const wineVal = toNumber(envLatest.wine_temperature);
    const wineAssess = evaluateWineStage(wineVal);
    if (
      DASHBOARD_DOMAIN_ALERTS_ENABLED &&
      wineVal !== null &&
      wineAssess.status !== "normal"
    ) {
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
    if (DASHBOARD_DOMAIN_ALERTS_ENABLED && ldrVal !== null) {
      if (ldrVal < LDR_DARK_THRESHOLD) {
        alerts.push({
          id: "light-dark",
          device_id: envLatest.device_id,
          metric: "light",
          level: "warning",
          message: `Luminosidad baja (${ldrVal} ADC) — posible exposición inadecuada de la cuba`,
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
          message: `Luminosidad muy alta (${ldrVal} ADC) — luz directa puede afectar la fermentación`,
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
    const gyroMetrics: ReadingMetric[] = ["gyro_x", "gyro_y", "gyro_z"];
    for (const m of gyroMetrics) {
      const val = toNumber(mpuLatest[m]);
      const meta = METRICS[m];
      if (
        val !== null &&
        ((meta.warnBelow !== undefined && val < meta.warnBelow) ||
          (meta.warnAbove !== undefined && val > meta.warnAbove))
      ) {
        sensorStatuses[m] = "warning";
      } else {
        sensorStatuses[m] = "normal";
      }

      const a = metricAlert(m, val, mpuLatest.device_id, mpuLastSeen);
      if (a) alerts.push(a);
    }

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

    // Anomalías de accel_z fueron retiradas: no son una de las 5 alertas oficiales.
    // El valor sigue disponible en el dashboard como dato informativo.
  }

  // ── Deduplicar y ordenar alertas ────────────────────────────────────────
  const seen = new Set<string>();
  const uniqueAlerts = alerts.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
  const levelOrder: Record<string, number> = { danger: 0, warning: 1, info: 2 };
  uniqueAlerts.sort((a, b) => (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9));

  // ── Estado general ───────────────────────────────────────────────────────
  const hasDanger  = uniqueAlerts.some((a) => a.level === "danger");
  const hasWarning = uniqueAlerts.some((a) => a.level === "warning");

  let overall: SystemStatus;
  let summary: string;
  let detail: string;

  // Las 5 alertas oficiales son las únicas que escalan el estado global.
  // Offline ya no es alerta principal; sólo se refleja como warn si encima
  // no hay ningún dato de las alertas oficiales.
  if (hasDanger) {
    overall = "error";
    summary = "Condición crítica activa";
    detail  = "Hay una o más alertas críticas que requieren atención inmediata.";
  } else if (hasWarning) {
    overall = "warn";
    summary = "Fermentación en curso con advertencias";
    detail  = "El proceso continúa, pero existen condiciones fuera del rango óptimo.";
  } else if (!envOnline && !mpuOnline) {
    overall = "warn";
    summary = "Sin conexión con los sensores";
    detail  = "Ningún dispositivo está enviando datos. Verificar conectividad.";
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
