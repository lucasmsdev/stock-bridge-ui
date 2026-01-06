INSERT INTO scheduled_reports (user_id, report_type, frequency, format, next_run_at, is_active)
VALUES (
  'd63efe16-662b-4dc2-a3b5-068e4b156f5d',
  'sales',
  'daily',
  'PDF',
  NOW() - INTERVAL '1 hour',
  true
);