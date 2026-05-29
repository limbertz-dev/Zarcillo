"use client";

import { useMemo } from "react";
import { getDevice } from "@/lib/devices";
import { toBool } from "@/lib/format";
import type { Reading } from "@/lib/types";

type LampState = {
  deviceId: string;
  label: string;
  lamp: boolean | null;
  lastSeenIso: string | null;
};

export function LampControls({ readings }: { readings: Reading[] }) {
  const devices = useMemo(() => latestLampStates(readings), [readings]);

  const hasDevices = devices.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Lamparas</p>
          <p className="text-[11px] text-white/45">
            Estado desde dashboard_lamp por dispositivo
          </p>
        </div>
      </div>

      {hasDevices ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {devices.map((device) => {
            const value = device.lamp ?? false;
            const stateKnown = device.lamp !== null;

            return (
              <div
                key={device.deviceId}
                className="rounded-lg border border-white/[0.06] bg-black/15 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {device.label}
                    </p>
                    <p className="truncate font-mono text-[10px] text-white/35">
                      {device.deviceId}
                    </p>
                  </div>
                  <div
                    role="status"
                    aria-label={stateKnown ? (value ? "Encendida" : "Apagada") : "Sin estado"}
                    className={`relative h-7 w-12 flex-shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      value
                        ? "border-emerald-300/40 bg-emerald-400/25"
                        : "border-white/10 bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full transition ${
                        value
                          ? "left-6 bg-emerald-200 shadow-[0_0_10px_rgba(110,231,183,0.45)]"
                          : "left-1 bg-white/55"
                      }`}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      value
                        ? "bg-emerald-500/15 text-emerald-300"
                        : stateKnown
                          ? "bg-white/5 text-white/45"
                          : "bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        value
                          ? "bg-emerald-300"
                          : stateKnown
                            ? "bg-white/35"
                            : "bg-amber-300"
                      }`}
                    />
                    {stateKnown ? (value ? "Encendida" : "Apagada") : "Sin estado"}
                  </span>
                  <span className="text-[11px] text-white/35">Solo lectura</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
          Sin dispositivos detectados en las lecturas actuales.
        </div>
      )}
    </div>
  );
}

function latestLampStates(readings: Reading[]): LampState[] {
  const map = new Map<string, LampState>();

  for (const reading of readings) {
    if (map.has(reading.device_id)) continue;
    const known =
      reading.dashboard_lamp !== null && reading.dashboard_lamp !== undefined;
    map.set(reading.device_id, {
      deviceId: reading.device_id,
      label: getDevice(reading.device_id)?.label ?? reading.device_id,
      lamp: known ? toBool(reading.dashboard_lamp) : null,
      lastSeenIso: reading.created_at,
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "es"),
  );
}
