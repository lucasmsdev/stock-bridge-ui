-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the competitor price check function to run every 6 hours
SELECT cron.schedule(
  'check-competitor-prices',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT
    net.http_post(
      url := 'https://fcvwogaqarkuqvumyqqm.supabase.co/functions/v1/check-competitor-prices',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjdndvZ2FxYXJrdXF2dW15cXFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjM2MDAsImV4cCI6MjA3MjU5OTYwMH0.NNf4sIZNSwFyNXFPUlNRxAl5mz0TJ0Rd5FR3mtMWxuo"}'::jsonb,
      body := '{"source": "cron"}'::jsonb
    ) as request_id;
  $$
);