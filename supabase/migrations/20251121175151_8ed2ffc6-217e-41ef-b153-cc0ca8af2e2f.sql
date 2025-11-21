-- Habilitar extensão pg_cron para agendamento de tarefas
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar extensão pg_net para chamadas HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar cron job para rotação automática de tokens a cada 1 hora
SELECT cron.schedule(
  'refresh-integration-tokens-hourly',
  '0 * * * *', -- A cada hora no minuto 0
  $$
  SELECT
    net.http_post(
        url:='https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/refresh-integration-tokens',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjdndvZ2FxYXJrdXF2dW15cXFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjM2MDAsImV4cCI6MjA3MjU5OTYwMH0.NNf4sIZNSwFyNXFPUlNRxAl5mz0TJ0Rd5FR3mtMWxuo"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);