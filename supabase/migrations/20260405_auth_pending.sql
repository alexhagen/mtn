-- Auth pending table for Expo Go OAuth relay
-- This table temporarily stores auth tokens during the OAuth flow
-- when using external browser redirect (Expo Go workaround)

CREATE TABLE IF NOT EXISTS auth_pending (
  nonce TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE auth_pending ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert (when web callback saves tokens)
CREATE POLICY "anon can insert auth_pending"
  ON auth_pending
  FOR INSERT
  WITH CHECK (true);

-- Allow anonymous users to select (when native app polls for tokens)
CREATE POLICY "anon can select auth_pending"
  ON auth_pending
  FOR SELECT
  USING (true);

-- Allow anonymous users to delete (when native app cleans up after retrieving tokens)
CREATE POLICY "anon can delete auth_pending"
  ON auth_pending
  FOR DELETE
  USING (true);

-- Auto-cleanup: delete records older than 10 minutes
-- This prevents the table from growing indefinitely
CREATE OR REPLACE FUNCTION cleanup_auth_pending()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_pending
  WHERE created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a cron job to run cleanup periodically
-- Note: This requires pg_cron extension which may not be available on all Supabase plans
-- If not available, you can manually run cleanup_auth_pending() periodically
COMMENT ON FUNCTION cleanup_auth_pending() IS 'Cleanup auth_pending records older than 10 minutes. Run periodically via cron or manually.';
