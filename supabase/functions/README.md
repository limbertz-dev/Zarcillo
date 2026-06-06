# Alertas WhatsApp (Twilio Sandbox)

Pipeline de notificación de las alertas críticas de Zarcillo al número
`+591 67677773` por WhatsApp.

## Qué envía

| Disparo | Métrica | Cuándo |
|---|---|---|
| `notify-whatsapp-alert` (INSERT webhook) | `ambient_temperature` | < 10 °C ó > 32 °C |
| `notify-whatsapp-alert` | `ambient_humidity` | < 40 % ó > 90 % |
| `notify-whatsapp-alert` | `wine_temperature` | < 15 °C ó > 32 °C |
| `notify-whatsapp-alert` | `ph` | < 2.9 ó > 4.0 |
| `check-offline-devices` (pg_cron 5 min) | `offline` | sin lecturas > 10 min |

Las **advertencias** (`warning`) y las métricas de giroscopio/movimiento NO
se envían por WhatsApp; sólo se evalúan dentro del dashboard.

Para no spamear, cada par `(device_id, metric)` tiene una ventana de dedup
de `DEDUP_WINDOW_MIN` minutos (default 15) controlada por la tabla
`whatsapp_alert_log`.

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
secret manual.

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

### 6. Probar

Forzar un valor fuera de rango. Por ejemplo desde el SQL editor:

```sql
insert into public.readings (
  device_id, level, ambient_temperature, ambient_humidity,
  wine_temperature, light, ph
) values (
  'esp32_nivel_2_001', 'nivel_2', 38, 50, 22, 800, 3.4
);
-- temp ambiente > 32 °C => debe llegar un WhatsApp en segundos
```

Verificar:

```sql
select * from public.whatsapp_alert_log
order by sent_at desc limit 5;
```

### 7. Probar el offline

Esperar 10 min sin que el firmware publique (o forzar:
`alter system / pause` no aplica, así que basta con apagar el ESP32).
A los 5 min siguientes el cron debe disparar la alerta.

## Diagnóstico

- **Logs de las Edge Functions:** Dashboard → Edge Functions →
  *función* → Logs.
- **Twilio errors:** revisar Console de Twilio → Monitor → Logs →
  Messaging.
- **Webhook no dispara:** revisar Database → Webhooks → Logs.
- **Cron no corre:** `select * from cron.job;` y
  `select * from cron.job_run_details order by start_time desc limit 10;`
