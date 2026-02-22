-- ============================================
-- SOFIA - Knowledge System Database Schema
-- Run this in Supabase SQL Editor (one time)
-- ============================================

-- 1. Create the prompts table
CREATE TABLE prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Processing', 'Completed', 'Failed', 'Archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- 2. Create the entries table
CREATE TABLE entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Decision', 'Brainstorm', 'Shopping', 'Observation', 'Draft')),
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  summary TEXT,
  source_prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  original_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indexes for fast queries
CREATE INDEX idx_prompts_user ON prompts(user_id);
CREATE INDEX idx_prompts_status ON prompts(status);
CREATE INDEX idx_entries_user ON entries(user_id);
CREATE INDEX idx_entries_category ON entries(category);
CREATE INDEX idx_entries_source ON entries(source_prompt_id);
CREATE INDEX idx_entries_created ON entries(created_at DESC);

-- 4. Enable full-text search on entries
ALTER TABLE entries ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(summary, ''))
  ) STORED;

CREATE INDEX idx_entries_fts ON entries USING GIN(fts);

-- 5. Enable Row Level Security (each user sees only their data)
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own data
CREATE POLICY "Users see own prompts" ON prompts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own entries" ON entries
  FOR ALL USING (auth.uid() = user_id);

-- Allow inserts with user_id matching auth
CREATE POLICY "Users insert own prompts" ON prompts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users insert own entries" ON entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
