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

export function ReportesClient() {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateReport() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reportes/fermentacion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ days }),
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
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              >
                <option value={1}>Ultimas 24 horas</option>
                <option value={3}>Ultimos 3 dias</option>
                <option value={7}>Ultimos 7 dias</option>
                <option value={14}>Ultimos 14 dias</option>
                <option value={30}>Ultimos 30 dias</option>
              </select>
            </Field>
            <MetricPill label="Fuente" value="Supabase readings" />
            <MetricPill label="Modelo" value="OpenRouter Free" />
          </div>
          <button
            type="button"
            onClick={generateReport}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-black transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Analizando..." : "Generar analisis IA"}
          </button>
        </div>
      </Panel>

      {error && (
        <ErrorState title="Error al generar reporte con OpenRouter" message={error} />
      )}

      {report ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel
            title="Detalle de fermentacion"
            subtitle={`Generado con ${report.readings.toLocaleString("es-BO")} lecturas`}
          >
            <article>{renderAnalysis(report.analysis)}</article>
          </Panel>

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
            <p className="text-sm font-medium text-white/70">
              Genera un analisis para ver como avanza la fermentacion.
            </p>
            <p className="mt-1 text-xs text-white/40">
              La IA gratuita revisara las lecturas recientes de temperatura, pH,
              humedad, luz y movimiento.
            </p>
          </div>
        </Panel>
      )}
    </>
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
}: {
  label: string;
  metric: number | null;
  unit: string;
}) {
  const value =
    metric === null
      ? "-"
      : metric.toLocaleString("es-BO", {
          maximumFractionDigits: 2,
        });

  return (
    <div>
      <p className="text-white/35">{label}</p>
      <p className="mt-0.5 font-mono text-white/80">
        {value} {unit}
      </p>
    </div>
  );
}

function renderAnalysis(analysis: string) {
  return analysis.split("\n").map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) return <br key={index} />;
    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <h3 key={index} className="mb-2 mt-5 text-base font-semibold text-white">
          {trimmed}
        </h3>
      );
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <p key={index} className="ml-4 text-sm leading-6 text-white/75">
          {trimmed.slice(2)}
        </p>
      );
    }

    return (
      <p key={index} className="text-sm leading-6 text-white/75">
        {trimmed}
      </p>
    );
  });
}
