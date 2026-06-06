-- Programa la ejecución de la Edge Function check-offline-devices cada 5
-- minutos usando pg_cron + pg_net.
--
-- Requiere que estas extensiones estén habilitadas en el proyecto:
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
-- En Supabase Cloud ambas se activan desde Dashboard → Database → Extensions.
-- Si no podés activarlas, podés invocar la función desde un cron externo
-- (GitHub Actions, Vercel Cron, etc.) y omitir esta migración.
--
-- Reemplazar:
--   <PROJECT_REF>  con el ref del proyecto Supabase (ej. abcd1234efgh.supabase.co)
--   <ANON_KEY>     con la anon key del proyecto (se usa sólo para autenticar la
--                  llamada al endpoint público de la function; la function
--                  internamente usa el service role para consultar la BD).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Borra el job si ya existía (idempotente)
do $$
declare
  jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'zarcillo_check_offline';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end$$;

select cron.schedule(
  'zarcillo_check_offline',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://vndxwvmrsymxprgwhsup.supabase.co/functions/v1/check-offline-devices',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZHh3dm1yc3lteHByZ3doc3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NzkyMjEsImV4cCI6MjA5NTE1NTIyMX0.KW2Epmh055-ILFBWUB7lT6x4sIZSIjtY63yelIsSZfE'
    ),
    body    := '{}'::jsonb
  );
  $$
);
