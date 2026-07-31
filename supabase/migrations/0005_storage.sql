-- FRAME photo storage.
--
-- Apply after 0004_rounds.sql.
--
-- ---------------------------------------------------------------------------
-- Why Supabase Storage and not R2, for now
-- ---------------------------------------------------------------------------
--
-- INFRASTRUCTURE.md 1 picks Cloudflare R2, and that is still the right answer
-- at scale: R2 charges nothing for egress and a seeker pulls every hider's
-- check-in photo, so egress is the cost that actually grows here.
--
-- It is not the right answer *today* for one reason: R2 needs an account and
-- four credentials that do not exist yet, and until they do there is nowhere
-- for a photograph to go, which blocks testing the entire check-in loop on a
-- real phone. Supabase Storage needs nothing new, enforces access through the
-- same RLS the rest of this schema uses, and the free tier is 1 GB against a
-- corpus that deletes itself every 24 hours.
--
-- **The seam that makes the swap cheap:** the client never builds a URL. It
-- asks for an upload target and gets one back, and `photos.storage_path` holds
-- an opaque key rather than anything host-shaped. Moving to R2 means changing
-- where that key is redeemed, not what is stored.
--
-- ---------------------------------------------------------------------------
-- The path layout, which is load-bearing
-- ---------------------------------------------------------------------------
--
--     <round_id>/<user_id>/<checkin_id>-<camera>.jpg
--
-- Round first and player second is not arbitrary. The seeker's read policy has
-- to answer "is this caller a seeker in the round this object belongs to", and
-- putting the round id in the first path segment makes that answerable from the
-- object name alone, with no join into a table storage cannot see.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'captures',
  'captures',
  -- Never public. A check-in photograph is a picture of exactly where a person
  -- physically is, frequently a minor, and a public bucket would put that
  -- behind nothing but an unguessable URL.
  false,
  -- The client downscales before upload; 6 MB is generous for a JPEG that has
  -- already been through expo-image-manipulator, and small enough that a
  -- misconfigured client cannot fill the free tier in one round.
  6 * 1024 * 1024,
  array['image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A storage policy runs against a path a client chose, so it will be handed
-- malformed input. A bare `::uuid` cast on a garbage segment raises, and a
-- policy that raises is a 500 rather than a denial.
create or replace function safe_uuid(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Policies on storage.objects
-- ---------------------------------------------------------------------------

-- Upload: into your own folder, in a round you are actually in. Both halves
-- matter. The first stops you writing over somebody else's check-in; the
-- second stops a signed-in stranger using the bucket as free hosting.
create policy captures_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'captures'
  and (storage.foldername(name))[2] = auth.uid()::text
  and in_round(safe_uuid((storage.foldername(name))[1]))
);

-- Read: the author, and the seeker in that round. Hiders deliberately cannot
-- read each other's captures. Seeing where the other hiders are hiding is the
-- seeker's whole job and handing it to everyone would flatten the round.
create policy captures_read on storage.objects for select to authenticated
using (
  bucket_id = 'captures'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or my_role_in_round(safe_uuid((storage.foldername(name))[1])) = 'seeker'
  )
);

-- No update policy and no delete policy, on purpose. A capture is evidence for
-- the length of a round: a hider who could delete a photo after the seeker saw
-- it could deny having been anywhere. Deletion is the retention job's job, and
-- it runs as the service role.

-- ---------------------------------------------------------------------------
-- The 24 hour deletion promise
-- ---------------------------------------------------------------------------
--
-- PRD 7.6 and the privacy policy both promise a hard delete 24 hours after the
-- round ends. Deleting the row in `photos` is not that promise: the object
-- itself lives in the storage backend and only the Storage API can remove it.
--
-- So deletions are **queued** rather than assumed. Dropping the `photos` row
-- and calling it done would leave the actual photographs sitting in a bucket
-- while the audit trail claimed otherwise, which is worse than not having the
-- job at all: it would make an unfounded claim auditable.

create table pending_object_deletions (
  id           bigserial primary key,
  bucket_id    text not null,
  object_path  text not null,
  queued_at    timestamptz not null default now(),
  deleted_at   timestamptz,
  attempts     int not null default 0,
  last_error   text
);

create index pending_object_deletions_open
  on pending_object_deletions (queued_at)
  where deleted_at is null;

alter table pending_object_deletions enable row level security;
-- No policies. Service role only: this is an operational queue, not user data.

create or replace function purge_expired_photos() returns int
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  removed int;
begin
  with gone as (
    delete from photos where delete_after < now()
    returning id, storage_path
  ),
  queued as (
    insert into pending_object_deletions (bucket_id, object_path)
    select 'captures', storage_path from gone
    returning 1
  )
  insert into audit_deletions (entity, entity_id, job_id)
  select 'photo', id, 'purge_expired_photos' from gone;

  get diagnostics removed = row_count;
  return removed;
end $$;

revoke execute on function purge_expired_photos() from public, anon, authenticated;
revoke execute on function safe_uuid(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Draining the queue needs one secret, and it is the one secret I will not
-- handle
-- ---------------------------------------------------------------------------
--
-- The service_role key bypasses every policy in this schema. It does not belong
-- in a chat window, a commit, or a client bundle, and .env.server.example says
-- so already.
--
-- To finish the deletion path, run this **once** in the Supabase SQL editor,
-- pasting the key from Project Settings -> API. It stores the key in Vault,
-- which is encrypted at rest and never appears in a query result or a log:
--
--   create extension if not exists pg_net;
--   select vault.create_secret('PASTE_SERVICE_ROLE_KEY_HERE', 'service_role_key');
--
-- Then this migration's `drain_object_deletions()` starts working. Until the
-- secret exists it is a no-op that returns 0 and queues keep growing, which is
-- recoverable; the alternative, deleting rows and lying about the objects, is
-- not.

create or replace function drain_object_deletions(p_limit int default 100)
returns int
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  key      text;
  base_url text;
  row_     record;
  done     int := 0;
begin
  -- Absent secret, absent pg_net, or absent project url: do nothing, quietly
  -- and idempotently. A retention job that throws is a retention job somebody
  -- switches off.
  begin
    select decrypted_secret into key
      from vault.decrypted_secrets where name = 'service_role_key';
  exception when others then
    return 0;
  end;

  if key is null then return 0; end if;

  select decrypted_secret into base_url
    from vault.decrypted_secrets where name = 'project_url';
  if base_url is null then return 0; end if;

  for row_ in
    select * from pending_object_deletions
     where deleted_at is null and attempts < 5
     order by queued_at limit p_limit
  loop
    begin
      perform net.http_delete(
        url     := base_url || '/storage/v1/object/' || row_.bucket_id || '/' || row_.object_path,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || key,
          'apikey', key
        )
      );
      update pending_object_deletions
         set deleted_at = now() where id = row_.id;
      done := done + 1;
    exception when others then
      update pending_object_deletions
         set attempts = attempts + 1, last_error = sqlerrm
       where id = row_.id;
    end;
  end loop;

  return done;
end $$;

revoke execute on function drain_object_deletions(int) from public, anon, authenticated;
