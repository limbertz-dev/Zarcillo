-- whatsapp_alert_log: registro de cada alerta crítica enviada por WhatsApp.
-- Sirve para (a) deduplicar (no reenviar la misma alerta cada 5 s mientras el
-- valor sigue fuera de umbral) y (b) auditar qué se notificó.
--
-- Una fila por (device_id, metric, sent_at). La Edge Function consulta la
-- última fila para ese par y reenvía sólo si pasó más de DEDUP_WINDOW_MIN.

create table if not exists public.whatsapp_alert_log (
  id           bigserial primary key,
  device_id    text        not null,
  metric       text        not null,
  level        text        not null,
  value        numeric,
  message      text        not null,
  to_number    text        not null,
  twilio_sid   text,
  sent_at      timestamptz not null default now()
);

create index if not exists whatsapp_alert_log_device_metric_sent_idx
  on public.whatsapp_alert_log (device_id, metric, sent_at desc);

comment on table public.whatsapp_alert_log is
  'Registro de alertas críticas Zarcillo enviadas por WhatsApp (Twilio).';
