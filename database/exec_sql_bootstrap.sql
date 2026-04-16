-- One-time bootstrap: installs two helper RPCs used to run any SQL / query
-- against this Supabase project via the REST API (service_role only).
--
-- Without these, PostgREST only exposes predefined functions — there's no
-- way to run arbitrary DDL (ALTER TABLE, CREATE TRIGGER, etc.) or ad-hoc
-- SELECTs without opening the Supabase SQL Editor UI.
--
-- Security: both functions are locked to service_role. The service_role JWT
-- lives only in Netlify env vars (never shipped to clients), so exec_sql is
-- not reachable from the public PostgREST surface with anon / authenticated
-- tokens. REVOKEs below make this explicit so a future schema-refresh can't
-- accidentally expose them.
--
-- Usage from a backend script / CLI:
--   POST /rest/v1/rpc/exec_sql      {"sql": "ALTER TABLE foo ADD COLUMN bar int;"}
--   POST /rest/v1/rpc/exec_sql_json {"sql": "SELECT id FROM foo LIMIT 5;"}
--
-- Applied 2026-04-16. Safe to re-run.

CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    EXECUTE sql;
    RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.exec_sql_json(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r jsonb;
BEGIN
    EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql || ') t' INTO r;
    RETURN COALESCE(r, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

REVOKE ALL ON FUNCTION public.exec_sql_json(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql_json(text) TO service_role;
