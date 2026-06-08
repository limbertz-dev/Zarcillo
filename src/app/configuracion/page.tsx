"use client";

import { useMemo } from "react";
import { DEVICES, DEVICE_IDS, METRICS } from "@/lib/devices";
import { useReadings } from "@/lib/useReadings";
import { useNow } from "@/lib/useNow";
import { computeDeviceStatus } from "@/lib/status";
import { formatRelative, toNumber, formatNumber } from "@/lib/format";
import { isLampEndpointConfigured } from "@/lib/lamp-control";
import { PageShell, Panel } from "../components/page-shell";

// URL del proyecto Supabase, disponible en build (variable pública)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PROJECT_REF = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");

export default function ConfiguracionPage() {
  const now = useNow(30_000);
  const since = useMemo(
    () => (now ? new Date(now - 15 * 60 * 1000) : undefined),
    [now],
  );

  const { readings, loading, lastUpdate } = useReadings({
    deviceIds: DEVICE_IDS,
    since,
    limit: 200,
    realtime: true,
  });

  const deviceStatuses = useMemo(
    () => computeDeviceStatus(readings, now ?? Date.now()),
    [readings, now],
  );

  // Última lectura por dispositivo
  const lastByDevice = useMemo(() => {
    const map: Record<string, (typeof readings)[0]> = {};
    for (const r of readings) {
      if (!map[r.device_id]) map[r.device_id] = r;
    }
    return map;
  }, [readings]);

  const lampConfigured = isLampEndpointConfigured();

  return (
    <PageShell
      title="Configuración"
      subtitle="Estado del sistema, dispositivos y umbrales de alerta"
    >
      <div className="grid grid-cols-1 gap-5">

        {/* ── Estado del sistema ─────────────────────────────────────── */}
        <Panel
          title="Estado del sistema"
          subtitle={
            loading
              ? "Consultando Supabase…"
              : lastUpdate
                ? `Actualizado ${formatRelative(lastUpdate.toISOString(), now ?? Date.now())}`
                : "Sin datos aún"
          }
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

            {/* Conexión Supabase */}
            <SystemBlock title="Base de datos" icon={<DbIcon />}>
              <InfoRow label="Proyecto" value={SUPABASE_PROJECT_REF || "—"} mono />
              <InfoRow
                label="URL"
                value={SUPABASE_URL ? SUPABASE_URL.replace("https://", "") : "—"}
                mono
                truncate
              />
              <InfoRow
                label="Estado"
                value={readings.length > 0 ? "Conectado" : loading ? "Conectando…" : "Sin lecturas"}
                badge={readings.length > 0 ? "ok" : loading ? "loading" : "warn"}
              />
              <InfoRow
                label="Lecturas (15 min)"
                value={readings.length > 0 ? `${readings.length} registros` : "—"}
              />
            </SystemBlock>

            {/* Dispositivos ESP32 */}
            <SystemBlock title="Dispositivos ESP32" icon={<ChipIcon />}>
              {deviceStatuses.map((ds) => {
                const device = DEVICES.find((d) => d.id === ds.deviceId);
                const last = lastByDevice[ds.deviceId];
                const wineTemp = last ? toNumber(last.wine_temperature) : null;
                const ambTemp = last ? toNumber(last.ambient_temperature) : null;
                return (
                  <div
                    key={ds.deviceId}
                    className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            ds.online ? "bg-emerald-400" : "bg-red-400/70"
                          }`}
                        />
                        <p className="truncate text-xs font-medium text-white">
                          {device?.label ?? ds.deviceId}
                        </p>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-white/40">
                        {ds.deviceId}
                      </p>
                      {last && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {wineTemp !== null && (
                            <span className="text-[10px] text-white/50">
                              Vino {formatNumber(wineTemp, 1)} °C
                            </span>
                          )}
                          {ambTemp !== null && (
                            <span className="text-[10px] text-white/50">
                              Amb {formatNumber(ambTemp, 1)} °C
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          ds.online
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {ds.online ? "Online" : "Offline"}
                      </span>
                      {ds.lastSeen && (
                        <p className="mt-1 text-[10px] text-white/35">
                          {formatRelative(ds.lastSeen, now ?? Date.now())}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </SystemBlock>

            {/* Integraciones externas */}
            <SystemBlock title="Integraciones" icon={<LinkIcon />}>
              <InfoRow
                label="Control lámpara"
                value={lampConfigured ? "FlowFuse Cloud" : "No configurado"}
                badge={lampConfigured ? "ok" : "warn"}
              />
              <InfoRow
                label="Análisis IA"
                value="OpenRouter (modelo free)"
                badge="info"
              />
              <InfoRow
                label="Alertas WhatsApp"
                value="Twilio Sandbox"
                badge="info"
              />
              <InfoRow
                label="Sandbox Twilio"
                value="Expira ~72 h · renovar en +1 415 523 8886"
                badge="warn"
              />
            </SystemBlock>
          </div>
        </Panel>

        {/* ── Dispositivos y métricas ────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title="Dispositivos registrados">
            <ul className="space-y-3">
              {DEVICES.map((d) => (
                <li
                  key={d.id}
                  className="rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{d.label}</p>
                      <p className="font-mono text-[11px] text-white/55">{d.id}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-white/40">
                        {d.metrics.length} métricas · nivel 2 ·{" "}
                        {d.kind === "environment" ? "ambiente + vino" : "MPU6050"}
                      </p>
                    </div>
                    {/* Estado en vivo */}
                    {(() => {
                      const ds = deviceStatuses.find((s) => s.deviceId === d.id);
                      if (!ds) return null;
                      return (
                        <span
                          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                            ds.online
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              ds.online ? "bg-emerald-400" : "bg-red-400"
                            }`}
                          />
                          {ds.online ? "Online" : "Offline"}
                        </span>
                      );
                    })()}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Umbrales de alerta">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-white/45">
                <tr>
                  <th className="pb-2 font-medium">Métrica</th>
                  <th className="pb-2 font-medium text-right">Advertencia</th>
                  <th className="pb-2 font-medium text-right">Alerta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-white/85">
                {Object.values(METRICS).map((m) => (
                  <tr key={m.key}>
                    <td className="py-2">
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ backgroundColor: m.color }}
                      />
                      {m.label}
                    </td>
                    <td className="py-2 text-right tabular-nums text-white/70">
                      {formatThreshold(m.warnBelow, m.warnAbove, m.unit)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-white/70">
                      {formatThreshold(m.alertBelow, m.alertAbove, m.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatThreshold(
  below: number | undefined,
  above: number | undefined,
  unit: string,
): string {
  const parts: string[] = [];
  if (below !== undefined) parts.push(`< ${below} ${unit}`.trim());
  if (above !== undefined) parts.push(`> ${above} ${unit}`.trim());
  return parts.length > 0 ? parts.join(" o ") : "—";
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SystemBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-white/35">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
          {title}
        </p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  truncate = false,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
  badge?: "ok" | "warn" | "info" | "loading";
}) {
  const badgeClass =
    badge === "ok"
      ? "bg-emerald-500/15 text-emerald-300"
      : badge === "warn"
        ? "bg-amber-500/15 text-amber-200"
        : badge === "info"
          ? "bg-blue-500/15 text-blue-300"
          : badge === "loading"
            ? "bg-white/10 text-white/50"
            : "";

  return (
    <div className="flex items-start justify-between gap-2">
      <p className="shrink-0 text-[11px] text-white/40">{label}</p>
      {badge ? (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}
        >
          {value}
        </span>
      ) : (
        <p
          className={`text-right text-[11px] text-white/75 ${mono ? "font-mono" : ""} ${truncate ? "max-w-[140px] truncate" : ""}`}
          title={truncate ? value : undefined}
        >
          {value}
        </p>
      )}
    </div>
  );
}

// ─── Íconos ───────────────────────────────────────────────────────────────────

function DbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  );
}

function ChipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}