-- Pure synthetic comparisons: no customer rows, claims or sends.
DO $test$
DECLARE sample record;
BEGIN
  FOR sample IN SELECT * FROM (VALUES
    ('same text', 'same text', true),
    (E'first\nsecond', 'first second', true),
    (E'first\r\nsecond', 'first second', true),
    (E'first\nsecond', E'first\nsecond', true),
    (E'first\n\nsecond', 'first  second', true),
    (E'first\nsecond', 'first changed', false),
    ('first second', 'first  second', false),
    ('https://example.test/#invite=abc', 'https://example.test/#invite=abd', false),
    ('No billing 😊', 'Billing 😊', false)
  ) AS cases(expected, actual, accepted)
  LOOP
    IF (sample.actual=sample.expected OR sample.actual=replace(replace(sample.expected,E'\r\n',' '),E'\n',' ')) IS DISTINCT FROM sample.accepted THEN
      RAISE EXCEPTION 'Native line-break comparison failed: %', sample;
    END IF;
  END LOOP;
END;
$test$;
