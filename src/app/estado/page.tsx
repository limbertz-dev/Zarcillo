"use client";

/**
 * app/estado/page.tsx
 *
 * Pantalla "Estado" — respuesta directa: ¿el vino ya fermentó o no?
 * Dos tarjetas de veredicto:
 *   1. Estado según los últimos datos (ventana corta/larga seleccionable).
 *   2. Veredicto sobre el registro histórico del período.
 * El detalle completo (sensores, gauge, conectividad) está en el Dashboard.
 */

import { useMemo, useState } from "react";
import { DEVICE_IDS } from "@/lib/devices";
import {
  evaluateCurrentZoneStatus,
  evaluateFermentationProgress,
} from "@/lib/status";
import type { FermentationVerdict, FermentationProgress } from "@/lib/status";
import type { Reading } from "@/lib/types";
import { useReadings } from "@/lib/useReadings";
import { useNow } from "@/lib/useNow";
import { formatNumber, toNumber } from "@/lib/format";
import { PageShell, EmptyState, ErrorState } from "@/app/components/page-shell";
import { WineTempGauge } from "@/app/components/status-cards";
import {
  RangeSelector,
  RANGE_MS,
  RANGE_LABELS,
  type RangeKey,
} from "@/app/components/range-selector";

// Arriba: en directo + estado según los últimos datos tomados (ventanas cortas + largas).
// Abajo: veredicto sobre el registro histórico (la fermentación dura días).
const HIST_RANGES: RangeKey[] = ["24h", "7d", "30d"];

type VerdictStyle = {
  accent: string; // hex del color de acento
  tag: string;
  tagText: string;
};

const VERDICT_STYLE: Record<FermentationVerdict, VerdictStyle> = {
  ready: {
    accent: "#10b981",
    tag: "bg-emerald-500/15 text-emerald-300",
    tagText: "LISTO",
  },
  finishing: {
    accent: "#f59e0b",
    tag: "bg-amber-500/15 text-amber-300",
    tagText: "CASI LISTO",
  },
  active: {
    accent: "#f97316",
    tag: "bg-orange-500/15 text-orange-300",
    tagText: "FERMENTANDO",
  },
  unknown: {
    accent: "#64748b",
    tag: "bg-white/10 text-white/50",
    tagText: "SIN DATOS",
  },
};

