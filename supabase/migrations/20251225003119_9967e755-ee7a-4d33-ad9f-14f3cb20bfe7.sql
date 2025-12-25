-- Cron job para sincronização automática de pedidos a cada 30 minutos
-- Usa pg_net para fazer chamada HTTP à edge function sync-orders

SELECT cron.schedule(
  'sync-orders-every-30-minutes',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/sync-orders',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjdndvZ2FxYXJrdXF2dW15cXFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjM2MDAsImV4cCI6MjA3MjU5OTYwMH0.NNf4sIZNSwFyNXFPUlNRxAl5mz0TJ0Rd5FR3mtMWxuo'
    ),
    body:=jsonb_build_object('days_since', 1, 'all_users', true)
  ) AS request_id;
  $$
);