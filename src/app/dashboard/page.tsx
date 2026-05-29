"use client";

import { useMemo, useState } from "react";
import { DEVICE_IDS, METRICS, getMetricStatus } from "@/lib/devices";
import type { Reading, ReadingMetric } from "@/lib/types";
import { useReadings } from "@/lib/useReadings";
import { useNow } from "@/lib/useNow";
import { toBool, toNumber, formatNumber } from "@/lib/format";
import {
  EmptyState,
  ErrorState,
  Panel,
  PageShell,
} from "../components/page-shell";
import { MetricCard } from "../components/metric-card";
import { LampControls } from "../components/lamp-controls";
import { LineChart, type SeriesDef } from "../components/line-chart";
import { RangeSelector, RANGE_MS, type RangeKey } from "../components/range-selector";

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("24h");
  const now = useNow(60_000);
  const since = useMemo(
    () => (now ? new Date(now - RANGE_MS[range]) : undefined),
    [now, range],
  );

  const { readings, loading, error } = useReadings({
    deviceIds: DEVICE_IDS,
    since,
    limit: 5000,
    realtime: true,
  });

  const env = readings.filter((r) => r.device_id === "esp32_nivel_2_001");
  const mpu = readings.filter((r) => r.device_id === "esp32_nivel_2_mpu_001");

  const envLatest = env[0] ?? null;
  const mpuLatest = mpu[0] ?? null;

  return (
    <PageShell
      title="Dashboard"
      subtitle="Resumen en tiempo real de la cuba de fermentación"
      actions={<RangeSelector value={range} onChange={setRange} />}
    >
      {error && <ErrorState message={error} />}

      {loading && readings.length === 0 && !error && (
        <EmptyState title="Cargando datos…" hint="Conectando con Supabase" />
      )}

      {!loading && readings.length === 0 && !error && (
        <EmptyState
          title="Sin lecturas todavía"
          hint="Los ESP32 aún no han enviado datos en este rango"
        />
      )}

      <h3 className="mb-3 mt-2 text-xs font-semibold uppercase tracking-widest text-white/45">
        ESP32 Principal · Ambiente
      </h3>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            "ambient_temperature",
            "ambient_humidity",
            "wine_temperature",
            "light",
          ] as ReadingMetric[]
        ).map((m) => (
          <DashboardMetric
            key={m}
            metric={m}
            latest={envLatest}
            history={env}
          />
        ))}
      </div>

      <h3 className="mb-3 mt-2 text-xs font-semibold uppercase tracking-widest text-white/45">
        ESP32 MPU6050 · Movimiento
      </h3>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric metric="accel_x" latest={mpuLatest} history={mpu} />
        <DashboardMetric metric="accel_z" latest={mpuLatest} history={mpu} />
        <DashboardMetric metric="gyro_x" latest={mpuLatest} history={mpu} />
        <MovementCard latest={mpuLatest} />
      </div>

      <Panel className="mb-6">
        <LampControls readings={readings} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          title="Temperatura ambiente / Temperatura del vino"
          subtitle="ESP32 Principal"
        >
          <LineChart
            data={toChartData(env, [
              "ambient_temperature",
              "wine_temperature",
            ])}
            series={[
              metricSeries("ambient_temperature"),
              metricSeries("wine_temperature"),
            ]}
            rangeMs={RANGE_MS[range]}
            showLegend
          />
        </Panel>

        <Panel title="Humedad ambiente" subtitle="ESP32 Principal">
          <LineChart
            data={toChartData(env, ["ambient_humidity"])}
            series={[metricSeries("ambient_humidity")]}
            rangeMs={RANGE_MS[range]}
          />
        </Panel>

        <Panel title="Luminosidad" subtitle="ESP32 Principal">
          <LineChart
            data={toChartData(env, ["light"])}
            series={[metricSeries("light")]}
            rangeMs={RANGE_MS[range]}
          />
        </Panel>

        <Panel
          title="Aceleración y Giroscopio"
          subtitle="ESP32 MPU6050"
        >
          <LineChart
            data={toChartData(mpu, [
              "accel_x",
              "accel_y",
              "accel_z",
              "gyro_x",
            ])}
            series={[
              metricSeries("accel_x"),
              metricSeries("accel_y"),
              metricSeries("accel_z"),
              metricSeries("gyro_x"),
            ]}
            rangeMs={RANGE_MS[range]}
            showLegend
          />
        </Panel>
      </div>
    </PageShell>
  );
}

function DashboardMetric({
  metric,
  latest,
  history,
}: {
  metric: ReadingMetric;
  latest: Reading | null;
  history: Reading[];
}) {
  const meta = METRICS[metric];
  const value = latest ? toNumber(latest[metric]) : null;
  const status = getMetricStatus(metric, value);
  const sparkValues = history
    .slice(0, 10)
    .map((r) => toNumber(r[metric]))
    .filter((v): v is number => v !== null)
    .reverse();

  return (
    <MetricCard
      title={meta.label}
      value={value === null ? "—" : formatNumber(value, meta.digits)}
      unit={meta.unit}
      color={meta.color}
      history={sparkValues}
      status={status}
      lastSeenIso={latest?.created_at ?? null}
    />
  );
}

function MovementCard({ latest }: { latest: Reading | null }) {
  const moving = latest ? toBool(latest.movement) : false;
  const color = "#ec4899";
  const status = moving ? "alert" : "normal";
  return (
    <MetricCard
      title="Movimiento"
      value={moving ? "SÍ" : "NO"}
      unit=""
      color={color}
      history={[]}
      status={status}
      lastSeenIso={latest?.created_at ?? null}
      highlight={moving}
    />
  );
}

function metricSeries(metric: ReadingMetric): SeriesDef {
  const meta = METRICS[metric];
  return {
    dataKey: metric,
    label: meta.label,
    color: meta.color,
    unit: meta.unit,
    digits: meta.digits,
  };
}

function toChartData(
  rows: Reading[],
  metrics: ReadingMetric[],
): Array<Record<string, number | string | null>> {
  return rows
    .slice()
    .reverse()
    .map((r) => {
      const point: Record<string, number | string | null> = {
        t: r.created_at,
      };
      for (const m of metrics) point[m] = toNumber(r[m]);
      return point;
    });
}
