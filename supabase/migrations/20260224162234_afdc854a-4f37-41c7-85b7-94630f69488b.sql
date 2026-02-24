-- Update organization invites to expire in 14 days instead of 7
ALTER TABLE public.organization_invites 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '14 days');

-- Update any existing non-used invites to have more time (optional but consistent)
UPDATE public.organization_invites 
SET expires_at = created_at + interval '14 days'
WHERE used_at IS NULL AND expires_at > now();