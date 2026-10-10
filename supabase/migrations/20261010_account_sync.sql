-- Run this migration in the Supabase SQL editor before enabling account sync.
create table if not exists public.library_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  manifest jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.library_snapshots enable row level security;
revoke all on public.library_snapshots from anon, authenticated;
grant select on public.library_snapshots to authenticated;

drop policy if exists "library owner reads snapshot" on public.library_snapshots;
create policy "library owner reads snapshot"
  on public.library_snapshots for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.commit_library_snapshot(
  expected_revision bigint,
  next_manifest jsonb
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  current_revision bigint;
  new_revision bigint;
begin
  if owner_id is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if expected_revision < 0 or next_manifest is null or jsonb_typeof(next_manifest) <> 'object' then
    raise exception 'invalid snapshot' using errcode = '22023';
  end if;
  if octet_length(next_manifest::text) > 10485760 then
    raise exception 'snapshot too large' using errcode = '22023';
  end if;

  select revision into current_revision
    from public.library_snapshots where user_id = owner_id for update;
  if current_revision is null then
    if expected_revision <> 0 then raise exception 'revision conflict' using errcode = '40001'; end if;
    insert into public.library_snapshots (user_id, revision, manifest)
      values (owner_id, 1, next_manifest);
    return 1;
  end if;
  if current_revision <> expected_revision then
    raise exception 'revision conflict' using errcode = '40001';
  end if;
  new_revision := current_revision + 1;
  update public.library_snapshots
    set revision = new_revision, manifest = next_manifest, updated_at = now()
    where user_id = owner_id;
  return new_revision;
exception when unique_violation then
  raise exception 'revision conflict' using errcode = '40001';
end;
$$;

revoke all on function public.commit_library_snapshot(bigint, jsonb) from public, anon;
grant execute on function public.commit_library_snapshot(bigint, jsonb) to authenticated;

insert into storage.buckets (id, name, public)
values ('library-images', 'library-images', false)
on conflict (id) do update set public = false;

drop policy if exists "library owner reads images" on storage.objects;
create policy "library owner reads images"
  on storage.objects for select to authenticated
  using (bucket_id = 'library-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "library owner uploads images" on storage.objects;
create policy "library owner uploads images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'library-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "library owner deletes images" on storage.objects;
create policy "library owner deletes images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'library-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
