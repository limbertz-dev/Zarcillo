-- Seed de lecturas historicas fake para probar Zarcillo sin sensores fisicos.
--
-- Uso en Supabase SQL Editor:
-- 1. Cambia el valor de scenario en el CTE params.
-- 2. Ejecuta todo el archivo.
--
-- Escenarios disponibles:
-- normal, frio, caliente, mucha_luz, ph_invalido, movimiento_activo,
-- datos_insuficientes, sin_conexion
--
-- Notas:
-- - Inserta datos en public.readings sin tocar MQTT, FlowFuse, Azure ni la app.
-- - Para el escenario normal genera 24 horas con datos cada 5 minutos.
-- - Inserta ambos device_id existentes:
--   esp32_nivel_2_001 y esp32_nivel_2_mpu_001.
-- - No borra datos existentes. Si ejecutas varias veces, se acumularan lecturas.

with params as (
  select
    'normal'::text as scenario,
    now() as base_now
),
scenario_config as (
  select
    scenario,
    base_now,
    case
      when scenario = 'datos_insuficientes' then 3
      else 288
    end as points,
    interval '5 minutes' as step_size,
    case
      when scenario = 'sin_conexion' then base_now - interval '90 minutes'
      else base_now - interval '1 minute'
    end as end_time
  from params
),
series as (
  select
    sc.scenario,
    sc.points,
    gs.i,
    sc.end_time - ((sc.points - 1 - gs.i) * sc.step_size) as created_at,
    case
      when sc.points <= 1 then 1::numeric
      else gs.i::numeric / (sc.points - 1)
    end as progress
  from scenario_config sc
  cross join lateral generate_series(0, sc.points - 1) as gs(i)
),
shaped as (
  select
    *,
    case
      when progress < 0.25 then 'early'
      when progress < 0.75 then 'middle'
      else 'late'
    end as phase,
    sin(i * 0.37) as wave_a,
    sin(i * 0.19 + 1.4) as wave_b,
    cos(i * 0.11) as wave_c,
    random() as r1,
    random() as r2,
    random() as r3
  from series
),
env_rows as (
  select
    'esp32_nivel_2_001'::text as device_id,
    created_at,
    round((
      case
        when scenario = 'frio' then 13.2 + wave_a * 0.5 + r1 * 0.3
        when scenario = 'caliente' then 33.0 + wave_a * 0.9 + r1 * 0.5
        when phase = 'early' then 21.0 + progress * 8.0 + wave_a * 0.45 + r1 * 0.35
        when phase = 'middle' then 21.2 + wave_a * 0.35 + r1 * 0.25
        else 21.1 + wave_a * 0.16 + r1 * 0.08
      end)::numeric,
      2
    ) as wine_temperature,
    round((
      case
        when scenario = 'frio' then 15.0 + wave_b * 0.7 + r2 * 0.5
        when scenario = 'caliente' then 30.0 + wave_b * 1.0 + r2 * 0.7
        when phase = 'early' then 22.0 + wave_b * 1.1 + r2 * 1.2
        when phase = 'middle' then 22.0 + wave_b * 0.8 + r2 * 0.7
        else 21.8 + wave_b * 0.35 + r2 * 0.3
      end)::numeric,
      2
    ) as ambient_temperature,
    round((
      case
        when scenario = 'caliente' then 48.0 + wave_c * 4.0 + r3 * 3.0
        when phase = 'early' then 55.0 + r2 * 15.0 + wave_c * 2.0
        when phase = 'middle' then 60.0 + r2 * 8.0 + wave_c * 1.5
        else 62.0 + r2 * 4.0 + wave_c
      end)::numeric,
      2
    ) as ambient_humidity,
    round((
      case
        when scenario = 'mucha_luz' then 3300.0 + r1 * 550.0 + wave_a * 120.0
        when phase = 'early' then 800.0 + r1 * 1000.0 + wave_a * 80.0
        when phase = 'middle' then 600.0 + r1 * 750.0 + wave_a * 60.0
        else 450.0 + r1 * 350.0 + wave_a * 35.0
      end)::numeric
    ) as light,
    round((
      case
        when scenario = 'ph_invalido' then 5.2 + wave_b * 0.08 + r2 * 0.05
        when phase = 'early' then 3.65 - progress * 0.6 + wave_b * 0.03 + r2 * 0.04
        when phase = 'middle' then 3.50 + wave_b * 0.04 + r2 * 0.03
        else 3.49 + wave_b * 0.015 + r2 * 0.01
      end)::numeric,
      3
    ) as ph,
    scenario,
    phase,
    i
  from shaped
),
mpu_rows as (
  select
    'esp32_nivel_2_mpu_001'::text as device_id,
    created_at,
    round((
      case
        when scenario = 'movimiento_activo' then 0.04 + wave_a * 0.12 + r1 * 0.08
        when phase = 'early' then wave_a * 0.035 + r1 * 0.025
        when phase = 'middle' then wave_a * 0.012 + r1 * 0.008
        else wave_a * 0.004 + r1 * 0.003
      end)::numeric,
      4
    ) as accel_x,
    round((
      case
        when scenario = 'movimiento_activo' then -0.02 + wave_b * 0.10 + r2 * 0.08
        when phase = 'early' then wave_b * 0.035 + r2 * 0.025
        when phase = 'middle' then wave_b * 0.012 + r2 * 0.008
        else wave_b * 0.004 + r2 * 0.003
      end)::numeric,
      4
    ) as accel_y,
    round((
      case
        when scenario = 'movimiento_activo' then 1.0 + wave_c * 0.16 + r3 * 0.08
        when phase = 'early' then 1.0 + wave_c * 0.035 + r3 * 0.02
        when phase = 'middle' then 1.0 + wave_c * 0.012 + r3 * 0.008
        else 1.0 + wave_c * 0.004 + r3 * 0.003
      end)::numeric,
      4
    ) as accel_z,
    round((
      case
        when scenario = 'movimiento_activo' then wave_a * 18.0 + r1 * 9.0
        when phase = 'early' then wave_a * 2.2 + r1 * 1.5
        when phase = 'middle' then wave_a * 0.45 + r1 * 0.25
        else wave_a * 0.10 + r1 * 0.06
      end)::numeric,
      3
    ) as gyro_x,
    round((
      case
        when scenario = 'movimiento_activo' then wave_b * 16.0 + r2 * 8.0
        when phase = 'early' then wave_b * 2.0 + r2 * 1.3
        when phase = 'middle' then wave_b * 0.40 + r2 * 0.22
        else wave_b * 0.10 + r2 * 0.06
      end)::numeric,
      3
    ) as gyro_y,
    round((
      case
        when scenario = 'movimiento_activo' then wave_c * 14.0 + r3 * 8.0
        when phase = 'early' then wave_c * 1.8 + r3 * 1.1
        when phase = 'middle' then wave_c * 0.35 + r3 * 0.20
        else wave_c * 0.08 + r3 * 0.05
      end)::numeric,
      3
    ) as gyro_z,
    case
      when scenario = 'movimiento_activo' then i % 2 = 0
      when phase = 'early' then i % 9 = 0
      when phase = 'middle' then i % 47 = 0
      else false
    end as movement
  from shaped
),
insert_env as (
  insert into public.readings (
    device_id,
    light,
    created_at,
    level,
    ambient_temperature,
    ambient_humidity,
    wine_temperature,
    accel_x,
    accel_y,
    accel_z,
    gyro_x,
    gyro_y,
    gyro_z,
    movement,
    ph,
    ph_voltage
  )
  select
    device_id,
    greatest(0, light)::integer,
    created_at,
    null::numeric,
    ambient_temperature,
    ambient_humidity,
    wine_temperature,
    null::numeric,
    null::numeric,
    null::numeric,
    null::numeric,
    null::numeric,
    null::numeric,
    case
      when scenario = 'movimiento_activo' then i % 3 = 0
      when phase = 'early' then i % 12 = 0
      else false
    end,
    ph,
    round((ph * 0.42 + 0.18 + random() * 0.02)::numeric, 3)
  from env_rows
  returning 1
),
insert_mpu as (
  insert into public.readings (
    device_id,
    light,
    created_at,
    level,
    ambient_temperature,
    ambient_humidity,
    wine_temperature,
    accel_x,
    accel_y,
    accel_z,
    gyro_x,
    gyro_y,
    gyro_z,
    movement,
    ph,
    ph_voltage
  )
  select
    device_id,
    null::integer,
    created_at,
    null::numeric,
    null::numeric,
    null::numeric,
    null::numeric,
    accel_x,
    accel_y,
    accel_z,
    gyro_x,
    gyro_y,
    gyro_z,
    movement,
    null::numeric,
    null::numeric
  from mpu_rows
  returning 1
)
select
  (select scenario from params) as scenario,
  (select count(*) from insert_env) as env_rows_inserted,
  (select count(*) from insert_mpu) as mpu_rows_inserted,
  (select count(*) from insert_env) + (select count(*) from insert_mpu)
    as total_rows_inserted;
