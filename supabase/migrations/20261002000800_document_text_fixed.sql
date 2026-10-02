-- A Document's extracted text never changes after it is saved.
--
-- Every stored Flag and every stored answer points at sentences in this text
-- (ADR-0001), and lib/documents/rows.js refuses to show one whose Source
-- Sentence isn't in it. Renaming a Document (ticket #25) updates its title
-- through the same "Readers change their own Documents" policy, which would
-- otherwise also let the text be rewritten under its analyses. So the
-- database refuses that, for every role: a change of text is a new Document.
--
-- The title, and updated_at (set by documents_set_updated_at), stay
-- changeable.

create or replace function public.keep_document_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.extracted_text is distinct from old.extracted_text then
    raise exception 'A Document''s extracted text can''t be changed once it is saved.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger documents_keep_text
  before update on public.documents
  for each row execute function public.keep_document_text();
