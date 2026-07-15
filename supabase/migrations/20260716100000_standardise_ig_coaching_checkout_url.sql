-- Keep historic Netlify coaching links measurable while making the branded
-- Balance domain the one stable URL sent to new leads.

CREATE OR REPLACE FUNCTION public.ig_message_has_coaching_checkout_link(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT lower(COALESCE(p_text, '')) LIKE '%plantbased-balance.org/coaching.html%'
        OR lower(COALESCE(p_text, '')) LIKE '%future-balance.netlify.app/coaching.html%';
$$;

-- The preceding migration was already live when the public URL was
-- standardised. Replace its two URL predicates in-place without duplicating
-- the long, safety-sensitive queue functions.
DO $$
DECLARE
    v_definition TEXT;
    v_updated TEXT;
BEGIN
    SELECT pg_get_functiondef('public.sync_ig_money_funnel_events()'::REGPROCEDURE)
    INTO v_definition;
    v_updated := replace(
        v_definition,
        'lower(COALESCE(m.text, '''')) LIKE ''%future-balance.netlify.app/coaching.html%''',
        'public.ig_message_has_coaching_checkout_link(m.text)'
    );
    IF v_updated = v_definition AND position('ig_message_has_coaching_checkout_link' IN v_definition) = 0 THEN
        RAISE EXCEPTION 'sync_ig_money_funnel_events checkout predicate was not found';
    END IF;
    IF v_updated <> v_definition THEN EXECUTE v_updated; END IF;

    SELECT pg_get_functiondef('public.refresh_ig_money_queue(integer,text)'::REGPROCEDURE)
    INTO v_definition;
    v_updated := replace(
        v_definition,
        'lower(COALESCE(l.outbound_text, '''')) LIKE ''%future-balance.netlify.app/coaching.html%''',
        'public.ig_message_has_coaching_checkout_link(l.outbound_text)'
    );
    IF v_updated = v_definition AND position('ig_message_has_coaching_checkout_link' IN v_definition) = 0 THEN
        RAISE EXCEPTION 'refresh_ig_money_queue checkout predicate was not found';
    END IF;
    IF v_updated <> v_definition THEN EXECUTE v_updated; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ig_message_has_coaching_checkout_link(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ig_message_has_coaching_checkout_link(TEXT) TO service_role;

COMMENT ON FUNCTION public.ig_message_has_coaching_checkout_link(TEXT) IS
    'Recognises the branded coaching checkout page plus historic Netlify links.';
