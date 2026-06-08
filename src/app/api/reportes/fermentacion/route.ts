import { METRICS } from "@/lib/devices";
import { toBool, toNumber } from "@/lib/format";
import { fetchReadings } from "@/lib/queries";
import type { Reading, ReadingMetric } from "@/lib/types";

export const runtime = "nodejs";

type MetricSummary = {
  key: ReadingMetric;
  label: string;
  unit: string;
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  latest: number | null;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
  };
};

const FREE_MODEL = "openrouter/free";
const METRIC_KEYS: ReadingMetric[] = [
  "ambient_temperature",
  "ambient_humidity",
  "wine_temperature",
  "light",
  "ph",
  "accel_x",
  "accel_y",
  "accel_z",
  "gyro_x",
  "gyro_y",
  "gyro_z",
];

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        error:
          "Falta OPENROUTER_API_KEY en las variables de entorno. Agrégala y reinicia el servidor.",
      },
      { status: 500 },
    );
  }

  const body = await readJson(request);

  // Soporta "hours" (sub-día) y "days" (multi-día).
  // Si viene "hours", se ignora "days".
  const until = new Date();
  let since: Date;
  let rangeLabel: string;

  if (body?.hours !== undefined && Number.isFinite(Number(body.hours))) {
    const hours = clamp(Number(body.hours), 1, 24);
    since = new Date(until.getTime() - hours * 60 * 60 * 1000);
    rangeLabel = hours === 1 ? "última hora" : `últimas ${hours} horas`;
  } else {
    const days = clamp(Number(body?.days ?? 7), 1, 30);
    since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
    rangeLabel = days === 1 ? "últimas 24 horas" : `últimos ${days} días`;
  }

  const readings = await fetchReadings({
    since,
    until,
    limit: 5000,
    ascending: true,
  });

  if (readings.length === 0) {
    return Response.json(
      {
        error: `No hay lecturas disponibles para analizar en el rango: ${rangeLabel}.`,
      },
      { status: 404 },
    );
  }

  const payload = buildFermentationPayload(readings, since, until);
  const prompt = buildPrompt(payload, rangeLabel);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://zarcillo.azurewebsites.net",
      "X-Title": "Zarcillo Dashboard",
    },
    body: JSON.stringify({
      model: FREE_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.25,
      max_tokens: 900,
    }),
  });

  const openRouter = (await response.json()) as OpenRouterResponse;

  if (!response.ok) {
    return Response.json(
      {
        error: formatOpenRouterError(response.status, openRouter),
      },
      { status: response.status },
    );
  }

  const analysis =
    openRouter.choices?.[0]?.message?.content?.trim() ?? "";

  if (!analysis) {
    return Response.json(
      { error: "OpenRouter respondió sin texto de análisis." },
      { status: 502 },
    );
  }

  return Response.json({
    analysis,
    generatedAt: until.toISOString(),
    readings: readings.length,
    range: {
      since: since.toISOString(),
      until: until.toISOString(),
    },
    summary: payload.metrics,
  });
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function buildFermentationPayload(
  readings: Reading[],
  since: Date,
  until: Date,
) {
  const latest = readings[readings.length - 1];
  const movementEvents = readings.filter((reading) =>
    toBool(reading.movement),
  ).length;

  return {
    range: {
      since: since.toISOString(),
      until: until.toISOString(),
    },
    readings: readings.length,
    latestReadingAt: latest?.created_at ?? null,
    movementEvents,
    metrics: METRIC_KEYS.map((key) => summarizeMetric(readings, key)).filter(
      (metric) => metric.count > 0,
    ),
    recentSamples: readings.slice(-12).map((reading) => ({
      created_at: reading.created_at,
      device_id: reading.device_id,
      wine_temperature: toNumber(reading.wine_temperature),
      ambient_temperature: toNumber(reading.ambient_temperature),
      ambient_humidity: toNumber(reading.ambient_humidity),
      ph: toNumber(reading.ph),
      light: toNumber(reading.light),
      movement: toBool(reading.movement),
    })),
  };
}

function summarizeMetric(readings: Reading[], key: ReadingMetric): MetricSummary {
  const values = readings
    .map((reading) => toNumber(reading[key]))
    .filter((value): value is number => value !== null);
  const latest = readings
    .slice()
    .reverse()
    .map((reading) => toNumber(reading[key]))
    .find((value): value is number => value !== null);
  const meta = METRICS[key];

  if (values.length === 0) {
    return {
      key,
      label: meta.label,
      unit: meta.unit,
      count: 0,
      min: null,
      max: null,
      avg: null,
      latest: null,
    };
  }

  const sum = values.reduce((total, value) => total + value, 0);

  return {
    key,
    label: meta.label,
    unit: meta.unit,
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
    latest: latest ?? null,
  };
}

function buildPrompt(
  payload: ReturnType<typeof buildFermentationPayload>,
  rangeLabel: string,
) {
  return [
    "Eres un enólogo y analista de datos IoT para fermentación de vino.",
    `Analiza estos datos reales de sensores del período: ${rangeLabel}. Responde en español.`,
    "No inventes mediciones que no estén en los datos. Si falta una variable, dilo.",
    "Entrega un reporte breve con estas secciones exactas:",
    "1. Estado general",
    "2. Evidencias de los sensores",
    "3. Riesgos o desviaciones",
    "4. Acciones recomendadas",
    "Usa rangos y promedios cuando ayuden. Enfócate en temperatura del vino, pH, humedad, luz, movimiento y estabilidad.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function formatOpenRouterError(status: number, openRouter: OpenRouterResponse) {
  const message =
    openRouter.error?.message ??
    "OpenRouter no pudo generar el análisis de fermentación.";

  if (status === 401 || status === 403) {
    return [
      `OpenRouter rechazó la solicitud (${status}): ${message}`,
      "Revisa que OPENROUTER_API_KEY sea correcta y que el modelo gratuito esté disponible para tu cuenta.",
    ].join(" ");
  }

  if (status === 402 || status === 429) {
    return [
      `OpenRouter respondió con error ${status}: ${message}`,
      "Los modelos gratuitos tienen límites y pueden saturarse. Prueba más tarde o cambia a otro modelo con sufijo :free.",
    ].join(" ");
  }

  if (status === 404) {
    return [
      `OpenRouter respondió con error 404: ${message}`,
      "El modelo gratuito solicitado no está disponible en este momento. La app usa openrouter/free para elegir automáticamente otro modelo gratis cuando sea posible.",
    ].join(" ");
  }

  return `OpenRouter respondió con error ${status}: ${message}`;
}