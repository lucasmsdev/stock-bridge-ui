-- Create product_listings table to map UNISTOCK products to platform-specific IDs
CREATE TABLE product_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Platform identification
  platform text NOT NULL CHECK (platform IN ('mercadolivre', 'shopify', 'shopee', 'amazon')),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  
  -- Platform product IDs
  platform_product_id text NOT NULL,
  platform_variant_id text,
  platform_url text,
  
  -- Sync status
  sync_status text NOT NULL DEFAULT 'active' CHECK (sync_status IN ('active', 'paused', 'error', 'deleted')),
  last_sync_at timestamp with time zone,
  sync_error text,
  
  -- Platform-specific metadata
  platform_metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(product_id, integration_id)
);

-- Add indexes for performance
CREATE INDEX idx_listings_product_id ON product_listings(product_id);
CREATE INDEX idx_listings_platform ON product_listings(platform);
CREATE INDEX idx_listings_integration ON product_listings(integration_id);
CREATE INDEX idx_listings_sync_status ON product_listings(sync_status);

-- Enable RLS
ALTER TABLE product_listings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own listings"
ON product_listings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own listings"
ON product_listings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings"
ON product_listings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listings"
ON product_listings FOR DELETE
USING (auth.uid() = user_id);

-- Add additional fields to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS weight numeric,
ADD COLUMN IF NOT EXISTS dimensions jsonb DEFAULT '{"length": 0, "width": 0, "height": 0}'::jsonb,
ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS condition text DEFAULT 'new' CHECK (condition IN ('new', 'used', 'refurbished'));

-- Add trigger for updated_at on product_listings
CREATE TRIGGER update_product_listings_updated_at
BEFORE UPDATE ON product_listings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();