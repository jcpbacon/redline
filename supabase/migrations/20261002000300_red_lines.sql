-- Red Lines: rules a Reader sets in advance about what they will not accept.
--
-- They persist across Documents (story 36), so they belong to the Reader, not
-- to a Document. A Red Line that is "deleted" in the UI may be archived rather
-- than removed, so an old analysis's matched Red Line can still be named.
-- Created before `flags`, which points at it.

create table public.red_lines (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(btrim(text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index red_lines_reader_id_idx on public.red_lines (reader_id, created_at);

create trigger red_lines_set_updated_at
  before update on public.red_lines
  for each row execute function public.set_updated_at();

alter table public.red_lines enable row level security;

revoke all on table public.red_lines from anon;

create policy "Readers see their own Red Lines"
  on public.red_lines for select to authenticated
  using (reader_id = (select auth.uid()));

create policy "Readers add their own Red Lines"
  on public.red_lines for insert to authenticated
  with check (reader_id = (select auth.uid()));

create policy "Readers change their own Red Lines"
  on public.red_lines for update to authenticated
  using (reader_id = (select auth.uid()))
  with check (reader_id = (select auth.uid()));

create policy "Readers delete their own Red Lines"
  on public.red_lines for delete to authenticated
  using (reader_id = (select auth.uid()));
