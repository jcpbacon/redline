-- Analyses: one run of the analysis over a Document.
--
-- Re-running analysis inserts a new row; the most recent one is shown
-- (spec "Persistence"). Deleting the Document deletes its analyses.
--
-- `checked` is the list of clause types the run looked for (story 46a). It is
-- stored so a reopened clean Document still shows what was checked.
-- `red_lines_snapshot` is the Red Lines as they were when this run happened,
-- so later edits to a Red Line don't rewrite what an old analysis was told.
--
-- Ownership is the parent Document's: there is no reader_id column here to
-- drift out of step with it.

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  summary text not null,
  model_id text not null,
  red_lines_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(red_lines_snapshot) = 'array'),
  checked jsonb not null default '[]'::jsonb check (jsonb_typeof(checked) = 'array'),
  created_at timestamptz not null default now()
);

create index analyses_document_id_created_at_idx on public.analyses (document_id, created_at desc);

alter table public.analyses enable row level security;

revoke all on table public.analyses from anon;

create policy "Readers see analyses of their own Documents"
  on public.analyses for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = analyses.document_id and d.reader_id = (select auth.uid())
  ));

create policy "Readers add analyses to their own Documents"
  on public.analyses for insert to authenticated
  with check (exists (
    select 1 from public.documents d
    where d.id = analyses.document_id and d.reader_id = (select auth.uid())
  ));

create policy "Readers change analyses of their own Documents"
  on public.analyses for update to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = analyses.document_id and d.reader_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.documents d
    where d.id = analyses.document_id and d.reader_id = (select auth.uid())
  ));

create policy "Readers delete analyses of their own Documents"
  on public.analyses for delete to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = analyses.document_id and d.reader_id = (select auth.uid())
  ));
