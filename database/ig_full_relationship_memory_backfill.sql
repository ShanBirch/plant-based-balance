-- Force one full-history relationship-memory bootstrap after v2 ships.
-- The scheduled extractor processes 30 active threads per run, stamps the
-- v2 compaction into ig_threads.custom_data, then returns to incremental work.
UPDATE public.ig_threads
SET last_memory_extracted_at = NULL
WHERE last_inbound_at IS NOT NULL
  AND CASE
    WHEN custom_data -> 'relationship_memory_compaction' ->> 'version' ~ '^\d+$'
      THEN (custom_data -> 'relationship_memory_compaction' ->> 'version')::integer
    ELSE 0
  END < 2;
