"use client";

import { useMemo } from "react";
import { buildAlerts } from "@/lib/alerts";
import { DEVICE_IDS } from "@/lib/devices";
import { useReadings } from "@/lib/useReadings";
import { useNow } from "@/lib/useNow";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { AlertEvent, AlertLevel } from "@/lib/types";
import {
  EmptyState,
  ErrorState,
  Panel,
  PageShell,
} from "../components/page-shell";

const LEVEL_STYLE: Record<
  AlertLevel,
  { dot: string; pill: string; label: string }
> = {
  info: {
    dot: "bg-sky-400",
    pill: "bg-sky-500/15 text-sky-200",
    label: "Info",
  },
  warning: {
    dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
    pill: "bg-amber-500/15 text-amber-200",
    label: "Advertencia",
  },
  danger: {
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse-dot",
    pill: "bg-red-500/15 text-red-300",
    label: "Alerta",
  },
};

export default function AlertasPage() {
  const now = useNow(60_000);
  const since = useMemo(
    () => (now ? new Date(now - 7 * 24 * 60 * 60 * 1000) : undefined),
    [now],
  );
  const { readings, loading, error } = useReadings({
    deviceIds: DEVICE_IDS,
    since,
    limit: 5000,
    realtime: true,
  });

  const events = buildAlerts(readings, now || undefined);
  const counts = {
    danger: events.filter((e) => e.level === "danger").length,
    warning: events.filter((e) => e.level === "warning").length,
  };

  return (
    <PageShell
      title="Alertas"
      subtitle="Eventos donde los valores superaron los umbrales definidos"
    >
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Alertas críticas" value={counts.danger} color="#ef4444" />
        <Stat label="Advertencias" value={counts.warning} color="#f59e0b" />
        <Stat label="Lecturas analizadas" value={readings.length} color="#2dd4bf" />
      </div>

      {error && <ErrorState message={error} />}

      {loading && events.length === 0 && !error && (
        <EmptyState title="Cargando alertas…" />
      )}

      {!loading && events.length === 0 && !error && (
        <EmptyState
          title="Todo en orden"
          hint="No hay alertas en los últimos 7 días"
        />
      )}

      {events.length > 0 && (
        <Panel title={`Eventos (${events.length})`}>
          <ul className="space-y-2">
            {events.map((e) => (
              <AlertRow key={e.id} event={e} />
            ))}
          </ul>
        </Panel>
      )}
    </PageShell>
  );
}

function AlertRow({ event }: { event: AlertEvent }) {
  const meta = LEVEL_STYLE[event.level];
  return (
    <li className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-black/20 px-4 py-3">
      <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-white">{event.message}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.pill}`}>
            {meta.label}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-white/45">
          <span className="font-mono">{event.device_id}</span>
          {" · "}
          {event.metric}
          {" · "}
          {formatDateTime(event.created_at)}
          {" · "}
          {formatRelative(event.created_at)}
        </p>
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
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
      <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
        {value.toLocaleString("es-BO")}
      </p>
    </div>
  );
}
