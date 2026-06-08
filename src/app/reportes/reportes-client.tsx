"use client";

import { useState } from "react";
import type { ReadingMetric } from "@/lib/types";
import { ErrorState, Panel } from "../components/page-shell";

type ReportResponse = {
  analysis: string;
  generatedAt: string;
  readings: number;
  range: {
    since: string;
    until: string;
  };
  summary: Array<{
    key: ReadingMetric;
    label: string;
    unit: string;
    count: number;
    min: number | null;
    max: number | null;
    avg: number | null;
    latest: number | null;
  }>;
};

type ErrorResponse = {
  error?: string;
};

// Opción de rango: puede ser en días (days) o en horas sub-día (hours)
type RangeOption = {
  label: string;
  days?: number;
  hours?: number;
};

const RANGE_OPTIONS: RangeOption[] = [
  { label: "Última hora",    hours: 1 },
  { label: "Últimas 24 horas", days: 1 },
  { label: "Últimos 3 días", days: 3 },
  { label: "Últimos 7 días", days: 7 },
  { label: "Últimos 14 días", days: 14 },
  { label: "Últimos 30 días", days: 30 },
];

// Íconos SVG inline para cada sección del reporte IA
const SECTION_ICONS: Record<number, React.ReactNode> = {
  1: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
    </svg>
  ),
  2: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h20M2 6h20M2 18h20" />
    </svg>
  ),
  3: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  4: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
};

const SECTION_COLORS: Record<number, string> = {
  1: "#2dd4bf",   // teal — estado general
  2: "#60a5fa",   // blue — evidencias
  3: "#f97316",   // orange — riesgos
  4: "#10b981",   // green — acciones
};

export function ReportesClient() {
  const [selectedRange, setSelectedRange] = useState<RangeOption>(RANGE_OPTIONS[3]); // 7 días por defecto
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateReport() {
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, number> = {};
      if (selectedRange.hours !== undefined) {
        body.hours = selectedRange.hours;
      } else {
        body.days = selectedRange.days ?? 7;
      }

      const response = await fetch("/api/reportes/fermentacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as ReportResponse & ErrorResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo generar el reporte.");
      }

      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Panel className="mb-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Rango">
              <select
                value={selectedRange.label}
                onChange={(event) => {
                  const found = RANGE_OPTIONS.find(
                    (o) => o.label === event.target.value,
                  );
                  if (found) setSelectedRange(found);
                }}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              >
                {RANGE_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.label}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
            <MetricPill label="Fuente" value="Supabase readings" />
            <MetricPill label="Modelo" value="OpenRouter Free" />
          </div>
          <button
            type="button"
            onClick={generateReport}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-black transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <SpinnerIcon />
                Analizando…
              </>
            ) : (
              <>
                <SparkleIcon />
                Generar análisis IA
              </>
            )}
          </button>
        </div>
      </Panel>

      {error && (
        <ErrorState title="Error al generar reporte con OpenRouter" message={error} />
      )}

      {report ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Panel principal: análisis IA */}
          <Panel
            title="Análisis de fermentación"
            subtitle={`${report.readings.toLocaleString("es-BO")} lecturas · ${formatRangeLabel(report.range.since, report.range.until)}`}
          >
            {/* Barra de metadatos del reporte */}
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] px-4 py-3">
              <ReportBadge
                icon={<ClockIcon />}
                label="Generado"
                value={formatGeneratedAt(report.generatedAt)}
              />
              <div className="h-3 w-px bg-white/10" />
              <ReportBadge
                icon={<DatabaseIcon />}
                label="Lecturas"
                value={report.readings.toLocaleString("es-BO")}
              />
              <div className="h-3 w-px bg-white/10" />
              <ReportBadge
                icon={<RangeIcon />}
                label="Rango"
                value={selectedRange.label}
              />
            </div>

            <article className="space-y-1">
              {renderAnalysis(report.analysis)}
            </article>
          </Panel>

          {/* Panel lateral: resumen numérico */}
          <Panel title="Resumen de datos">
            <div className="space-y-3">
              {report.summary.map((metric) => (
                <div
                  key={metric.key}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">
                      {metric.label}
                    </p>
                    <p className="text-xs text-white/45">
                      {metric.count.toLocaleString("es-BO")} datos
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
                    <SummaryValue
                      label="Actual"
                      metric={metric.latest}
                      unit={metric.unit}
                      highlight
                    />
                    <SummaryValue
                      label="Prom."
                      metric={metric.avg}
                      unit={metric.unit}
                    />
                    <SummaryValue
                      label="Min."
                      metric={metric.min}
                      unit={metric.unit}
                    />
                    <SummaryValue
                      label="Max."
                      metric={metric.max}
                      unit={metric.unit}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      ) : (
        <Panel>
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-white/55">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <SparkleIcon />
            </div>
            <p className="text-sm font-medium text-white/70">
              Genera un análisis para ver cómo avanza la fermentación.
            </p>
            <p className="mt-1 text-xs text-white/40">
              La IA revisará las lecturas del rango seleccionado: temperatura, pH,
              humedad, luz y movimiento.
            </p>
          </div>
        </Panel>
      )}
    </>
  );
}

