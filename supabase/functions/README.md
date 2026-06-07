# Alertas WhatsApp (Twilio Sandbox)

Pipeline de notificación de las **5 alertas oficiales** de Zarcillo al
número `+591 67677773` por WhatsApp.

## Las 5 alertas oficiales

Son las **únicas** alertas que existen en todo el proyecto. Tanto el
dashboard como `/estado` como la Edge Function las usan con los mismos
umbrales.

| # | Alerta | Dispositivo | Métrica | Condición | Nivel |
|---|---|---|---|---|---|
| 1 | Temperatura alta del vino | `esp32_nivel_2_001` | `wine_temperature` | `> 32 °C` | danger |
| 2 | Temperatura baja del vino | `esp32_nivel_2_001` | `wine_temperature` | `< 15 °C` | danger |
| 3 | Exceso de luz             | `esp32_nivel_2_001` | `light`            | `> 3000 ADC` | danger |
| 4 | pH inválido               | `esp32_nivel_2_001` | `ph`               | `< 2.9` o `> 4.0` (null/0 se ignoran) | warning |
| 5 | Movimiento MPU activo     | `esp32_nivel_2_mpu_001` | `movement` / `gyro_*` | `movement=true` o `\|gyro_x\|`, `\|gyro_y\|` o `\|gyro_z\| > 35 °/s` | warning |

**No** disparan WhatsApp (sólo visibles en dashboard):
- `ambient_temperature`, `ambient_humidity` (informativo)
- `accel_x/y/z` (informativo)
- "Sin datos por más de 10 min" — la función `check-offline-devices`
  está como no-op a propósito.

## Anti-spam

En **producción**, cada par `(device_id, metric)` tiene una ventana de
dedup de `DEDUP_WINDOW_MIN` minutos (default **15**) controlada por la
tabla `whatsapp_alert_log`.

## Modo DEMO (sin cooldown)

Para repetir las 5 alertas durante una prueba en vivo sin esperar 15
minutos, setear el secret:

```bash
supabase secrets set DEMO_ALERT_SPAM=true
```

Mientras esté activo, **cada INSERT que dispare una regla envía WhatsApp**,
sin importar `DEDUP_WINDOW_MIN`. Se sigue escribiendo en
`whatsapp_alert_log` para auditar.

> ⚠ **Producción**: terminada la demo, restaurar el cooldown normal:
>
> ```bash
> supabase secrets unset DEMO_ALERT_SPAM
> # o bien:
> supabase secrets set DEMO_ALERT_SPAM=false
> ```
>
> Si se deja activo, cada lectura fuera de rango va a saturar el WhatsApp
> del cliente.

Alternativa equivalente (legacy): `supabase secrets set DEDUP_WINDOW_MIN=0`.

## Setup paso a paso

### 1. Twilio WhatsApp Sandbox

1. Crear cuenta gratis en https://twilio.com.
2. Console → Messaging → Try it out → Send a WhatsApp message.
3. Copiar el número del Sandbox (algo como `+1 415 523 8886`) y la
   palabra clave (`join <palabra-palabra>`).
4. Desde tu WhatsApp (`+591 67677773`) enviar ese mensaje al número del
   Sandbox para que tu número quede suscrito a las pruebas.
5. Copiar `Account SID` y `Auth Token` del dashboard de Twilio.

> Sandbox tiene rate limits y el destinatario tiene que estar suscrito,
> pero es gratis y suficiente para defensa de proyecto. Para producción
> real hay que migrar a un sender de WhatsApp Business API verificado.

### 2. Aplicar migraciones

```bash
cd zarcillo-dashboard
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Esto crea `public.whatsapp_alert_log` y programa el cron de offline.

> Antes de aplicar `20260605000001_offline_cron.sql`, editarlo y
> reemplazar `<PROJECT_REF>` y `<ANON_KEY>` con los valores reales del
> proyecto, porque pg_cron necesita la URL absoluta de la function.

### 3. Configurar secrets

```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 \
  ALERT_TO_NUMBER=whatsapp:+59167677773 \
  DEDUP_WINDOW_MIN=15
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` están disponibles
automáticamente en el runtime de las Edge Functions; no las pongas como
secret manual. `DEMO_ALERT_SPAM` se setea sólo cuando vas a hacer una
demo y se quita al terminar.

### 4. Desplegar las funciones

```bash
supabase functions deploy notify-whatsapp-alert
supabase functions deploy check-offline-devices
```

### 5. Crear el Database Webhook (para INSERT en readings)

En el Dashboard de Supabase:

1. Database → Webhooks → **Create a new hook**
2. Name: `zarcillo_readings_insert_whatsapp`
3. Table: `public.readings`
4. Events: ☑ **Insert** (sólo INSERT)
5. Type: **Supabase Edge Functions**
6. Edge Function: `notify-whatsapp-alert`
7. Method: `POST`
8. HTTP Headers: dejar los defaults (Supabase agrega Authorization).
9. Save.

## Payloads de prueba

Antes de cada prueba, opcionalmente activar modo demo:

```bash
supabase secrets set DEMO_ALERT_SPAM=true
```

### Línea base "todo normal" (resetear después de cada prueba)

```sql
-- ESP32 Principal en condiciones óptimas
insert into public.readings (
  device_id, level,
  ambient_temperature, ambient_humidity,
  wine_temperature, light, ph
) values (
  'esp32_nivel_2_001', 'nivel_2',
  24, 60,
  22, 800, 3.4
);

