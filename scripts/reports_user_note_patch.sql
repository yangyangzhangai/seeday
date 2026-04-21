-- Migration: add user_note column to reports table
-- Run this in the Supabase SQL Editor once.
-- The column stores the user's manually written diary note for a report.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS user_note TEXT;
