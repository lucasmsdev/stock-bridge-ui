
-- Add tracking columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS carrier text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_status text DEFAULT 'pending_shipment';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_updated_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_history jsonb DEFAULT '[]'::jsonb;

-- Create index for tracking queries
CREATE INDEX IF NOT EXISTS idx_orders_shipping_status ON public.orders (shipping_status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON public.orders (tracking_code);
