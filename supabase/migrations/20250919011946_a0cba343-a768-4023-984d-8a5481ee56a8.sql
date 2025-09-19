-- Enable real-time subscriptions for price_monitoring_jobs table
ALTER TABLE public.price_monitoring_jobs REPLICA IDENTITY FULL;

-- Add the table to supabase_realtime publication to enable real-time functionality
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_monitoring_jobs;