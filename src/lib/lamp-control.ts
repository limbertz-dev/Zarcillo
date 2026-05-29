export const LAMP_COMMAND_ENDPOINT =
  process.env.NEXT_PUBLIC_LAMP_COMMAND_ENDPOINT ?? "";

export function isLampEndpointConfigured(): boolean {
  return LAMP_COMMAND_ENDPOINT.trim().length > 0;
}

export type LampCommandPayload = {
  device_id: string;
  lamp: boolean;
};

export async function setLampState(
  deviceId: string,
  lampOn: boolean,
): Promise<void> {
  if (!isLampEndpointConfigured()) {
    throw new Error("Endpoint de control de lámpara no configurado");
  }

  const payload: LampCommandPayload = {
    device_id: deviceId,
    lamp: lampOn,
  };

  let response: Response;
  try {
    response = await fetch(LAMP_COMMAND_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`No se pudo contactar FlowFuse: ${detail}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `FlowFuse respondió ${response.status} ${response.statusText}${
        body ? ` — ${body}` : ""
      }`,
    );
  }
}