export default function EstadoPage() {
  const [histRange, setHistRange] = useState<RangeKey>("7d");
  const now = useNow(30_000);

  const since = useMemo(
    () => (now ? new Date(now - RANGE_MS[histRange]) : undefined),
    [now, histRange],
  );

  const { readings, loading, error } = useReadings({
    deviceIds: DEVICE_IDS,
    since,
    limit: 5000,
    realtime: true,
  });

  const envReadings = useMemo(
    () => readings.filter((r) => r.device_id === "esp32_nivel_2_001"),
    [readings],
  );

  const nowMs = now;
  // Última lectura de ambiente (para la vista "en directo").
  const latestEnv = useMemo(
    () =>
      envReadings.reduce<Reading | null>((latest, r) => {
        if (!latest) return r;
        return new Date(r.created_at).getTime() >
          new Date(latest.created_at).getTime()
          ? r
          : latest;
      }, null),
    [envReadings],
  );
  const wineHistory = useMemo(
    () =>
      envReadings
        .slice()
        .reverse()
        .map((r) => toNumber(r.wine_temperature))
        .filter((v): v is number => v !== null),
    [envReadings],
  );
  const histFp = useMemo(
    () => evaluateFermentationProgress(readings),
    [readings],
  );

  return (
    <PageShell
      title="Estado"
      subtitle="Arriba: estado según los últimos datos · Abajo: veredicto del histórico"
    >
      {error && <ErrorState message={error} />}

      {loading && readings.length === 0 && !error && (
        <EmptyState title="Cargando datos…" hint="Conectando con Supabase" />
      )}

      {!error && (
        <div className="flex flex-col gap-6">
          {/* Tarjeta 1 — en directo o estado según los últimos datos */}
          <LiveCard latest={latestEnv} history={wineHistory} nowMs={nowMs} />

          {/* Tarjeta 2 — veredicto sobre el histórico */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/45">
                  Análisis histórico
                </p>
                <p className="text-[11px] text-white/40">
                  Veredicto sobre todo el registro del período
                </p>
              </div>
              <RangeSelector
                value={histRange}
                onChange={setHistRange}
                options={HIST_RANGES}
              />
            </div>
            <VerdictCard
              fp={histFp}
              label={`Veredicto del histórico · ${RANGE_LABELS[histRange]}`}
            />
          </div>
        </div>
      )}
    </PageShell>
  );
}

// ─── Tarjeta de veredicto ────────────────────────────────────────────────────

function VerdictCard({ fp, label }: { fp: FermentationProgress; label: string }) {
  const style = VERDICT_STYLE[fp.verdict];
  const progressPct = Math.round(fp.progress * 100);
  const hasProgress = fp.verdict !== "unknown";

  return (
    <section
      className="relative overflow-hidden rounded-2xl border p-5 shadow-xl shadow-black/35"
      style={{
        borderColor: `${style.accent}55`,
        backgroundImage: `linear-gradient(135deg, ${style.accent}16, rgba(19, 19, 28, 0.96) 42%, rgba(19, 19, 28, 0.98)), radial-gradient(circle at 90% 8%, ${style.accent}22, transparent 28%)`,
      }}
    >
      {/* Resplandor decorativo */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, ${style.accent}, transparent)` }}
      />
      <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
        {/* ── Veredicto + cifras ─────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
              {label}
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${style.tag}`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: style.accent }}
              />
              {style.tagText}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <p className="font-mono text-4xl font-semibold text-white">
              {hasProgress ? progressPct : "-"}
              <span className="ml-1 text-base font-normal text-white/45">
                %
              </span>
            </p>
            <h2 className="pb-1 text-3xl font-bold tracking-tight text-white md:text-4xl">
              {fp.title}
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-white/65 md:text-base">
            {fp.message}
          </p>

          <div className="mt-5">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${hasProgress ? progressPct : 0}%`,
                  background: `linear-gradient(90deg, ${style.accent}99, ${style.accent})`,
                  boxShadow: `0 0 10px ${style.accent}88`,
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] font-mono text-white/35">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          {fp.etaText && fp.verdict !== "ready" && (
            <p
              className="mt-3 inline-block rounded-lg border px-3 py-1.5 text-xs font-medium"
              style={{
                color: style.accent,
                borderColor: `${style.accent}33`,
                backgroundColor: `${style.accent}12`,
              }}
            >
              {fp.etaText}
            </p>
          )}

          {/* Cifras clave */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KeyFigure
              label="Temp. vino"
              value={fp.wineTemp !== null ? formatNumber(fp.wineTemp, 1) : "—"}
              unit="°C"
            />
            <KeyFigure
              label="Temp. ambiente"
              value={fp.ambientTemp !== null ? formatNumber(fp.ambientTemp, 1) : "—"}
              unit="°C"
            />
            <KeyFigure
              label="pH"
              value={fp.ph !== null ? formatNumber(fp.ph, 2) : "—"}
              unit=""
            />
          </div>
        </div>
      </div>

      {/* Pie técnico */}
      <div className="mt-5 border-t border-white/[0.06] pt-3">
        <p className="font-mono text-[11px] leading-relaxed text-white/35">
          {fp.basis}
        </p>
      </div>
    </section>
  );
}

// ─── Tarjeta EN DIRECTO ──────────────────────────────────────────────────────
// Muestra la última lectura recibida, actualizándose en tiempo real.

function LiveCard({
  latest,
  history,
  nowMs,
}: {
  latest: Reading | null;
  history: number[];
  nowMs: number;
}) {
  const ambientTemp = latest ? toNumber(latest.ambient_temperature) : null;
  const wine = evaluateCurrentZoneStatus(latest, nowMs);

  return (
    <WineTempGauge
      wine={wine}
      lastSeenIso={latest?.created_at ?? null}
      history={history}
      ambientTemperature={ambientTemp}
    />
  );
}

function KeyFigure({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold text-white">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-white/40">{unit}</span>}
      </p>
    </div>
  );
}

