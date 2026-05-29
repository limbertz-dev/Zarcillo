import type { Device, DeviceId, ReadingMetric } from "./types";

export const DEVICES: Device[] = [
  {
    id: "esp32_nivel_2_001",
    label: "ESP32 Principal",
    kind: "environment",
    metrics: [
      "ambient_temperature",
      "ambient_humidity",
      "wine_temperature",
      "light",
    ],
  },
  {
    id: "esp32_nivel_2_mpu_001",
    label: "ESP32 MPU6050",
    kind: "mpu",
    metrics: ["accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z"],
  },
];

export const DEVICE_IDS: DeviceId[] = DEVICES.map((d) => d.id);

export function getDevice(id: string): Device | undefined {
  return DEVICES.find((d) => d.id === id);
}

export type MetricMeta = {
  key: ReadingMetric;
  label: string;
  unit: string;
  color: string;
  digits: number;
  device: DeviceId;
  warnAbove?: number;
  alertAbove?: number;
};

export const METRICS: Record<ReadingMetric, MetricMeta> = {
  ambient_temperature: {
    key: "ambient_temperature",
    label: "Temp. Ambiente",
    unit: "°C",
    color: "#ef4444",
    digits: 1,
    device: "esp32_nivel_2_001",
    alertAbove: 30,
  },
  ambient_humidity: {
    key: "ambient_humidity",
    label: "Humedad",
    unit: "%",
    color: "#3b82f6",
    digits: 1,
    device: "esp32_nivel_2_001",
    alertAbove: 85,
  },
  wine_temperature: {
    key: "wine_temperature",
    label: "Temp. Vino",
    unit: "°C",
    color: "#f97316",
    digits: 1,
    device: "esp32_nivel_2_001",
    alertAbove: 28,
  },
  light: {
    key: "light",
    label: "Luminosidad",
    unit: "lux",
    color: "#eab308",
    digits: 0,
    device: "esp32_nivel_2_001",
    warnAbove: 800,
  },
  accel_x: {
    key: "accel_x",
    label: "Aceleración X",
    unit: "g",
    color: "#06b6d4",
    digits: 3,
    device: "esp32_nivel_2_mpu_001",
  },
  accel_y: {
    key: "accel_y",
    label: "Aceleración Y",
    unit: "g",
    color: "#22d3ee",
    digits: 3,
    device: "esp32_nivel_2_mpu_001",
  },
  accel_z: {
    key: "accel_z",
    label: "Aceleración Z",
    unit: "g",
    color: "#10b981",
    digits: 3,
    device: "esp32_nivel_2_mpu_001",
  },
  gyro_x: {
    key: "gyro_x",
    label: "Giroscopio X",
    unit: "°/s",
    color: "#a855f7",
    digits: 2,
    device: "esp32_nivel_2_mpu_001",
  },
  gyro_y: {
    key: "gyro_y",
    label: "Giroscopio Y",
    unit: "°/s",
    color: "#c084fc",
    digits: 2,
    device: "esp32_nivel_2_mpu_001",
  },
  gyro_z: {
    key: "gyro_z",
    label: "Giroscopio Z",
    unit: "°/s",
    color: "#e879f9",
    digits: 2,
    device: "esp32_nivel_2_mpu_001",
  },
};

export const ONLINE_WINDOW_MS = 10 * 60 * 1000;

export type MetricStatus = "normal" | "warning" | "alert";

export function getMetricStatus(
  metric: ReadingMetric,
  value: number | null | undefined,
): MetricStatus {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "normal";
  }
  const meta = METRICS[metric];
  if (meta.alertAbove !== undefined && value > meta.alertAbove) return "alert";
  if (meta.warnAbove !== undefined && value > meta.warnAbove) return "warning";
  return "normal";
}
