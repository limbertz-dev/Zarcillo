"use client";

import { Sparkline } from "./sparkline";
import { formatRelative } from "@/lib/format";
import type { MetricStatus } from "@/lib/devices";

type Props = {
  title: string;
  value: string;
  unit: string;
  color: string;
  history: number[];
  status: MetricStatus;
  lastSeenIso?: string | null;
  icon?: React.ReactNode;
  highlight?: boolean;
};

const statusDot: Record<MetricStatus, string> = {
  normal: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  warning: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]",
  alert: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse-dot",
};

const statusLabel: Record<MetricStatus, string> = {
  normal: "Normal",
  warning: "Advertencia",
  alert: "Alerta",
};

export function MetricCard({
  title,
  value,
  unit,
  color,
  history,
  status,
  lastSeenIso,
  icon,
  highlight,
}: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#1a1a2e] p-4 backdrop-blur-sm transition ${
        highlight ? "ring-1 ring-[#ec4899]/40" : ""
      }`}
      style={{
        backgroundImage: `radial-gradient(circle at 100% 0%, ${color}1a, transparent 55%)`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            {icon ?? <DotIcon />}
          </span>
          <div className="leading-tight">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/55">
              {title}
            </p>
            <p className="text-[10px] text-white/35">
              {lastSeenIso ? formatRelative(lastSeenIso) : "sin datos"}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/60`}
          title={statusLabel[status]}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot[status]}`} />
          {statusLabel[status]}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-tight text-white">
            {value}
          </span>
          <span className="text-xs font-medium text-white/55">{unit}</span>
        </div>
        <Sparkline values={history} color={color} variant="bars" />
      </div>
    </div>
  );
}

function DotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}
