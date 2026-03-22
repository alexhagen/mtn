-- Daily Summaries Table
-- Stores generated daily summaries with 7-day retention

-- Daily summaries (cached for 7 days)
CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
  topic_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, topic_id, generated_at)
);

-- Enable Row-Level Security
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own summaries
DROP POLICY IF EXISTS "Users can view own summaries" ON daily_summaries;
CREATE POLICY "Users can view own summaries" ON daily_summaries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own summaries" ON daily_summaries;
CREATE POLICY "Users can insert own summaries" ON daily_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own summaries" ON daily_summaries;
CREATE POLICY "Users can update own summaries" ON daily_summaries
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own summaries" ON daily_summaries;
CREATE POLICY "Users can delete own summaries" ON daily_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_id ON daily_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_topic_id ON daily_summaries(topic_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_expires_at ON daily_summaries(expires_at);

-- Function to automatically delete expired summaries
CREATE OR REPLACE FUNCTION delete_expired_summaries()
RETURNS void AS $$
BEGIN
  DELETE FROM daily_summaries WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule automatic cleanup (requires pg_cron extension)
-- Note: This requires the pg_cron extension to be enabled in Supabase
-- Alternatively, you can run this manually or via a scheduled job
-- SELECT cron.schedule('delete-expired-summaries', '0 0 * * *', 'SELECT delete_expired_summaries()');

-- For now, we'll rely on application-level cleanup or manual execution
-- To manually clean up expired summaries, run: SELECT delete_expired_summaries();
