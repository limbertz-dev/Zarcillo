"use client";

import { useMemo, useState } from "react";
import { DEVICES, DEVICE_IDS, getMetricStatus } from "@/lib/devices";
import { useReadings } from "@/lib/useReadings";
import { useNow } from "@/lib/useNow";
import {
  formatDateTime,
  formatNumber,
  toBool,
  toNumber,
} from "@/lib/format";
import { downloadCSV, toCSV } from "@/lib/csv";
import {
  EmptyState,
  ErrorState,
  Panel,
  PageShell,
} from "../components/page-shell";
import type { Reading } from "@/lib/types";

const PAGE_SIZE = 20;

export default function SensoresPage() {
  const now = useNow(60_000);
  const [device, setDevice] = useState<string>("all");
  const [fromState, setFromState] = useState<string | null>(null);
  const [toState, setToState] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const today = now ? new Date(now).toISOString().slice(0, 10) : "";
  const weekAgo = now
    ? new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : "";
  const from = fromState ?? weekAgo;
  const to = toState ?? today;

  const since = useMemo(
    () => (from ? new Date(`${from}T00:00:00`) : undefined),
    [from],
  );
  const until = useMemo(
    () => (to ? new Date(`${to}T23:59:59`) : undefined),
    [to],
  );
  const deviceIds = device === "all" ? DEVICE_IDS : [device];

  const { readings, loading, error } = useReadings({
    deviceIds,
    since,
    until,
    limit: 2000,
    realtime: true,
  });

  const totalPages = Math.max(1, Math.ceil(readings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = readings.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  function exportCsv() {
    const csv = toCSV(readings, [
      { key: "created_at", label: "timestamp" },
      { key: "device_id", label: "device_id" },
      { key: "ambient_temperature", label: "ambient_temperature" },
      { key: "ambient_humidity", label: "ambient_humidity" },
      { key: "wine_temperature", label: "wine_temperature" },
      { key: "light", label: "light" },
      { key: "accel_x", label: "accel_x" },
      { key: "accel_y", label: "accel_y" },
      { key: "accel_z", label: "accel_z" },
      { key: "gyro_x", label: "gyro_x" },
      { key: "gyro_y", label: "gyro_y" },
      { key: "gyro_z", label: "gyro_z" },
      { key: "movement", label: "movement" },
    ]);
    downloadCSV(`zarcillo-readings-${from}_${to}.csv`, csv);
  }

  return (
    <PageShell
      title="Sensores"
      subtitle="Lecturas crudas de los dispositivos ESP32"
      actions={
        <button
          type="button"
          onClick={exportCsv}
          disabled={readings.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <DownloadIcon /> Exportar CSV
        </button>
      }
    >
      <Panel className="mb-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dispositivo">
            <select
              value={device}
              onChange={(e) => {
                setDevice(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            >
              <option value="all">Todos</option>
              {DEVICES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} — {d.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Desde">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFromState(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setToState(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </Field>
          <Field label="Total">
            <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
              <span className="font-semibold text-white">
                {readings.length}
              </span>{" "}
              lecturas en el rango
            </p>
          </Field>
        </div>
      </Panel>

      {error && <ErrorState message={error} />}

      {loading && readings.length === 0 && !error && (
        <EmptyState title="Cargando lecturas…" />
      )}

      {!loading && readings.length === 0 && !error && (
        <EmptyState
          title="Sin lecturas en este rango"
          hint="Ajusta el filtro de fechas o el dispositivo"
        />
      )}

      {readings.length > 0 && (
        <Panel
          title={`Lecturas (${readings.length})`}
          subtitle={`Página ${safePage + 1} de ${totalPages} · 20 por página`}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-30"
              >
                ← Anterior
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-30"
              >
                Siguiente →
              </button>
            </div>
          }
        >
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-white/45">
                <tr>
                  <th className="px-5 py-2 font-medium">Timestamp</th>
                  <th className="px-3 py-2 font-medium">Dispositivo</th>
                  <th className="px-3 py-2 font-medium text-right">Temp Amb</th>
                  <th className="px-3 py-2 font-medium text-right">Humedad</th>
                  <th className="px-3 py-2 font-medium text-right">Temp Vino</th>
                  <th className="px-3 py-2 font-medium text-right">Luz</th>
                  <th className="px-3 py-2 font-medium text-center">Mov.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-white/85">
                {slice.map((r) => (
                  <Row key={`${r.device_id}-${r.created_at}`} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </PageShell>
  );
}

function Row({ r }: { r: Reading }) {
  const ta = toNumber(r.ambient_temperature);
  const hu = toNumber(r.ambient_humidity);
  const tv = toNumber(r.wine_temperature);
  const lu = toNumber(r.light);
  const mov = toBool(r.movement);
  return (
    <tr className="hover:bg-white/[0.03]">
      <td className="whitespace-nowrap px-5 py-2 font-mono text-[11px] text-white/65">
        {formatDateTime(r.created_at)}
      </td>
      <td className="px-3 py-2 text-xs">
        <DeviceTag id={r.device_id} />
      </td>
      <td className="px-3 py-2 text-right">
        <ValueBadge value={ta === null ? "—" : formatNumber(ta, 1)} status={getMetricStatus("ambient_temperature", ta)} unit="°C" />
      </td>
      <td className="px-3 py-2 text-right">
        <ValueBadge value={hu === null ? "—" : formatNumber(hu, 1)} status={getMetricStatus("ambient_humidity", hu)} unit="%" />
      </td>
      <td className="px-3 py-2 text-right">
        <ValueBadge value={tv === null ? "—" : formatNumber(tv, 1)} status={getMetricStatus("wine_temperature", tv)} unit="°C" />
      </td>
      <td className="px-3 py-2 text-right">
        <ValueBadge value={lu === null ? "—" : formatNumber(lu, 0)} status={getMetricStatus("light", lu)} unit="lux" />
      </td>
      <td className="px-3 py-2 text-center">
        {r.movement === null || r.movement === undefined ? (
          <span className="text-white/30">—</span>
        ) : mov ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] font-medium text-pink-300">
            <span className="h-1.5 w-1.5 rounded-full bg-pink-400" /> SÍ
          </span>
        ) : (
          <span className="text-[10px] text-white/40">no</span>
        )}
      </td>
    </tr>
  );
}

function ValueBadge({
  value,
  status,
  unit,
}: {
  value: string;
  status: "normal" | "warning" | "alert";
  unit: string;
}) {
  if (value === "—") return <span className="text-white/30">—</span>;
  const cls =
    status === "alert"
      ? "bg-red-500/15 text-red-300"
      : status === "warning"
        ? "bg-amber-500/15 text-amber-200"
        : "text-white/85";
  const pill = status === "normal" ? "" : "rounded-md px-1.5 py-0.5";
  return (
    <span className={`inline-flex items-baseline gap-1 ${cls} ${pill}`}>
      <span className="tabular-nums">{value}</span>
      <span className="text-[10px] text-white/40">{unit}</span>
    </span>
  );
}

function DeviceTag({ id }: { id: string }) {
  const isMpu = id.includes("mpu");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] ${
        isMpu
          ? "bg-purple-500/15 text-purple-200"
          : "bg-teal-500/15 text-teal-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isMpu ? "bg-purple-400" : "bg-teal-400"}`}
      />
      {id}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m6 11 6 6 6-6" />
      <path d="M5 21h14" />
    </svg>
  );
}
