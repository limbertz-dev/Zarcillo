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
      "ph",
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
  warnBelow?: number;
  alertBelow?: number;
};

export const METRICS: Record<ReadingMetric, MetricMeta> = {
  ambient_temperature: {
    key: "ambient_temperature",
    label: "Temp. Ambiente",
    unit: "°C",
    color: "#ef4444",
    digits: 1,
    device: "esp32_nivel_2_001",
    warnBelow: 15,
    alertBelow: 10,
    warnAbove: 28,
    alertAbove: 32,
  },
  ambient_humidity: {
    key: "ambient_humidity",
    label: "Humedad",
    unit: "%",
    color: "#3b82f6",
    digits: 1,
    device: "esp32_nivel_2_001",
    warnBelow: 55,
    alertBelow: 40,
    warnAbove: 80,
    alertAbove: 90,
  },
  wine_temperature: {
    key: "wine_temperature",
    label: "Temp. Vino",
    unit: "°C",
    color: "#f97316",
    digits: 1,
    device: "esp32_nivel_2_001",
    warnBelow: 18,
    alertBelow: 15,
    warnAbove: 28,
    alertAbove: 32,
  },
  light: {
    key: "light",
    label: "Luminosidad",
    unit: "ADC",
    color: "#eab308",
    digits: 0,
    device: "esp32_nivel_2_001",
    warnAbove: 1500,
    alertAbove: 3000,
  },
  ph: {
    key: "ph",
    label: "pH",
    unit: "",
    color: "#14b8a6",
    digits: 2,
    device: "esp32_nivel_2_001",
    warnBelow: 3.1,
    alertBelow: 2.9,
    warnAbove: 3.8,
    alertAbove: 4.0,
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
    warnBelow: -35,
    warnAbove: 35,
  },
  gyro_y: {
    key: "gyro_y",
    label: "Giroscopio Y",
    unit: "°/s",
    color: "#c084fc",
    digits: 2,
    device: "esp32_nivel_2_mpu_001",
    warnBelow: -35,
    warnAbove: 35,
  },
  gyro_z: {
    key: "gyro_z",
    label: "Giroscopio Z",
    unit: "°/s",
    color: "#e879f9",
    digits: 2,
    device: "esp32_nivel_2_mpu_001",
    warnBelow: -35,
    warnAbove: 35,
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
  if (meta.alertBelow !== undefined && value < meta.alertBelow) return "alert";
  if (meta.warnBelow !== undefined && value < meta.warnBelow) return "warning";
  if (meta.alertAbove !== undefined && value > meta.alertAbove) return "alert";
  if (meta.warnAbove !== undefined && value > meta.warnAbove) return "warning";
  return "normal";
}
