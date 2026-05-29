"use client";

/**
 * app/estado/page.tsx
 *
 * Pantalla "Estado" — resumen visual rápido del proceso de fermentación.
 *
 * ─── MIGRACIÓN A DATOS REALES ───────────────────────────────────────────────
 * Esta pantalla usa datos mockeados. Para conectar a Supabase en tiempo real:
 *
 * 1. Reemplazar las constantes MOCK_* por el hook useReadings:
 *
 *      const { readings, loading, error } = useReadings({
 *        deviceIds: DEVICE_IDS,
 *        since: new Date(Date.now() - 10 * 60 * 1000), // últimos 10 min
 *        limit: 10,
 *        realtime: true,
 *      });
 *      const envLatest = readings.find(r => r.device_id === "esp32_nivel_2_001") ?? null;
 *      const mpuLatest = readings.find(r => r.device_id === "esp32_nivel_2_mpu_001") ?? null;
 *
 * 2. Eliminar las constantes MOCK_ENV_READING y MOCK_MPU_READING.
 * 3. Descomentar el bloque de loading/error en el JSX.
 *
 * Todo lo demás (evaluateFermentationStatus, componentes, layout) permanece igual.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useMemo } from "react";
import { METRICS, DEVICES } from "@/lib/devices";
import { toNumber, toBool, formatNumber } from "@/lib/format";
import { evaluateFermentationStatus } from "@/lib/status";
import type { Reading } from "@/lib/types";

import { PageShell, Panel, EmptyState } from "@/app/components/page-shell";
import {
  StatusBanner,
  SensorRow,
  AlertItem,
  DeviceChip,
} from "@/app/components/status-cards";

// ─── Datos mockeados ─────────────────────────────────────────────────────────
// Simulan la estructura exacta que llega desde Supabase vía useReadings().
// Ajusta los valores para probar distintos estados del sistema.

const NOW_ISO = new Date().toISOString();

const MOCK_ENV_READING: Reading = {
  device_id: "esp32_nivel_2_001",
  level: "nivel_2",
  created_at: NOW_ISO,
  ambient_temperature: 24.6,   // cambiar a >30 para probar estado "crítico"
  ambient_humidity: 72.3,
  wine_temperature: 23.4,      // cambiar a >28 para probar alerta de vino
  light: 620,                  // <1500 = oscuro (warn) | >4000 = saturado (warn)
  accel_x: null,
  accel_y: null,
  accel_z: null,
  gyro_x: null,
  gyro_y: null,
  gyro_z: null,
  movement: null,
};

const MOCK_MPU_READING: Reading = {
  device_id: "esp32_nivel_2_mpu_001",
  level: "nivel_2",
  created_at: NOW_ISO,
  ambient_temperature: null,
  ambient_humidity: null,
  wine_temperature: null,
  light: null,
  accel_x: 0.02,
  accel_y: -0.01,
  accel_z: 0.98,
  gyro_x: 0.12,
  gyro_y: -0.08,
  gyro_z: 0.03,
  movement: false,             // cambiar a true para probar alerta de movimiento
};

// ─── Página ──────────────────────────────────────────────────────────────────

export default function EstadoPage() {
  // ── Con datos reales, reemplazar estas dos líneas por useReadings() ───────
  const envLatest: Reading | null = MOCK_ENV_READING;
  const mpuLatest: Reading | null = MOCK_MPU_READING;
  // ─────────────────────────────────────────────────────────────────────────

  const status = useMemo(
    () => evaluateFermentationStatus(envLatest, mpuLatest),
    [envLatest, mpuLatest],
  );

  const envDevice  = DEVICES.find((d) => d.id === "esp32_nivel_2_001")!;
  const mpuDevice  = DEVICES.find((d) => d.id === "esp32_nivel_2_mpu_001")!;

  return (
    <PageShell
      title="Estado"
      subtitle="Resumen del estado actual del proceso de fermentación"
    >
      {/* ── Banner principal de estado ─────────────────────────────────── */}
      <div className="mb-6">
        <StatusBanner
          overall={status.overall}
          summary={status.summary}
          detail={status.detail}
          alertCount={status.alerts.length}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* ── Columna izquierda + centro (2/3) ─────────────────────────── */}
        <div className="flex flex-col gap-5 xl:col-span-2">

          {/* Alertas activas */}
          <Panel
            title="Alertas activas"
            subtitle={
              status.alerts.length === 0
                ? "Sin alertas en este momento"
                : `${status.alerts.length} condición${status.alerts.length > 1 ? "es" : ""} fuera del rango normal`
            }
          >
            {status.alerts.length === 0 ? (
              <EmptyState
                title="Todo en orden"
                hint="No hay alertas activas. Todos los parámetros están dentro de los rangos normales."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {status.alerts.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} />
                ))}
              </div>
            )}
          </Panel>

          {/* Sensores de ambiente */}
          <Panel
            title="Sensores de ambiente y vino"
            subtitle={envDevice.label}
          >
            <div className="flex flex-col">
              {(["ambient_temperature", "ambient_humidity", "wine_temperature", "light"] as const).map((m) => {
                const meta = METRICS[m];
                const raw  = envLatest ? toNumber(envLatest[m]) : null;
                const formatted =
                  raw !== null ? formatNumber(raw, meta.digits) : null;
                return (
                  <SensorRow
                    key={m}
                    label={meta.label}
                    value={formatted}
                    unit={meta.unit}
                    status={status.sensorStatuses[m] ?? "normal"}
                    color={meta.color}
                    lastSeenIso={envLatest?.created_at ?? null}
                  />
                );
              })}
            </div>
          </Panel>

          {/* Sensores MPU */}
          <Panel
            title="Sensores de movimiento y vibración"
            subtitle={mpuDevice.label}
          >
            <div className="flex flex-col">
              {/* Movimiento detectado */}
              <SensorRow
                label="Movimiento detectado"
                value={mpuLatest ? (toBool(mpuLatest.movement) ? "SÍ" : "NO") : null}
                unit=""
                status={
                  mpuLatest && toBool(mpuLatest.movement) ? "alert" : "normal"
                }
                color="#ec4899"
                lastSeenIso={mpuLatest?.created_at ?? null}
              />
              {(["accel_x", "accel_z", "gyro_x"] as const).map((m) => {
                const meta = METRICS[m];
                const raw  = mpuLatest ? toNumber(mpuLatest[m]) : null;
                const formatted =
                  raw !== null ? formatNumber(raw, meta.digits) : null;
                return (
                  <SensorRow
                    key={m}
                    label={meta.label}
                    value={formatted}
                    unit={meta.unit}
                    status={status.sensorStatuses[m] ?? "normal"}
                    color={meta.color}
                    lastSeenIso={mpuLatest?.created_at ?? null}
                  />
                );
              })}
            </div>
          </Panel>
        </div>

        {/* ── Columna derecha (1/3) ─────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Conectividad */}
          <Panel title="Conectividad" subtitle="Estado de los dispositivos">
            <div className="flex flex-col gap-2">
              {status.devices.map((device) => (
                <DeviceChip key={device.deviceId} device={device} />
              ))}
            </div>
          </Panel>

          {/* Semáforo de parámetros */}
          <Panel title="Parámetros clave" subtitle="Indicadores rápidos">
            <div className="grid grid-cols-2 gap-3">
              <QuickIndicator
                label="Temp. Ambiente"
                value={envLatest ? toNumber(envLatest.ambient_temperature) : null}
                unit="°C"
                digits={1}
                alertAbove={30}
                warnAbove={27}
                color="#ef4444"
              />
              <QuickIndicator
                label="Temp. Vino"
                value={envLatest ? toNumber(envLatest.wine_temperature) : null}
                unit="°C"
                digits={1}
                alertAbove={28}
                warnAbove={25}
                color="#f97316"
              />
              <QuickIndicator
                label="Humedad"
                value={envLatest ? toNumber(envLatest.ambient_humidity) : null}
                unit="%"
                digits={1}
                alertAbove={85}
                warnAbove={78}
                color="#3b82f6"
              />
              <QuickIndicator
                label="Luminosidad"
                value={envLatest ? toNumber(envLatest.light) : null}
                unit="lux"
                digits={0}
                alertAbove={4000}
                warnAbove={800}
                color="#eab308"
              />
            </div>
          </Panel>

          {/* Nota de datos */}
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
              Fuente de datos
            </p>
            <p className="mt-1 text-xs text-white/45">
              {/* Cambiar este mensaje al migrar a datos reales */}
              Datos simulados · Listo para conectar con Supabase en tiempo real
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="text-[11px] text-amber-300/70">Modo demo</span>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ─── Indicador rápido (semáforo compacto) ────────────────────────────────────

function QuickIndicator({
  label,
  value,
  unit,
  digits,
  alertAbove,
  warnAbove,
  color,
}: {
  label: string;
  value: number | null;
  unit: string;
  digits: number;
  alertAbove: number;
  warnAbove: number;
  color: string;
}) {
  const status =
    value === null
      ? "normal"
      : value > alertAbove
        ? "alert"
        : value > warnAbove
          ? "warning"
          : "normal";

  const ringColor =
    status === "alert"
      ? "ring-red-500/50"
      : status === "warning"
        ? "ring-amber-500/40"
        : "ring-emerald-500/25";

  const dotColor =
    status === "alert"
      ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)] animate-pulse-dot"
      : status === "warning"
        ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
        : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#12121a] p-3 ring-1 ${ringColor}`}
      style={{
        backgroundImage: `radial-gradient(circle at 100% 0%, ${color}18, transparent 65%)`,
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">
          {label}
        </p>
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      </div>
      <p className="mt-2 font-mono text-xl font-semibold text-white">
        {value !== null ? formatNumber(value, digits) : "—"}
        <span className="ml-1 text-xs font-normal text-white/40">{unit}</span>
      </p>
    </div>
  );
}
