-- Red Lines, ticket #22: the seed set, and keeping a deleted Red Line's mark.
--
-- 1. `red_line_seeds`: one row per Reader who has been given the seed set.
--    Whether to seed can't be read off red_lines alone: a Reader who deletes
--    every Red Line would look new again and get the seeds back. The marker
--    row is written once and never removed (it goes only with the account),
--    so seeding happens at most once per Reader.
--
-- 2. `seed_red_lines(p_texts)`: writes the marker and, only if this call is
--    the one that wrote it, inserts p_texts as the Reader's Red Lines, in
--    order. Both in one transaction, so a failure leaves neither. Two calls at
--    once (two tabs) can't both seed: the primary key lets one insert through
--    and the other does nothing. Returns true when it seeded. The seed wording
--    lives in lib/red-lines/seed.js, not here, so there is one copy of it.
--    SECURITY INVOKER: every insert passes the same row-level security as a
--    direct one.
--
-- 3. `flags.matched_red_line_text`: the wording of the Red Line a Flag broke,
--    as the analysis was told it. matched_red_line_id is set to null when the
--    Red Line is deleted (20261002000400_flags.sql), which would otherwise
--    leave a promoted Flag with no mark saying why. The analysis's
--    red_lines_snapshot still lists the Red Line; this keeps the link from
--    the Flag to it. `save_analysis` is replaced to write it.

create table public.red_line_seeds (
  reader_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  seeded_at timestamptz not null default now()
);

alter table public.red_line_seeds enable row level security;

revoke all on table public.red_line_seeds from anon;

create policy "Readers see their own seed marker"
  on public.red_line_seeds for select to authenticated
  using (reader_id = (select auth.uid()));

create policy "Readers write their own seed marker"
  on public.red_line_seeds for insert to authenticated
  with check (reader_id = (select auth.uid()));

create function public.seed_red_lines(p_texts text[])
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  inserted integer;
begin
  if me is null then
    raise exception 'seed_red_lines needs a signed-in Reader';
  end if;

  insert into public.red_line_seeds (reader_id) values (me)
  on conflict (reader_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;

  -- One microsecond apart, so listing by created_at keeps the seed order.
  insert into public.red_lines (reader_id, text, created_at, updated_at)
  select me, t.text, now() + make_interval(secs => t.ord / 1000000.0), now() + make_interval(secs => t.ord / 1000000.0)
  from unnest(coalesce(p_texts, '{}'::text[])) with ordinality as t(text, ord);

  return true;
end;
$$;

revoke all on function public.seed_red_lines(text[]) from public, anon;
grant execute on function public.seed_red_lines(text[]) to authenticated;

alter table public.flags add column matched_red_line_text text;

create or replace function public.save_analysis(
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
    why_dangerous, counter_offer, matched_red_line_id, matched_red_line_text,
    position, order_index
  )
  select
    new_id, f.severity, f.clause_type, f.source_sentence, f.what_it_means,
    f.why_dangerous, f.counter_offer, f.matched_red_line_id, f.matched_red_line_text,
    f.position, f.order_index
  from jsonb_to_recordset(p_flags) as f(
    severity text,
    clause_type text,
    source_sentence text,
    what_it_means text,
    why_dangerous text,
    counter_offer text,
    matched_red_line_id uuid,
    matched_red_line_text text,
    position integer,
    order_index integer
  );

  return new_id;
end;
$$;
