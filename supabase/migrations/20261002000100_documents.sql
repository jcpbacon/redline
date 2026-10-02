-- Documents: the extracted text of a contract a Reader analysed.
--
-- Only the extracted text is kept. There is deliberately no column for a file
-- name, a file body, a MIME type or a storage path: the original file never
-- leaves the Reader's browser (CLAUDE.md, spec "Persistence", story 44).
--
-- Row-level security scopes every row to the Reader who owns it (story 4).
-- Policies are granted to `authenticated` only; `anon` gets no table
-- privileges at all, so a signed-out request is refused before RLS is even
-- consulted.

-- Shared by every table that a Reader can edit in place.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  extracted_text text not null check (char_length(extracted_text) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.documents is
  'A Reader''s Document, held as extracted text only. The original file is never stored.';

create index documents_reader_id_created_at_idx on public.documents (reader_id, created_at desc);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

revoke all on table public.documents from anon;

create policy "Readers see their own Documents"
  on public.documents for select to authenticated
  using (reader_id = (select auth.uid()));

create policy "Readers add Documents to their own library"
  on public.documents for insert to authenticated
  with check (reader_id = (select auth.uid()));

create policy "Readers change their own Documents"
  on public.documents for update to authenticated
  using (reader_id = (select auth.uid()))
  with check (reader_id = (select auth.uid()));

create policy "Readers delete their own Documents"
  on public.documents for delete to authenticated
  using (reader_id = (select auth.uid()));
