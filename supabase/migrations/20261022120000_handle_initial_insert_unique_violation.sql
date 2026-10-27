-- Migration: 20261022120000_handle_initial_insert_unique_violation.sql
-- Descrição: Trata concorrência no primeiro INSERT de save_account_preferences,
-- convertendo a violação de chave primária concorrente (23505) em 40001 (preference revision conflict).

CREATE OR REPLACE FUNCTION public.save_account_preferences(
  p_expected_revision bigint,
  p_display_unit text,
  p_preferences jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  caller uuid := auth.uid();
  result public.account_preferences;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'authenticated identity required' USING errcode = '42501';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0
    OR p_display_unit NOT IN ('kg', 'lb')
    OR p_preferences IS NULL OR jsonb_typeof(p_preferences) <> 'object'
    OR octet_length(p_preferences::text) > 262144 THEN
    RAISE EXCEPTION 'invalid account preferences' USING errcode = '22023';
  END IF;
  SELECT * INTO result FROM public.account_preferences WHERE user_id = caller FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_revision <> 0 THEN RAISE EXCEPTION 'preference revision conflict' USING errcode = '40001'; END IF;
    BEGIN
      INSERT INTO public.account_preferences (user_id, display_unit, preferences)
      VALUES (caller, p_display_unit, p_preferences) RETURNING * INTO result;
      RETURN to_jsonb(result);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'preference revision conflict' USING errcode = '40001';
    END;
  END IF;
  IF result.revision <> p_expected_revision THEN RAISE EXCEPTION 'preference revision conflict' USING errcode = '40001'; END IF;
  UPDATE public.account_preferences SET revision = revision + 1, display_unit = p_display_unit, preferences = p_preferences, updated_at = now()
  WHERE user_id = caller RETURNING * INTO result;
  RETURN to_jsonb(result);
END;
$function$;
