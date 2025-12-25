-- Add new columns to orders table for order synchronization
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

-- Add index for faster status filtering
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Add index for order_id_channel uniqueness check
CREATE INDEX IF NOT EXISTS idx_orders_order_id_channel ON public.orders(user_id, order_id_channel, platform);