"use client";

export type RangeKey = "1h" | "6h" | "24h" | "7d";

export const RANGE_MS: Record<RangeKey, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export const RANGE_LABELS: Record<RangeKey, string> = {
  "1h": "1h",
  "6h": "6h",
  "24h": "24h",
  "7d": "7d",
};

type Props = {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
  options?: RangeKey[];
};

export function RangeSelector({
  value,
  onChange,
  options = ["1h", "6h", "24h", "7d"],
}: Props) {
  return (
    <div className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            value === opt
              ? "bg-white/10 text-white shadow-inner"
              : "text-white/55 hover:text-white"
          }`}
        >
          {RANGE_LABELS[opt]}
        </button>
      ))}
    </div>
  );
}
