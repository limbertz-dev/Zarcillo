export type DeviceId = "esp32_nivel_2_001" | "esp32_nivel_2_mpu_001";

export type Reading = {
  device_id: DeviceId | string;
  level: number | string | null;
  created_at: string;
  ambient_temperature: number | string | null;
  ambient_humidity: number | string | null;
  wine_temperature: number | string | null;
  light: number | string | null;
  accel_x: number | string | null;
  accel_y: number | string | null;
  accel_z: number | string | null;
  gyro_x: number | string | null;
  gyro_y: number | string | null;
  gyro_z: number | string | null;
  movement: boolean | string | null;
  dashboard_lamp: boolean | string | number | null;
};

export type ReadingMetric =
  | "ambient_temperature"
  | "ambient_humidity"
  | "wine_temperature"
  | "light"
  | "accel_x"
  | "accel_y"
  | "accel_z"
  | "gyro_x"
  | "gyro_y"
  | "gyro_z";

export type DeviceKind = "environment" | "mpu";

export type Device = {
  id: DeviceId;
  label: string;
  kind: DeviceKind;
  metrics: ReadingMetric[];
};

export type SystemStatus = "ok" | "warn" | "error";

export type AlertLevel = "info" | "warning" | "danger";

export type AlertEvent = {
  id: string;
  device_id: string;
  metric: ReadingMetric | "movement" | "offline";
  level: AlertLevel;
  message: string;
  value: number | string | null;
  created_at: string;
};
