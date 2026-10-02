-- Flags: clauses in a Document that could hurt the Reader, one analysis's worth.
--
-- Every Flag has a non-empty Source Sentence (ADR-0001). The analysis module
-- has already checked it is a verbatim substring of the Document before a row
-- is written; the constraint here only refuses an empty one.
--
-- `severity` must match lib/analysis/severity.js (critical > high > medium).
-- Change both together.
-- `position` is the Source Sentence's index in the Document's extracted text,
-- which ranking uses to break ties. `order_index` is the ranked order the
-- Reader was shown.
-- `matched_red_line_id` is set to null if the Red Line is deleted outright;
-- the Flag itself stays (ADR-0003: Red Lines never remove a Flag).
-- `dismissed_at` marks a Flag the Reader has considered and accepted (story 23).
--
-- Ownership runs through analyses -> documents.

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  severity text not null check (severity in ('critical', 'high', 'medium')),
  clause_type text not null,
  source_sentence text not null check (char_length(btrim(source_sentence)) > 0),
  what_it_means text not null,
  why_dangerous text not null,
  counter_offer text not null,
  matched_red_line_id uuid references public.red_lines (id) on delete set null,
  position integer not null check (position >= 0),
  order_index integer not null check (order_index >= 0),
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (analysis_id, order_index)
);

create index flags_matched_red_line_id_idx on public.flags (matched_red_line_id);

alter table public.flags enable row level security;

revoke all on table public.flags from anon;

-- A foreign key check ignores row-level security, so without the second half
-- of the insert/update checks a Reader could point a Flag at another Reader's
-- Red Line by id. These checks only allow the Reader's own Red Lines.

create policy "Readers see Flags on their own Documents"
  on public.flags for select to authenticated
  using (exists (
    select 1 from public.analyses a
    join public.documents d on d.id = a.document_id
    where a.id = flags.analysis_id and d.reader_id = (select auth.uid())
  ));

create policy "Readers add Flags to their own Documents"
  on public.flags for insert to authenticated
  with check (
    exists (
      select 1 from public.analyses a
      join public.documents d on d.id = a.document_id
      where a.id = flags.analysis_id and d.reader_id = (select auth.uid())
    )
    and (
      matched_red_line_id is null
      or exists (
        select 1 from public.red_lines r
        where r.id = flags.matched_red_line_id and r.reader_id = (select auth.uid())
      )
    )
  );

create policy "Readers change Flags on their own Documents"
  on public.flags for update to authenticated
  using (exists (
    select 1 from public.analyses a
    join public.documents d on d.id = a.document_id
    where a.id = flags.analysis_id and d.reader_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.analyses a
      join public.documents d on d.id = a.document_id
      where a.id = flags.analysis_id and d.reader_id = (select auth.uid())
    )
    and (
      matched_red_line_id is null
      or exists (
        select 1 from public.red_lines r
        where r.id = flags.matched_red_line_id and r.reader_id = (select auth.uid())
      )
    )
  );

create policy "Readers delete Flags on their own Documents"
  on public.flags for delete to authenticated
  using (exists (
    select 1 from public.analyses a
    join public.documents d on d.id = a.document_id
    where a.id = flags.analysis_id and d.reader_id = (select auth.uid())
  ));
