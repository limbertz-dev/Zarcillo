"use client";

/**
 * app/components/status-cards.tsx
 *
 * Componentes visuales exclusivos de la pantalla /estado.
 * Siguen el mismo sistema de diseño que metric-card.tsx y page-shell.tsx:
 *   · bg-[#1a1a2e], border-white/[0.06], backdrop-blur
 *   · Colores de estado: emerald (ok) / amber (warn) / red (error/alert)
 *   · CSS variables del theme (globals.css)
 */

import { formatRelative, formatNumber } from "@/lib/format";
import type { SystemStatus, AlertEvent } from "@/lib/status";
import type { DeviceOnlineStatus } from "@/lib/status";
import type { MetricStatus } from "@/lib/devices";

// ─── Banner de estado general ────────────────────────────────────────────────

const overallConfig: Record<
  SystemStatus,
  { bg: string; border: string; glow: string; icon: React.ReactNode; label: string }
> = {
  ok: {
    bg: "from-emerald-500/10 to-transparent",
    border: "border-emerald-500/30",
    glow: "shadow-emerald-500/20",
    label: "ÓPTIMO",
    icon: <OkIcon />,
  },
  warn: {
    bg: "from-amber-500/10 to-transparent",
    border: "border-amber-500/30",
    glow: "shadow-amber-500/20",
    label: "ADVERTENCIA",
    icon: <WarnIcon />,
  },
  error: {
    bg: "from-red-500/12 to-transparent",
    border: "border-red-500/40",
    glow: "shadow-red-500/25",
    label: "CRÍTICO",
    icon: <ErrorIcon />,
  },
};

