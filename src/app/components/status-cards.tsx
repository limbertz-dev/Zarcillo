"use client";

/**
 * app/components/status-cards.tsx
 *
 * Gauge horizontal de temperatura del vino usado en la pantalla /estado.
 */

import { formatRelative, formatNumber } from "@/lib/format";
import type { WineTempAssessment } from "@/lib/status";

// ─── Gauge dedicado a la temperatura del vino ────────────────────────────────

const wineStageConfig: Record<
  WineTempAssessment["stage"],
  { border: string; bg: string; badge: string; dot: string }
> = {
  "cold-critical": {
    border: "border-blue-500/40",
    bg: "from-blue-500/12 to-transparent",
    badge: "bg-blue-500/15 text-blue-300",
    dot: "bg-blue-400 animate-pulse-dot shadow-[0_0_8px_rgba(59,130,246,0.7)]",
  },
  cold: {
    border: "border-cyan-500/30",
    bg: "from-cyan-500/10 to-transparent",
    badge: "bg-cyan-500/15 text-cyan-300",
    dot: "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]",
  },
  optimal: {
    border: "border-emerald-500/30",
    bg: "from-emerald-500/10 to-transparent",
    badge: "bg-emerald-500/15 text-emerald-300",
    dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.55)]",
  },
  warm: {
    border: "border-amber-500/30",
    bg: "from-amber-500/10 to-transparent",
    badge: "bg-amber-500/15 text-amber-300",
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
  },
  hot: {
    border: "border-red-500/40",
    bg: "from-red-500/12 to-transparent",
    badge: "bg-red-500/15 text-red-300",
    dot: "bg-red-500 animate-pulse-dot shadow-[0_0_8px_rgba(239,68,68,0.7)]",
  },
};

