-- Migration: 20261022110000_remove_redundant_advisory_locks.sql
-- Removes redundant pg_advisory_xact_lock in save_account_preferences and save_athlete_plan.
-- Row-level locking (SELECT ... FOR UPDATE) and optimistic revision checks on primary keys
-- provide complete serializability without risk of orphan advisory locks or connection starvation.

CREATE OR REPLACE FUNCTION public.save_account_preferences(
  p_expected_revision bigint,
  p_display_unit text,
  p_preferences jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE caller uuid := auth.uid(); result public.account_preferences;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'authenticated identity required' USING errcode = '42501'; END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0
    OR p_display_unit NOT IN ('kg','lb')
    OR p_preferences IS NULL OR jsonb_typeof(p_preferences) <> 'object'
    OR octet_length(p_preferences::text) > 262144 THEN
    RAISE EXCEPTION 'invalid account preferences' USING errcode = '22023';
  END IF;
  SELECT * INTO result FROM public.account_preferences WHERE user_id = caller FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_revision <> 0 THEN RAISE EXCEPTION 'preference revision conflict' USING errcode = '40001'; END IF;
    INSERT INTO public.account_preferences(user_id, display_unit, preferences)
    VALUES(caller, p_display_unit, p_preferences) RETURNING * INTO result;
    RETURN to_jsonb(result);
  END IF;
  IF result.revision <> p_expected_revision THEN RAISE EXCEPTION 'preference revision conflict' USING errcode = '40001'; END IF;
  UPDATE public.account_preferences
    SET revision = revision + 1, display_unit = p_display_unit, preferences = p_preferences, updated_at = now()
    WHERE user_id = caller RETURNING * INTO result;
  RETURN to_jsonb(result);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_athlete_plan(
  p_expected_revision bigint,
  p_mode text,
  p_schedule jsonb,
  p_routines jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE caller uuid := auth.uid(); result public.athlete_schedules;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'authenticated identity required' USING errcode = '42501'; END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0
    OR p_mode NOT IN ('weekly','daily')
    OR p_schedule IS NULL OR jsonb_typeof(p_schedule) <> 'object'
    OR p_routines IS NULL OR jsonb_typeof(p_routines) <> 'array'
    OR jsonb_array_length(p_routines) > 200
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_routines) item
      WHERE jsonb_typeof(item) <> 'object'
        OR coalesce(item->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        OR char_length(btrim(coalesce(item->>'title',''))) NOT BETWEEN 1 AND 160
        OR jsonb_typeof(coalesce(item->'prescription','null'::jsonb)) <> 'object'
    ) THEN RAISE EXCEPTION 'invalid athlete plan' USING errcode = '22023'; END IF;
  SELECT * INTO result FROM public.athlete_schedules WHERE user_id = caller FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_revision <> 0 THEN RAISE EXCEPTION 'plan revision conflict' USING errcode = '40001'; END IF;
    INSERT INTO public.athlete_schedules(user_id, mode, schedule) VALUES(caller, p_mode, p_schedule) RETURNING * INTO result;
  ELSE
    IF result.revision <> p_expected_revision THEN RAISE EXCEPTION 'plan revision conflict' USING errcode = '40001'; END IF;
    UPDATE public.athlete_schedules SET revision = revision + 1, mode = p_mode, schedule = p_schedule, updated_at = now()
      WHERE user_id = caller RETURNING * INTO result;
  END IF;
  DELETE FROM public.athlete_routines WHERE user_id = caller AND id NOT IN (SELECT (item->>'id')::uuid FROM jsonb_array_elements(p_routines) item);
  INSERT INTO public.athlete_routines(id, user_id, title, position, prescription)
    SELECT (item->>'id')::uuid, caller, item->>'title', ordinality - 1, item->'prescription'
    FROM jsonb_array_elements(p_routines) WITH ORDINALITY VALUES(item, ordinality)
  ON CONFLICT (id) DO UPDATE SET title = excluded.title, position = excluded.position, prescription = excluded.prescription,
    revision = public.athlete_routines.revision + 1, updated_at = now()
    WHERE public.athlete_routines.user_id = caller;
  RETURN jsonb_build_object('routines', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.position) FROM public.athlete_routines r WHERE r.user_id = caller), '[]'::jsonb), 'schedule', to_jsonb(result));
END;
$$;
