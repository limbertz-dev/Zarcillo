"use client";

type Props = {
  values: number[];
  color: string;
  variant?: "bars" | "line";
  height?: number;
  width?: number;
};

export function Sparkline({
  values,
  color,
  variant = "bars",
  height = 36,
  width = 110,
}: Props) {
  if (values.length === 0) {
    return (
      <div
        className="rounded bg-white/[0.03]"
        style={{ width, height }}
        aria-hidden
      />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padded = values.length < 10 ? values : values.slice(-10);

  if (variant === "bars") {
    const gap = 2;
    const totalGaps = (padded.length - 1) * gap;
    const barWidth = (width - totalGaps) / padded.length;
    return (
      <svg width={width} height={height} className="overflow-visible">
        {padded.map((v, i) => {
          const h = ((v - min) / range) * (height - 2) + 2;
          return (
            <rect
              key={i}
              x={i * (barWidth + gap)}
              y={height - h}
              width={barWidth}
              height={h}
              rx={1}
              fill={color}
              opacity={0.45 + (i / padded.length) * 0.5}
            />
          );
        })}
      </svg>
    );
  }

  const step = width / Math.max(padded.length - 1, 1);
  const points = padded
    .map(
      (v, i) =>
        `${i * step},${height - ((v - min) / range) * (height - 2) - 1}`,
    )
    .join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
