"use client";

export type RangeKey = "live" | "15m" | "30m" | "1h" | "6h" | "24h" | "7d" | "30d";

export const RANGE_MS: Record<RangeKey, number> = {
  // "live" usa una ventana corta solo para asegurar que la última lectura
  // esté disponible; la tarjeta en vivo muestra el dato más reciente.
  live: 10 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export const RANGE_LABELS: Record<RangeKey, string> = {
  live: "En directo",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "6h": "6h",
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
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
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
            value === opt
              ? "bg-white/10 text-white shadow-inner"
              : "text-white/55 hover:text-white"
          }`}
        >
          {opt === "live" && (
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 ${
                  value === opt ? "animate-ping opacity-75" : "opacity-0"
                }`}
              />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          )}
          {RANGE_LABELS[opt]}
        </button>
      ))}
    </div>
  );
}