export function WineTempGauge({
  wine,
  lastSeenIso,
  history = [],
  ambientTemperature = null,
}: {
  wine: WineTempAssessment;
  lastSeenIso: string | null;
  history?: number[]; // cronológico, viejo→nuevo
  ambientTemperature?: number | null;
}) {
  const cfg = wineStageConfig[wine.stage];
  const range = wine.scaleMax - wine.scaleMin;
  const clamp = (n: number) =>
    Math.max(wine.scaleMin, Math.min(wine.scaleMax, n));
  const pct = (n: number) => ((clamp(n) - wine.scaleMin) / range) * 100;

  const optStartPct = pct(wine.optimalMin);
  const optEndPct = pct(wine.optimalMax);
  const pointerPct =
    wine.temperature !== null ? pct(wine.temperature) : null;

  const ticks = [wine.scaleMin, 15, 20, 25, 30, wine.scaleMax];

  // ── Tendencia (slope entre primer y último cuarto de la historia) ────────
  const trend = computeTrend(history);

  // ── Delta vs. rango óptimo ───────────────────────────────────────────────
  let optimalDelta: { label: string; tone: "good" | "warn" | "alert" } | null = null;
  if (wine.temperature !== null) {
    if (wine.temperature < wine.optimalMin) {
      const d = wine.optimalMin - wine.temperature;
      optimalDelta = {
        label: `${d.toFixed(1)} °C bajo el rango óptimo`,
        tone: d > 4 ? "alert" : "warn",
      };
    } else if (wine.temperature > wine.optimalMax) {
      const d = wine.temperature - wine.optimalMax;
      optimalDelta = {
        label: `${d.toFixed(1)} °C sobre el rango óptimo`,
        tone: d > 3 ? "alert" : "warn",
      };
    } else {
      optimalDelta = {
        label: "Dentro del rango óptimo",
        tone: "good",
      };
    }
  }

  // ── Delta vs. ambiente ───────────────────────────────────────────────────
  let ambientDelta: string | null = null;
  if (wine.temperature !== null && ambientTemperature !== null) {
    const d = wine.temperature - ambientTemperature;
    const abs = Math.abs(d);
    if (abs < 0.3) ambientDelta = "≈ igual que ambiente";
    else if (d > 0) ambientDelta = `${abs.toFixed(1)} °C más cálido que ambiente`;
    else ambientDelta = `${abs.toFixed(1)} °C más frío que ambiente`;
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${cfg.bg} ${cfg.border} p-5`}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, ${wine.color}, transparent)` }}
      />

      <div className="flex flex-wrap items-start gap-5">
        {/* Encabezado y valor */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <WineIcon color={wine.color} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Temperatura del vino
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${cfg.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {wine.label}
            </span>
            {trend && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  trend.direction === "up"
                    ? "bg-amber-500/15 text-amber-300"
                    : trend.direction === "down"
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "bg-white/[0.06] text-white/55"
                }`}
                title={`Δ ${trend.delta.toFixed(2)} °C en ${history.length} lecturas`}
              >
                <TrendArrow direction={trend.direction} />
                {trend.direction === "stable"
                  ? "estable"
                  : `${trend.direction === "up" ? "+" : "−"}${Math.abs(trend.delta).toFixed(1)} °C`}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-end gap-4">
            <p className="flex items-baseline gap-2 font-mono text-4xl font-semibold text-white">
              {wine.temperature !== null
                ? formatNumber(wine.temperature, 1)
                : "—"}
              <span className="text-base font-normal text-white/45">°C</span>
            </p>

            {/* Sparkline */}
            {history.length >= 2 && (
              <WineSparkline values={history} color={wine.color} />
            )}
          </div>

          <p className="mt-2 max-w-md text-sm text-white/65">
            {wine.description}
          </p>

          {/* Metadatos: óptimo, delta, ambiente, hora */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
            <span>
              Óptimo{" "}
              <span className="text-white/70">
                {wine.optimalMin}–{wine.optimalMax} °C
              </span>
            </span>
            {optimalDelta && (
              <>
                <span className="text-white/15">·</span>
                <span
                  className={
                    optimalDelta.tone === "good"
                      ? "text-emerald-300/85"
                      : optimalDelta.tone === "warn"
                        ? "text-amber-300/85"
                        : "text-red-300/85"
                  }
                >
                  {optimalDelta.label}
                </span>
              </>
            )}
            {ambientDelta && (
              <>
                <span className="text-white/15">·</span>
                <span>{ambientDelta}</span>
              </>
            )}
            <span className="text-white/15">·</span>
            <span>{lastSeenIso ? formatRelative(lastSeenIso) : "sin lectura"}</span>
          </div>
        </div>
      </div>

      {/* Gauge horizontal con zonas */}
      <div className="mt-5">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/[0.04]">
          {/* Zonas frío/óptimo/caliente */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500/35 via-cyan-400/25 to-cyan-400/10"
            style={{ width: `${optStartPct}%` }}
          />
          <div
            className="absolute inset-y-0 bg-emerald-500/35"
            style={{
              left: `${optStartPct}%`,
              width: `${optEndPct - optStartPct}%`,
            }}
          />
          <div
            className="absolute inset-y-0 bg-gradient-to-r from-amber-400/20 via-amber-500/30 to-red-500/45"
            style={{
              left: `${optEndPct}%`,
              width: `${100 - optEndPct}%`,
            }}
          />

          {/* Marca de temp. ambiente (referencia) */}
          {ambientTemperature !== null && (
            <div
              className="absolute -top-0.5 h-4 w-0.5 bg-white/45"
              style={{ left: `calc(${pct(ambientTemperature)}% - 1px)` }}
              title={`Ambiente: ${ambientTemperature.toFixed(1)} °C`}
            />
          )}

          {/* Pointer principal del vino */}
          {pointerPct !== null && (
            <div
              className="absolute -top-1 h-5 w-1 rounded-full transition-all duration-500"
              style={{
                left: `calc(${pointerPct}% - 2px)`,
                background: wine.color,
                boxShadow: `0 0 10px ${wine.color}`,
              }}
            />
          )}
        </div>

        {/* Ticks */}
        <div className="mt-1.5 flex justify-between text-[10px] font-mono text-white/35">
          {ticks.map((t) => (
            <span key={t}>{t}°</span>
          ))}
        </div>

        {/* Leyenda etapas */}
        <div className="mt-3 grid grid-cols-5 gap-1 text-[10px] text-white/50">
          <StageLegend label="Frío crítico" color="#3b82f6" active={wine.stage === "cold-critical"} />
          <StageLegend label="Frío" color="#06b6d4" active={wine.stage === "cold"} />
          <StageLegend label="Óptimo" color="#10b981" active={wine.stage === "optimal"} />
          <StageLegend label="Tibio" color="#f59e0b" active={wine.stage === "warm"} />
          <StageLegend label="Caliente" color="#ef4444" active={wine.stage === "hot"} />
        </div>
      </div>
    </div>
  );
}

// Tendencia: compara promedio del primer cuarto con el último cuarto.
function computeTrend(values: number[]): {
  direction: "up" | "down" | "stable";
  delta: number;
} | null {
  if (values.length < 4) return null;
  const q = Math.max(1, Math.floor(values.length / 4));
  const head = values.slice(0, q);
  const tail = values.slice(-q);
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const delta = avg(tail) - avg(head);
  if (Math.abs(delta) < 0.15) return { direction: "stable", delta };
  return { direction: delta > 0 ? "up" : "down", delta };
}

function TrendArrow({ direction }: { direction: "up" | "down" | "stable" }) {
  if (direction === "stable") {
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M5 12h14" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {direction === "up" ? (
        <>
          <path d="M7 17 17 7" />
          <path d="M9 7h8v8" />
        </>
      ) : (
        <>
          <path d="M7 7 17 17" />
          <path d="M17 9v8H9" />
        </>
      )}
    </svg>
  );
}

function WineSparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const width = 140;
  const height = 42;
  const recent = values.slice(-30);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = max - min || 1;
  const step = width / Math.max(recent.length - 1, 1);
  const points = recent.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaPath =
    `M${points[0][0]},${height} ` +
    points.map(([x, y]) => `L${x},${y}`).join(" ") +
    ` L${points[points.length - 1][0]},${height} Z`;
  const last = points[points.length - 1];
  const gradId = `wine-spark-${color.replace("#", "")}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />
      <circle cx={last[0]} cy={last[1]} r={5} fill={color} opacity={0.25} />
    </svg>
  );
}

function StageLegend({
  label,
  color,
  active,
}: {
  label: string;
  color: string;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded px-1.5 py-1 ${
        active ? "bg-white/[0.05] text-white" : ""
      }`}
    >
      <span
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ backgroundColor: color, boxShadow: active ? `0 0 6px ${color}` : undefined }}
      />
      <span className="truncate">{label}</span>
    </div>
  );
}

function WineIcon({ color = "#ef4444", size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22h8" />
      <path d="M12 15v7" />
      <path d="M7 2h10l-1.5 9a4 4 0 0 1-7 0L7 2Z" />
    </svg>
  );
}
