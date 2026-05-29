"use client";

/**
 * app/estado/page.tsx
 *
 * Pantalla "Estado" — resumen visual rápido del proceso de fermentación.
 * Datos en tiempo real desde Supabase vía useReadings().
 */

import { useMemo } from "react";
import { DEVICE_IDS, METRICS, DEVICES } from "@/lib/devices";
import { toNumber, toBool, formatNumber } from "@/lib/format";
import { evaluateFermentationStatus } from "@/lib/status";
import { useReadings } from "@/lib/useReadings";
import { useNow } from "@/lib/useNow";
import type { Reading } from "@/lib/types";

import { PageShell, Panel, EmptyState, ErrorState } from "@/app/components/page-shell";
import {
  StatusBanner,
  SensorRow,
  AlertItem,
  DeviceChip,
  WineTempGauge,
} from "@/app/components/status-cards";

// Ventana de fetch — 30 min para que el sparkline del vino tenga puntos suficientes.
// La detección online sigue usando ONLINE_WINDOW_MS (10 min) sobre el last_seen.
const FETCH_WINDOW_MS = 30 * 60 * 1000;

export default function EstadoPage() {
  const now = useNow(30_000);
  const since = useMemo(
    () => (now ? new Date(now - FETCH_WINDOW_MS) : undefined),
    [now],
  );

  const { readings, loading, error, lastUpdate } = useReadings({
    deviceIds: DEVICE_IDS,
    since,
    limit: 500,
    realtime: true,
  });

  const envReadings = useMemo(
    () => readings.filter((r) => r.device_id === "esp32_nivel_2_001"),
    [readings],
  );
  const envLatest: Reading | null = envReadings[0] ?? null;
  const mpuLatest: Reading | null =
    readings.find((r) => r.device_id === "esp32_nivel_2_mpu_001") ?? null;

  // Historial de temp. del vino (orden cronológico: viejo → nuevo)
  const wineHistory = useMemo(() => {
    return envReadings
      .slice()
      .reverse()
      .map((r) => toNumber(r.wine_temperature))
      .filter((v): v is number => v !== null);
  }, [envReadings]);

  const ambientTemperature = envLatest
    ? toNumber(envLatest.ambient_temperature)
    : null;

  const status = useMemo(
    () => evaluateFermentationStatus(envLatest, mpuLatest),
    [envLatest, mpuLatest],
  );

  const envDevice = DEVICES.find((d) => d.id === "esp32_nivel_2_001")!;
  const mpuDevice = DEVICES.find((d) => d.id === "esp32_nivel_2_mpu_001")!;

  const isLive = !error && readings.length > 0;

  return (
    <PageShell
      title="Estado"
      subtitle="Resumen del estado actual del proceso de fermentación"
    >
      {error && <ErrorState message={error} />}

      {loading && readings.length === 0 && !error && (
        <div className="mb-6">
          <EmptyState title="Cargando datos…" hint="Conectando con Supabase" />
        </div>
      )}

      {/* ── Banner principal de estado ─────────────────────────────────── */}
      <div className="mb-5">
        <StatusBanner
          overall={status.overall}
          summary={status.summary}
          detail={status.detail}
          alertCount={status.alerts.length}
        />
      </div>

      {/* ── Marca destacada de la temperatura del vino ─────────────────── */}
      <div className="mb-6">
        <WineTempGauge
          wine={status.wine}
          lastSeenIso={envLatest?.created_at ?? null}
          history={wineHistory}
          ambientTemperature={ambientTemperature}
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
              {isLive
                ? "Supabase · suscripción en tiempo real"
                : loading
                  ? "Conectando con Supabase…"
                  : error
                    ? "Error de conexión — revisa la consola"
                    : "Sin lecturas en los últimos 10 min"}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLive
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                    : error
                      ? "bg-red-500"
                      : "bg-amber-400"
                }`}
              />
              <span
                className={`text-[11px] ${
                  isLive
                    ? "text-emerald-300/80"
                    : error
                      ? "text-red-300/80"
                      : "text-amber-300/70"
                }`}
              >
                {isLive
                  ? lastUpdate
                    ? `actualizado ${lastUpdate.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                    : "en vivo"
                  : error
                    ? "desconectado"
                    : "esperando datos"}
              </span>
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
