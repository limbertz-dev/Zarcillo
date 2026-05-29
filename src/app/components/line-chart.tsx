"use client";

import { useSyncExternalStore } from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatNumber, formatRange } from "@/lib/format";

export type SeriesDef = {
  dataKey: string;
  label: string;
  color: string;
  unit?: string;
  digits?: number;
};

type Props = {
  data: Array<Record<string, number | string | null>>;
  series: SeriesDef[];
  height?: number;
  rangeMs?: number;
  showLegend?: boolean;
};

const subscribeNoop = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function LineChart({
  data,
  series,
  height = 240,
  rangeMs = 24 * 60 * 60 * 1000,
  showLegend = false,
}: Props) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );

  if (!mounted) {
    return <div style={{ width: "100%", height }} aria-hidden />;
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart
          data={data}
          margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(t) => formatRange(String(t), rangeMs)}
            stroke="rgba(255,255,255,0.25)"
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            stroke="rgba(255,255,255,0.25)"
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={(v) =>
              typeof v === "number" ? formatNumber(v, 1) : String(v)
            }
          />
          <Tooltip
            labelFormatter={(label) => formatRange(String(label), rangeMs)}
            formatter={(value, name) => {
              const s = series.find((x) => x.label === String(name));
              const digits = s?.digits ?? 1;
              const unit = s?.unit ? ` ${s.unit}` : "";
              const num =
                typeof value === "number" ? value : Number(value);
              return [
                Number.isFinite(num)
                  ? `${formatNumber(num, digits)}${unit}`
                  : "—",
                String(name),
              ];
            }}
            cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
          />
          {showLegend && (
            <Legend
              verticalAlign="top"
              height={28}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                paddingBottom: 6,
                fontSize: 11,
                color: "rgba(255,255,255,0.7)",
              }}
            />
          )}
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}
