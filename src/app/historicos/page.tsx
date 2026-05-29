"use client";

import { useMemo, useState } from "react";
import { DEVICES, METRICS, getDevice } from "@/lib/devices";
import { useReadings } from "@/lib/useReadings";
import { useNow } from "@/lib/useNow";
import {
  formatDateTime,
  formatNumber,
  toNumber,
} from "@/lib/format";
import type { DeviceId, ReadingMetric } from "@/lib/types";
import { LineChart } from "../components/line-chart";
import {
  EmptyState,
  ErrorState,
  Panel,
  PageShell,
} from "../components/page-shell";

export default function HistoricosPage() {
  const now = useNow(60_000);
  const today = now ? new Date(now).toISOString().slice(0, 10) : "";
  const weekAgo = now
    ? new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : "";

  const [deviceId, setDeviceId] = useState<DeviceId>("esp32_nivel_2_001");
  const [metric, setMetric] = useState<ReadingMetric>("ambient_temperature");
  const [fromState, setFromState] = useState<string | null>(null);
  const [toState, setToState] = useState<string | null>(null);
  const from = fromState ?? weekAgo;
  const to = toState ?? today;

  const device = getDevice(deviceId)!;
  const availableMetrics = device.metrics;
  const activeMetric = availableMetrics.includes(metric)
    ? metric
    : availableMetrics[0];

  const since = useMemo(
    () => (from ? new Date(`${from}T00:00:00`) : undefined),
    [from],
  );
  const until = useMemo(
    () => (to ? new Date(`${to}T23:59:59`) : undefined),
    [to],
  );
  const rangeMs =
    since && until ? until.getTime() - since.getTime() : 24 * 60 * 60 * 1000;

  const { readings, loading, error } = useReadings({
    deviceIds: [deviceId],
    since,
    until,
    limit: 5000,
  });

  const meta = METRICS[activeMetric];

  const series = readings
    .slice()
    .reverse()
    .map((r) => ({
      t: r.created_at,
      [activeMetric]: toNumber(r[activeMetric]),
    }));

  const stats = (() => {
    const values = readings
      .map((r) => toNumber(r[activeMetric]))
      .filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      count: readings.length,
    };
  })();

  return (
    <PageShell
      title="Históricos"
      subtitle="Análisis profundo por dispositivo y métrica"
    >
      <Panel className="mb-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dispositivo">
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value as DeviceId)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            >
              {DEVICES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Métrica">
            <select
              value={activeMetric}
              onChange={(e) => setMetric(e.target.value as ReadingMetric)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            >
              {availableMetrics.map((m) => (
                <option key={m} value={m}>
                  {METRICS[m].label} ({METRICS[m].unit})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Desde">
            <input
              type="date"
              value={from}
              onChange={(e) => setFromState(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={to}
              onChange={(e) => setToState(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </Field>
        </div>
      </Panel>

      {error && <ErrorState message={error} />}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Mínimo"
          value={stats ? formatNumber(stats.min, meta.digits) : "—"}
          unit={meta.unit}
          color={meta.color}
        />
        <Stat
          label="Máximo"
          value={stats ? formatNumber(stats.max, meta.digits) : "—"}
          unit={meta.unit}
          color={meta.color}
        />
        <Stat
          label="Promedio"
          value={stats ? formatNumber(stats.avg, meta.digits) : "—"}
          unit={meta.unit}
          color={meta.color}
        />
        <Stat
          label="Lecturas"
          value={stats ? stats.count.toLocaleString("es-BO") : "0"}
          unit=""
          color="#94a3b8"
        />
      </div>

      <Panel title={`${meta.label} — ${device.label}`} className="mb-5">
        {loading && readings.length === 0 ? (
          <EmptyState title="Cargando…" />
        ) : readings.length === 0 ? (
          <EmptyState
            title="Sin datos en el rango"
            hint="Ajusta las fechas o el dispositivo"
          />
        ) : (
          <LineChart
            data={series}
            series={[
              {
                dataKey: activeMetric,
                label: meta.label,
                color: meta.color,
                unit: meta.unit,
                digits: meta.digits,
              },
            ]}
            rangeMs={rangeMs}
            height={340}
          />
        )}
      </Panel>

      {readings.length > 0 && (
        <Panel title={`Datos crudos · ${readings.length} lecturas`}>
          <div className="-mx-5 max-h-[420px] overflow-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="sticky top-0 bg-[#1a1a2e] text-[11px] uppercase tracking-wider text-white/45">
                <tr>
                  <th className="px-5 py-2 font-medium">Timestamp</th>
                  <th className="px-3 py-2 font-medium text-right">
                    {meta.label} ({meta.unit})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {readings.map((r) => {
                  const v = toNumber(r[activeMetric]);
                  return (
                    <tr
                      key={`${r.device_id}-${r.created_at}`}
                      className="hover:bg-white/[0.03]"
                    >
                      <td className="whitespace-nowrap px-5 py-1.5 font-mono text-[11px] text-white/65">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-white/85">
                        {v === null ? "—" : formatNumber(v, meta.digits)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </PageShell>
  );
}

function Stat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-[#1a1a2e]/70 p-4"
      style={{
        backgroundImage: `radial-gradient(circle at 100% 0%, ${color}1a, transparent 60%)`,
      }}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-1 text-2xl font-semibold tracking-tight text-white">
        <span className="tabular-nums">{value}</span>
        {unit && (
          <span className="text-xs font-medium text-white/55">{unit}</span>
        )}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}