export function StatusBanner({
  overall,
  summary,
  detail,
  alertCount,
}: {
  overall: SystemStatus;
  summary: string;
  detail: string;
  alertCount: number;
}) {
  const cfg = overallConfig[overall];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${cfg.bg} ${cfg.border} shadow-lg ${cfg.glow} p-6`}
    >
      {/* Orbe decorativo de fondo */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            overall === "ok"
              ? "radial-gradient(circle, #10b981, transparent)"
              : overall === "warn"
                ? "radial-gradient(circle, #f59e0b, transparent)"
                : "radial-gradient(circle, #ef4444, transparent)",
        }}
      />

      <div className="flex flex-wrap items-center gap-5">
        {/* Indicador circular */}
        <div className="relative flex-shrink-0">
          <StatusOrb status={overall} size="lg" />
        </div>

        {/* Texto */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Estado del proceso
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                overall === "ok"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : overall === "warn"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-red-500/15 text-red-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  overall === "ok"
                    ? "bg-emerald-400"
                    : overall === "warn"
                      ? "bg-amber-400 animate-pulse-dot"
                      : "bg-red-400 animate-pulse-dot"
                }`}
              />
              {cfg.label}
            </span>
          </div>
          <p className="mt-1 text-xl font-semibold text-white">{summary}</p>
          <p className="mt-0.5 text-sm text-white/55">{detail}</p>
        </div>

        {/* Contador de alertas */}
        <div className="flex-shrink-0 text-right">
          <p className="text-3xl font-bold text-white">
            {alertCount === 0 ? "✓" : alertCount}
          </p>
          <p className="text-[11px] text-white/45">
            {alertCount === 0
              ? "sin alertas"
              : alertCount === 1
                ? "alerta activa"
                : "alertas activas"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Orbe de estado (reutilizable) ──────────────────────────────────────────

export function StatusOrb({
  status,
  size = "md",
}: {
  status: SystemStatus;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "h-8 w-8", md: "h-12 w-12", lg: "h-16 w-16" };
  const iconSizes = { sm: 14, md: 20, lg: 28 };
  const colors = {
    ok: {
      ring: "ring-emerald-500/40",
      bg: "bg-emerald-500/15",
      icon: "text-emerald-400",
    },
    warn: {
      ring: "ring-amber-500/40",
      bg: "bg-amber-500/15",
      icon: "text-amber-400",
    },
    error: {
      ring: "ring-red-500/40",
      bg: "bg-red-500/15",
      icon: "text-red-400",
    },
  };
  const c = colors[status];
  const s = iconSizes[size];
  const cfg = overallConfig[status];

  return (
    <div
      className={`${sizes[size]} ${c.bg} ${c.ring} ring-2 flex items-center justify-center rounded-full`}
    >
      <span className={c.icon}>
        {status === "ok" ? (
          <OkIcon size={s} />
        ) : status === "warn" ? (
          <WarnIcon size={s} />
        ) : (
          <ErrorIcon size={s} />
        )}
      </span>
    </div>
  );
}

// ─── Fila de sensor (para la tabla de resumen) ───────────────────────────────

export function SensorRow({
  label,
  value,
  unit,
  status,
  color,
  lastSeenIso,
}: {
  label: string;
  value: string | null;
  unit: string;
  status: MetricStatus;
  color: string;
  lastSeenIso: string | null;
}) {
  const dotColors: Record<MetricStatus, string> = {
    normal: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.55)]",
    warning: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
    alert: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)] animate-pulse-dot",
  };
  const statusLabels: Record<MetricStatus, string> = {
    normal: "Normal",
    warning: "Advertencia",
    alert: "Alerta",
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      {/* Color dot del sensor */}
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
      />

      {/* Label */}
      <span className="flex-1 text-sm text-white/75">{label}</span>

      {/* Valor */}
      <span className="font-mono text-sm font-medium text-white">
        {value !== null ? (
          <>
            {value}
            <span className="ml-1 text-xs text-white/45">{unit}</span>
          </>
        ) : (
          <span className="text-white/30">—</span>
        )}
      </span>

      {/* Status badge */}
      <span
        className={`hidden sm:flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          status === "normal"
            ? "bg-emerald-500/10 text-emerald-300"
            : status === "warning"
              ? "bg-amber-500/10 text-amber-300"
              : "bg-red-500/10 text-red-300"
        }`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColors[status]}`} />
        {statusLabels[status]}
      </span>

      {/* Tiempo */}
      <span className="hidden lg:block text-[11px] text-white/30 min-w-[80px] text-right">
        {lastSeenIso ? formatRelative(lastSeenIso) : "—"}
      </span>
    </div>
  );
}

// ─── Ítem de alerta ───────────────────────────────────────────────────────────

const alertLevelConfig = {
  danger: {
    bg: "bg-red-500/8",
    border: "border-red-500/25",
    icon: "text-red-400",
    badge: "bg-red-500/15 text-red-300",
    label: "Crítico",
  },
  warning: {
    bg: "bg-amber-500/8",
    border: "border-amber-500/20",
    icon: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-300",
    label: "Advertencia",
  },
  info: {
    bg: "bg-blue-500/6",
    border: "border-blue-500/15",
    icon: "text-blue-400",
    badge: "bg-blue-500/15 text-blue-300",
    label: "Info",
  },
};

export function AlertItem({ alert }: { alert: AlertEvent }) {
  const cfg = alertLevelConfig[alert.level];

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border ${cfg.bg} ${cfg.border} px-4 py-3`}
    >
      <span className={`mt-0.5 flex-shrink-0 ${cfg.icon}`}>
        {alert.level === "danger" ? (
          <AlertTriangleIcon />
        ) : alert.level === "warning" ? (
          <WarnIcon size={16} />
        ) : (
          <InfoIcon />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/90">{alert.message}</p>
        <p className="mt-0.5 text-[11px] text-white/40">
          {alert.device_id} · {formatRelative(alert.created_at)}
        </p>
      </div>
      <span
        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.badge}`}
      >
        {cfg.label}
      </span>
    </div>
  );
}

// ─── Chip de dispositivo ─────────────────────────────────────────────────────

export function DeviceChip({ device }: { device: DeviceOnlineStatus }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1a1a2e] px-4 py-3">
      <span
        className={`h-2 w-2 flex-shrink-0 rounded-full ${
          device.online
            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            : "bg-red-500/70 shadow-[0_0_6px_rgba(239,68,68,0.5)] animate-pulse-dot"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{device.label}</p>
        <p className="text-[11px] text-white/40">
          {device.online
            ? device.minutesAgo === 0
              ? "hace menos de 1 min"
              : `hace ${device.minutesAgo} min`
            : device.lastSeenIso
              ? `sin señal · visto hace ${device.minutesAgo} min`
              : "nunca conectado"}
        </p>
      </div>
      <span
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          device.online ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {device.online ? "En línea" : "Offline"}
      </span>
    </div>
  );
}

// ─── Iconos SVG inline ───────────────────────────────────────────────────────

function OkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WarnIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

function ErrorIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