-- ESP32 MPU6050 quieto
insert into public.readings (
  device_id, level,
  accel_x, accel_y, accel_z,
  gyro_x, gyro_y, gyro_z, movement
) values (
  'esp32_nivel_2_mpu_001', 'nivel_2',
  0.0, 0.0, 1.0,
  1.0, 1.0, 1.0, false
);
```

### Alerta #1 — Temperatura alta del vino (> 32 °C)

```sql
insert into public.readings (
  device_id, level, ambient_temperature, ambient_humidity,
  wine_temperature, light, ph
) values (
  'esp32_nivel_2_001', 'nivel_2', 24, 60, 35, 800, 3.4
);
```

### Alerta #2 — Temperatura baja del vino (< 15 °C)

```sql
insert into public.readings (
  device_id, level, ambient_temperature, ambient_humidity,
  wine_temperature, light, ph
) values (
  'esp32_nivel_2_001', 'nivel_2', 14, 60, 12, 800, 3.4
);
```

### Alerta #3 — Exceso de luz (> 3000 ADC)

```sql
insert into public.readings (
  device_id, level, ambient_temperature, ambient_humidity,
  wine_temperature, light, ph
) values (
  'esp32_nivel_2_001', 'nivel_2', 24, 60, 22, 3500, 3.4
);
```

### Alerta #4 — pH inválido (< 2.9 ó > 4.0)

```sql
-- pH bajo
insert into public.readings (
  device_id, level, ambient_temperature, ambient_humidity,
  wine_temperature, light, ph
) values (
  'esp32_nivel_2_001', 'nivel_2', 24, 60, 22, 800, 2.5
);

-- pH alto
insert into public.readings (
  device_id, level, ambient_temperature, ambient_humidity,
  wine_temperature, light, ph
) values (
  'esp32_nivel_2_001', 'nivel_2', 24, 60, 22, 800, 4.5
);
```

`ph = null` y `ph = 0` **no** disparan alerta (sensor desconectado).

### Alerta #5 — Movimiento MPU activo

```sql
-- vía flag movement=true
insert into public.readings (
  device_id, level,
  accel_x, accel_y, accel_z,
  gyro_x, gyro_y, gyro_z, movement
) values (
  'esp32_nivel_2_mpu_001', 'nivel_2',
  0.0, 0.0, 1.0,
  1.0, 1.0, 1.0, true
);

-- vía pico de giroscopio (|gyro_*| > 35 °/s)
insert into public.readings (
  device_id, level,
  accel_x, accel_y, accel_z,
  gyro_x, gyro_y, gyro_z, movement
) values (
  'esp32_nivel_2_mpu_001', 'nivel_2',
  0.0, 0.0, 1.0,
  50.0, 1.0, 1.0, false
);
```

### Verificar lo que se envió

```sql
select sent_at, device_id, metric, level, value, message
from public.whatsapp_alert_log
order by sent_at desc
limit 20;
```

## Volver a normalidad después de la prueba

1. Re-insertar la lectura baseline de cada dispositivo (ver más arriba).
   El dashboard y `/estado` vuelven a verde inmediatamente porque ambos
   usan la **última** lectura.
2. (Opcional) Limpiar el historial de WhatsApp para reabrir cooldowns:

   ```sql
   -- todo el log (queda vacío)
   delete from public.whatsapp_alert_log;

   -- o sólo una métrica
   delete from public.whatsapp_alert_log
   where device_id = 'esp32_nivel_2_001' and metric = 'wine_temperature';
   ```

3. **Terminada la demo, desactivar el modo spam** para volver al cooldown
   normal de 15 minutos:

   ```bash
   supabase secrets unset DEMO_ALERT_SPAM
   ```

## Diagnóstico

- **Logs de las Edge Functions:** Dashboard → Edge Functions →
  *función* → Logs.
- **Twilio errors:** revisar Console de Twilio → Monitor → Logs →
  Messaging.
- **Webhook no dispara:** revisar Database → Webhooks → Logs.
- **Cron no corre:** `select * from cron.job;` y
  `select * from cron.job_run_details order by start_time desc limit 10;`
