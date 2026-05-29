"use client";
import { DEVICES } from "@/lib/devices";
import { useReadings } from "@/lib/useReadings";
import { computeDeviceStatus, computeSystemStatus } from "@/lib/status";
import type { SystemStatus } from "@/lib/types";
import { formatRelative, toBool } from "@/lib/format";
import { useNow } from "@/lib/useNow";

const STATUS_META: Record<
  SystemStatus,
  { label: string; dot: string; bg: string; text: string }
> = {
  ok: {
    label: "OK",
    dot: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]",
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
  },
  warn: {
    label: "WARN",
    dot: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]",
    bg: "bg-amber-500/15",
    text: "text-amber-200",
  },
  error: {
    label: "ERROR",
    dot: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)] animate-pulse-dot",
    bg: "bg-red-500/15",
    text: "text-red-300",
  },
};

export function HeaderBar() {
  const tickNow = useNow(1000);
  const now = tickNow ? new Date(tickNow) : null;

  const { readings, error } = useReadings({
    deviceIds: DEVICES.map((d) => d.id),
    limit: 100,
    realtime: true,
  });

  const deviceStatuses = computeDeviceStatus(readings, tickNow || 0);
  const status = computeSystemStatus(deviceStatuses, !!error);
  const meta = STATUS_META[status];
  const telemetryLampOn = readings.some((reading) =>
    toBool(reading.dashboard_lamp),
  );
  const ledOn = telemetryLampOn;

  const dateStr = now
    ? now.toLocaleDateString("es-BO", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";
  const timeStr = now
    ? now.toLocaleTimeString("es-BO", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <header className="fixed top-0 right-0 left-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] bg-[#0a0a0f]/85 px-5 py-4 shadow-lg shadow-black/20 backdrop-blur-md lg:left-60 sm:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#a83254]/30 to-[#4a0010]/40 ring-1 ring-[#a83254]/30">
          <WineGlass />
        </div>
        <div className="leading-tight">
          <h1 className="text-lg font-semibold text-white sm:text-xl">
            Wine Fermentation Monitor
          </h1>
          <p className="text-xs text-white/50">
            <span className="inline-flex items-center gap-1">
              <PinIcon /> Tarija, Bolivia
            </span>
          </p>
        </div>
      </div>

      <div className="hidden text-right text-xs text-white/55 md:block">
        <p className="capitalize">{dateStr}</p>
        <p className="font-mono text-base text-white">{timeStr}</p>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${meta.bg} ${meta.text}`}
          title={deviceStatuses
            .map(
              (d) =>
                `${d.deviceId}: ${d.online ? "en línea" : "offline"}${d.lastSeen && tickNow ? ` · ${formatRelative(d.lastSeen, tickNow)}` : ""}`,
            )
            .join("\n")}
        >
          <span className={`inline-block h-2 w-2 rounded-full ${meta.dot}`} />
          {meta.label}
        </div>
        <button
          type="button"
          aria-label={ledOn ? "Lamparas encendidas" : "Lamparas apagadas"}
          aria-pressed={ledOn}
          disabled
          title={
            ledOn
              ? "Lamparas encendidas segun telemetria"
              : "Lamparas apagadas segun telemetria"
          }
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
            ledOn
              ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.55)]"
              : "text-white/40 ring-1 ring-white/10"
          }`}
        >
          <LedBulb on={ledOn} />
        </button>
        <button
          type="button"
          aria-label="Ajustes"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <GearSmall />
        </button>
        <button
          type="button"
          aria-label="Usuario"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
        >
          <UserSmall />
        </button>
      </div>
    </header>
  );
}

function WineGlass() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className="text-[#f5a8bd]"
    >
      <path
        d="M7 3h10l-1 5a5 5 0 1 1-8 0L7 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="rgba(168,50,84,0.25)"
      />
      <path
        d="M12 13v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 21h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function LedBulb({ on }: { on: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M9 18h6M10 21h4"
      />
      <path
        d="M12 3a6 6 0 0 0-4 10.5c.9.9 1.5 1.7 1.7 2.5h4.6c.2-.8.8-1.6 1.7-2.5A6 6 0 0 0 12 3Z"
        fill={on ? "rgba(251,191,36,0.45)" : "none"}
      />
      {on && (
        <>
          <path d="M12 1.5v1.2M4.5 5l.9.9M19.5 5l-.9.9M2.5 10.5h1.2M20.3 10.5h1.2" opacity="0.85" />
        </>
      )}
    </svg>
  );
}

function GearSmall() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5 2 2 0 1 1-4 0 1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3 2 2 0 1 1-2.8-2.8 1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8 2 2 0 1 1 2.8-2.8 1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function UserSmall() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}
