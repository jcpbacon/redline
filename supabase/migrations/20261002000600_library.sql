-- The library, and saving an analysis in one piece (ticket #21, #19).
--
-- 1. A Flag's Counter-offer is optional. The analysis module returns null when
--    the model drafted none (lib/analysis/index.js), and a Flag without one is
--    still a Flag. The column was created NOT NULL; it now accepts null, and
--    refuses an empty or whitespace-only draft so there is one way to say
--    "none".
--
-- 2. `library_entries`: one row per Document with the date it was last read
--    (analysed), or null if it never was. A security_invoker view, so it runs
--    with the caller's privileges and the documents/analyses policies decide
--    what it returns: a Reader lists only their own Documents.
--
-- 3. `save_analysis(...)`: inserts an analyses row and all of its Flags in one
--    transaction. Two separate inserts could leave an analysis with no Flags
--    if the second failed, and that would read as "Nothing flagged" — a clean
--    verdict the analysis never reached. SECURITY INVOKER, so every insert is
--    checked by the same row-level security as a direct insert.
--
-- 4. `latest_analysis(document_id)`: the most recent analysis of a Document
--    with its Flags in ranked order, or null. Also SECURITY INVOKER: another
--    Reader's Document id returns null, exactly like an id that doesn't exist.

alter table public.flags alter column counter_offer drop not null;

alter table public.flags
  add constraint flags_counter_offer_not_blank
  check (counter_offer is null or char_length(btrim(counter_offer)) > 0);

create view public.library_entries
with (security_invoker = true)
as
select
  d.id,
  d.title,
  d.created_at as saved_at,
  la.analysed_at,
  coalesce(la.analysed_at, d.created_at) as last_activity_at
from public.documents d
left join lateral (
  select max(a.created_at) as analysed_at
  from public.analyses a
  where a.document_id = d.id
) la on true;

comment on view public.library_entries is
  'A Reader''s library: each Document with when it was saved and last analysed. Row-level security on documents and analyses applies (security_invoker).';

revoke all on public.library_entries from anon;

create function public.save_analysis(
  p_document_id uuid,
  p_summary text,
  p_model_id text,
  p_red_lines_snapshot jsonb,
  p_checked jsonb,
  p_flags jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if p_flags is null or jsonb_typeof(p_flags) <> 'array' then
    raise exception 'save_analysis needs p_flags as a JSON array';
  end if;

  insert into public.analyses (document_id, summary, model_id, red_lines_snapshot, checked)
  values (p_document_id, p_summary, p_model_id, p_red_lines_snapshot, p_checked)
  returning id into new_id;

  insert into public.flags (
    analysis_id, severity, clause_type, source_sentence, what_it_means,
    why_dangerous, counter_offer, matched_red_line_id, position, order_index
  )
  select
    new_id, f.severity, f.clause_type, f.source_sentence, f.what_it_means,
    f.why_dangerous, f.counter_offer, f.matched_red_line_id, f.position, f.order_index
  from jsonb_to_recordset(p_flags) as f(
    severity text,
    clause_type text,
    source_sentence text,
    what_it_means text,
    why_dangerous text,
    counter_offer text,
    matched_red_line_id uuid,
    position integer,
    order_index integer
  );

  return new_id;
end;
$$;

create function public.latest_analysis(p_document_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'document_id', a.document_id,
    'summary', a.summary,
    'model_id', a.model_id,
    'red_lines_snapshot', a.red_lines_snapshot,
    'checked', a.checked,
    'created_at', a.created_at,
    'flags', coalesce(
      (select jsonb_agg(to_jsonb(f) order by f.order_index)
       from public.flags f
       where f.analysis_id = a.id),
      '[]'::jsonb
    )
  )
  from public.analyses a
  where a.document_id = p_document_id
  order by a.created_at desc, a.id desc
  limit 1
$$;

revoke all on function public.save_analysis(uuid, text, text, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.latest_analysis(uuid) from public, anon;
grant execute on function public.save_analysis(uuid, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.latest_analysis(uuid) to authenticated;