// ─── Helpers de formato ───────────────────────────────────────────────────────

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRangeLabel(sinceIso: string, untilIso: string): string {
  const since = new Date(sinceIso);
  const until = new Date(untilIso);
  const diffMs = until.getTime() - since.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 2) {
    return `última hora (${since.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })} – ${until.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })})`;
  }

  return `${since.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" })} – ${until.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" })}`;
}

// ─── Renderizador de análisis con formato visual enriquecido ─────────────────
//
// El modelo devuelve texto con secciones numeradas "1. Estado general", etc.
// Este renderizador las convierte en bloques visuales con color, ícono y
// separador. Los bullet points (- / *) se renderizan con punto de color.
// Los valores numéricos con unidad (ej. "23.5 °C") se destacan en blanco.

function renderAnalysis(analysis: string): React.ReactNode[] {
  const lines = analysis.split("\n");
  const nodes: React.ReactNode[] = [];

  // Detecta encabezado numerado: "1. Título", "2. Título", etc.
  const sectionRegex = /^(\d+)\.\s+(.+)$/;

  let currentSection = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      nodes.push(<div key={`br-${i}`} className="h-2" />);
      continue;
    }

    const sectionMatch = sectionRegex.exec(trimmed);
    if (sectionMatch) {
      const sectionNum = parseInt(sectionMatch[1], 10);
      const sectionTitle = sectionMatch[2];
      currentSection = sectionNum;
      const color = SECTION_COLORS[sectionNum] ?? "#64748b";
      const icon = SECTION_ICONS[sectionNum];

      // Separador visual antes de cada sección (excepto la primera)
      if (sectionNum > 1) {
        nodes.push(
          <div
            key={`sep-${i}`}
            className="my-4 border-t border-white/[0.06]"
          />,
        );
      }

      nodes.push(
        <div
          key={`h-${i}`}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
          style={{ backgroundColor: `${color}14`, border: `1px solid ${color}30` }}
        >
          <span style={{ color }}>{icon}</span>
          <h3
            className="text-sm font-semibold tracking-tight"
            style={{ color }}
          >
            {sectionTitle}
          </h3>
        </div>,
      );
      continue;
    }

    // Bullet point (- o *)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.slice(2);
      const color = SECTION_COLORS[currentSection] ?? "#64748b";
      nodes.push(
        <div key={`li-${i}`} className="flex items-start gap-2.5 pl-3 pt-1">
          <span
            className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: `${color}aa` }}
          />
          <p className="text-sm leading-6 text-white/75">
            {highlightNumbers(content)}
          </p>
        </div>,
      );
      continue;
    }

    // Párrafo normal
    nodes.push(
      <p key={`p-${i}`} className="pl-3 text-sm leading-6 text-white/65">
        {highlightNumbers(trimmed)}
      </p>,
    );
  }

  return nodes;
}

// Destaca valores numéricos con unidades (23.5 °C, pH 3.45, 75 %, etc.)
// para que resalten visualmente en el texto del análisis IA.
function highlightNumbers(text: string): React.ReactNode {
  // Detecta: número opcionalmente decimal + espacio opcional + unidad conocida
  const numRegex = /(\d+(?:[.,]\d+)?\s*(?:°C|%|ADC|pH|g|°\/s)?)/g;
  const parts = text.split(numRegex);

  if (parts.length <= 1) return text;

  return parts.map((part, idx) => {
    if (numRegex.test(part) || /^\d+(?:[.,]\d+)?/.test(part)) {
      return (
        <span key={idx} className="font-mono font-medium text-white/95">
          {part}
        </span>
      );
    }
    return part;
  });
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

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

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/45">
        {label}
      </p>
      <p className="mt-1 truncate text-sm text-white/80">{value}</p>
    </div>
  );
}

function SummaryValue({
  label,
  metric,
  unit,
  highlight = false,
}: {
  label: string;
  metric: number | null;
  unit: string;
  highlight?: boolean;
}) {
  const value =
    metric === null
      ? "—"
      : metric.toLocaleString("es-BO", { maximumFractionDigits: 2 });

  return (
    <div>
      <p className="text-white/35">{label}</p>
      <p
        className={`mt-0.5 font-mono ${highlight ? "text-white" : "text-white/80"}`}
      >
        {value}{" "}
        <span className="text-[10px] text-white/40">{unit}</span>
      </p>
    </div>
  );
}

function ReportBadge({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-white/30">{icon}</span>
      <span className="text-[10px] text-white/35 uppercase tracking-wider">
        {label}:
      </span>
      <span className="text-xs font-medium text-white/75">{value}</span>
    </div>
  );
}

// ─── Íconos ───────────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  );
}

function RangeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}