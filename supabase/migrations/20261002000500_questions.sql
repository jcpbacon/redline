-- Questions a Reader asked about one of their Documents, and the answers.
--
-- An answer either rests on Source Sentences from the Document (`grounded_in`,
-- story 32) or says the Document doesn't address the question
-- (`unanswerable`, story 31). `answer_text` is null while the answer is
-- pending or when the question is unanswerable.
--
-- The row carries reader_id (spec "Persistence") and must also sit under a
-- Document the same Reader owns; the policies check both.

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  reader_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question text not null check (char_length(btrim(question)) > 0),
  answer_text text,
  grounded_in jsonb not null default '[]'::jsonb check (jsonb_typeof(grounded_in) = 'array'),
  unanswerable boolean not null default false,
  created_at timestamptz not null default now(),
  check (not (unanswerable and answer_text is not null))
);

create index questions_document_id_created_at_idx on public.questions (document_id, created_at);
create index questions_reader_id_idx on public.questions (reader_id);

alter table public.questions enable row level security;

revoke all on table public.questions from anon;

create policy "Readers see their own questions"
  on public.questions for select to authenticated
  using (
    reader_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = questions.document_id and d.reader_id = (select auth.uid())
    )
  );

create policy "Readers ask questions of their own Documents"
  on public.questions for insert to authenticated
  with check (
    reader_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = questions.document_id and d.reader_id = (select auth.uid())
    )
  );

create policy "Readers change their own questions"
  on public.questions for update to authenticated
  using (
    reader_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = questions.document_id and d.reader_id = (select auth.uid())
    )
  )
  with check (
    reader_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = questions.document_id and d.reader_id = (select auth.uid())
    )
  );

create policy "Readers delete their own questions"
  on public.questions for delete to authenticated
  using (
    reader_id = (select auth.uid())
    and exists (
      select 1 from public.documents d
      where d.id = questions.document_id and d.reader_id = (select auth.uid())
    )
  );
