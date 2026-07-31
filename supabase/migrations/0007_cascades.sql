-- FRAME: make an account actually deletable.
--
-- Apply after 0006_jobs.sql.
--
-- ---------------------------------------------------------------------------
-- Found by the conformance test in 0008, in its teardown
-- ---------------------------------------------------------------------------
--
-- Three foreign keys in 0001_core.sql reference `profiles` without
-- `on delete cascade` while every other reference in the schema has one:
--
--   parties.host_id
--   catches.seeker_id
--   catches.target_id
--
-- The effect is that **a player who has ever hosted a party or been involved in
-- a catch cannot be deleted**, because the delete is refused by the constraint.
-- That is not a tidiness problem. App Store Review 5.1.1(v) requires in-app
-- account deletion for any app with account creation, and UK GDPR gives the
-- same right to every player on the platform. The age gate means some of them
-- are minors, which is the group most likely to want out.
--
-- Nobody would have found this by reading the file: it is three missing words
-- across 320 lines, in a table nobody deletes from during normal play. It
-- surfaced the first time anything actually tried to delete a user.
--
-- `cascade` rather than `set null` on all three: a party belongs to its host,
-- and a catch is a fact about two players. Keeping an orphaned record of either
-- after someone has asked to be erased is the opposite of what the request
-- means.
-- ---------------------------------------------------------------------------

alter table parties
  drop constraint parties_host_id_fkey,
  add constraint parties_host_id_fkey
    foreign key (host_id) references profiles on delete cascade;

alter table catches
  drop constraint catches_seeker_id_fkey,
  add constraint catches_seeker_id_fkey
    foreign key (seeker_id) references profiles on delete cascade;

alter table catches
  drop constraint catches_target_id_fkey,
  add constraint catches_target_id_fkey
    foreign key (target_id) references profiles on delete cascade;

-- The client-facing half. Deleting the auth user cascades through `profiles`
-- and every table below it, so this is the whole implementation.
--
-- Deliberately not reversible and deliberately not a soft delete: `banned` is
-- the flag for "this account may not play", and conflating it with "this person
-- asked to be forgotten" would mean honouring neither properly.
create or replace function delete_my_account() returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in required'; end if;

  -- Photographs live in object storage and the cascade cannot reach them, so
  -- they are queued for the same deletion path the 24 hour retention job uses.
  -- Dropping the rows and leaving the images would make the erasure a claim
  -- rather than a fact.
  insert into pending_object_deletions (bucket_id, object_path)
  select 'captures', ph.storage_path
    from photos ph
    join checkins c on c.id = ph.checkin_id
   where c.user_id = me;

  delete from auth.users where id = me;
end $$;
