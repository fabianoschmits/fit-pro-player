-- Migration: 20261022100000_optimize_performance_and_connection_timeouts.sql
-- Optimizes recurring queries and prevents idle in transaction locks that spike CPU to 100%

-- 1. Index for notification jobs lookup in scheduler dispatch tick
CREATE INDEX IF NOT EXISTS notification_jobs_pending_due_idx 
  ON public.notification_jobs (status, due_at, expires_at) 
  WHERE status = 'pending';

-- 2. Index for workout execution verification
CREATE INDEX IF NOT EXISTS workout_executions_lookup_idx 
  ON public.workout_executions (student_user_id, status, started_at);

-- 3. Index for routines lookup by user & position
CREATE INDEX IF NOT EXISTS athlete_routines_user_pos_idx 
  ON public.athlete_routines (user_id, position);

-- 4. Automatically abort abandoned/hung client transactions after 15s to prevent lock starvation
ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '15s';
ALTER ROLE anon SET idle_in_transaction_session_timeout = '15s';
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '15s';
