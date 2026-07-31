-- FRAME hardening: close the write holes, and add the columns the client has
-- been keeping locally all along.
--
-- Apply after 0002_social.sql.
--
-- ---------------------------------------------------------------------------
-- Why this file exists
-- ---------------------------------------------------------------------------
--
-- 0002 states in its header that "FILM is minted only by the server. The client
-- can never write its own balance." That was the intent and the schema did not
-- deliver it. `profile_self_rw` was `for all ... using (user_id = auth.uid())`,
-- which grants UPDATE on **every column of your own row**, including `film`,
-- `level`, `xp`, and `owned_cosmetics`. Any signed-in player could have PATCHed
-- their balance to anything they liked with one curl command.
--
-- Row-level security decides *which rows* you may touch. It says nothing about
-- *which columns*. Closing this needs a column-level GRANT, which is what
-- section 2 below does, and it is why every economy change from here on goes
-- through a SECURITY DEFINER function instead.
--
-- The same class of mistake was in `pm_self`: `for all ... with check
-- (user_id = auth.uid())` let anyone insert themselves into any party by id,
-- with no knowledge of the code at all. Party membership moves to an RPC in
-- 0004; the policy is narrowed here so the hole is not open in between.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. The columns the client keeps and the server did not have
-- ---------------------------------------------------------------------------

-- `xp` on profiles is a lifetime points counter. The client's `Profile.xp` is
-- a different thing: progress 0..1 through the *current* level. Both are worth
-- having and conflating them would silently corrupt one or the other, so the
-- fraction gets its own column and `xp` keeps its original meaning.
alter table profiles
  add column xp_frac real not null default 0
    check (xp_frac >= 0 and xp_frac < 1);

-- Season pass progress. This is what the leaderboard ranks on: lifetime XP
-- would permanently freeze the board in install order, and a season that does
-- not reset is not a season.
alter table profiles
  add column season_xp int not null default 0 check (season_xp >= 0);

alter table profiles
  add column paid_pass boolean not null default false;

-- What a real new account owns, matching FRESH_PROFILE in GameContext.tsx.
-- Set as column defaults rather than written by the bootstrap trigger, so a
-- profile created by any path gets them.
alter table profiles alter column owned_cosmetics
  set default array['title-unseen','pin-acid','frame-brackets','static-default','tag-shutter'];

alter table profiles alter column equipped set default
  '{"title":"title-unseen","pin":"pin-acid","frame":"frame-brackets","blackout":"static-default","tag":"tag-shutter"}'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. THE FIX: a player may edit their identity, never their economy
-- ---------------------------------------------------------------------------

drop policy profile_self_rw on profiles;

create policy profile_self_read on profiles
  for select using (user_id = auth.uid());

create policy profile_self_update on profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Deliberately no insert policy and no delete policy. Profiles are created by
-- the `handle_new_user` trigger on auth.users and removed by the cascade when
-- the auth user goes. A client that could insert profiles could mint accounts
-- that no auth user owns.

revoke insert, update, delete on profiles from anon, authenticated;

-- The whole hardening, in one statement. `film`, `level`, `xp`, `xp_frac`,
-- `season_xp`, `prestige`, `owned_cosmetics`, `paid_pass`, `banned`,
-- `age_bracket` and `friend_code` are all now unwritable by any client, at any
-- time, regardless of RLS. Adding a column to profiles does NOT add it here,
-- which is the correct default: new columns start unwritable.
grant update (handle, equipped, ads_disabled, attestation_ok) on profiles
  to authenticated;

-- Equipping something you do not own was previously free, because `equipped`
-- is opaque jsonb and no constraint looked inside it. It is a cosmetic-only
-- exploit, but the loadout screen is the most-seen surface in the product and
-- a stolen frame is visible to every player in the round.
create or replace function check_equipped_owned() returns trigger
language plpgsql as $$
declare
  v text;
begin
  for v in select value from jsonb_each_text(new.equipped) loop
    if not (v = any (new.owned_cosmetics)) then
      raise exception 'cannot equip an item you do not own: %', v;
    end if;
  end loop;
  return new;
end $$;

create trigger profiles_equipped_owned
  before insert or update on profiles
  for each row execute function check_equipped_owned();

-- Narrow the party-membership hole until 0004 replaces it with a code-gated
-- RPC. Leaving is yours to do; joining is not.
drop policy pm_self on party_members;

create policy pm_leave on party_members
  for delete using (user_id = auth.uid());

create policy pm_ready on party_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke insert on party_members from anon, authenticated;

-- `blockPlayer` in data/social.repo.ts inserts only `blocked_id`, which failed
-- the policy's with-check because `blocker_id` was null. Defaulting it is
-- better than making the client send its own id: a client that sends the
-- blocker cannot be trusted to send itself.
alter table blocks alter column blocker_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- 3. Reading other people, without opening stranger discovery
-- ---------------------------------------------------------------------------
--
-- `profile_read_partymates` was the only way to see anyone else, so the friends
-- list rendered blank handles and an incoming friend request said "someone
-- wants to be your friend" with no name attached. Both additions below are
-- keyed on an existing consented relationship. Neither one lets you enumerate
-- anybody: you already have to be friends, or already be holding a request.

create policy profile_read_friends on profiles for select
  using (are_friends(auth.uid(), user_id));

create policy profile_read_requesters on profiles for select using (
  exists (
    select 1 from friend_requests r
    where r.state = 'pending'
      and (
        (r.from_id = profiles.user_id and r.to_id = auth.uid())
        or (r.to_id = profiles.user_id and r.from_id = auth.uid())
      )
  )
);

-- One round trip for the friends list. Doing this client-side means reading
-- `friendships`, working out which end you are on, then a second query for the
-- profiles, which is three chances to leak a handle you should not see.
create or replace function list_friends()
returns table (user_id uuid, handle text, level int, season_xp int)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.handle, p.level, p.season_xp
  from friendships f
  join profiles p
    on p.user_id = case when f.low_id = auth.uid() then f.high_id else f.low_id end
  where auth.uid() in (f.low_id, f.high_id)
    and not p.banned
  order by p.season_xp desc;
$$;

-- ---------------------------------------------------------------------------
-- 4. The leaderboard ranks on season XP
-- ---------------------------------------------------------------------------
--
-- session-2 12 says "ranked on season XP" and the view ranked on lifetime `xp`.
-- Also revoked from `anon`: a signed-out reader had no business enumerating
-- every handle on the platform, and the board is an account feature anyway.

drop view leaderboard_global;

create view leaderboard_global as
  select
    p.user_id,
    p.handle,
    p.level,
    p.season_xp,
    rank() over (order by p.season_xp desc, p.created_at asc) as rank
  from profiles p
  where not p.banned;

revoke all on leaderboard_global from anon;
grant select on leaderboard_global to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The shop, priced by the server
-- ---------------------------------------------------------------------------
--
-- Prices lived only in mobile/src/data/catalog.ts, so any purchase call had to
-- take the price from the client. Mirrored here, and `purchase_cosmetic` reads
-- the cost from this table and never from its arguments.
--
-- Keep in sync with COSMETICS in catalog.ts. If the two disagree the server
-- wins, and the shop screen will show a price the player is not charged, which
-- is the failure mode you want rather than the reverse.

create type cosmetic_source as enum ('default', 'shop', 'free', 'paid', 'bundle');

create table cosmetics (
  id       text primary key,
  category text not null check (category in ('title','pin','frame','blackout','tag')),
  source   cosmetic_source not null,
  -- FILM price. Non-null only where source = 'shop'.
  cost     int check (cost is null or cost > 0),
  -- Season pass tier, for the free and paid tracks.
  tier     int check (tier is null or tier between 1 and 30),
  check ((source = 'shop') = (cost is not null))
);

insert into cosmetics (id, category, source, cost, tier) values
  ('title-unseen','title','default',null,null),
  ('title-patient','title','free',null,4),
  ('title-developed','title','shop',300,null),
  ('title-overexposed','title','paid',null,11),
  ('title-unseen2','title','free',null,8),
  ('title-latent','title','paid',null,15),
  ('title-stilllife','title','free',null,24),
  ('title-vanished','title','paid',null,22),
  ('title-neverfound','title','paid',null,30),
  ('pin-acid','pin','default',null,null),
  ('pin-negative','pin','shop',450,null),
  ('pin-ghost','pin','shop',600,null),
  ('pin-halftone','pin','paid',null,5),
  ('pin-pinhole','pin','free',null,16),
  ('pin-aperture','pin','paid',null,13),
  ('pin-burn','pin','paid',null,25),
  ('frame-brackets','frame','default',null,null),
  ('frame-darkroom','frame','shop',400,null),
  ('frame-safelight','frame','shop',550,null),
  ('frame-fixer','frame','shop',750,null),
  ('frame-contact','frame','paid',null,3),
  ('frame-redscale','frame','paid',null,10),
  ('frame-sprocket','frame','free',null,12),
  ('frame-lightleak','frame','paid',null,18),
  ('frame-polaroid','frame','paid',null,27),
  ('frame-firstlight','frame','bundle',null,null),
  ('static-default','blackout','default',null,null),
  ('static-signal','blackout','shop',550,null),
  ('static-grain','blackout','paid',null,8),
  ('static-fogged','blackout','free',null,20),
  ('static-torn','blackout','paid',null,20),
  ('static-developing','blackout','paid',null,28),
  ('tag-shutter','tag','default',null,null),
  ('tag-prism','tag','shop',800,null),
  ('tag-longexp','tag','paid',null,6),
  ('tag-strobe','tag','paid',null,16),
  ('tag-flash','tag','free',null,28),
  ('tag-double','tag','paid',null,23);

alter table cosmetics enable row level security;

-- The catalog is public information: it is on the shop screen. Read-only to
-- everyone, writable by nobody but the service role.
create policy cosmetics_read on cosmetics for select using (true);
revoke insert, update, delete on cosmetics from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. XP, levels, and the FILM faucets, all server side
-- ---------------------------------------------------------------------------

-- Mirrors withXp() in GameContext.tsx: `p_frac` is in levels, so 0.1 is one
-- tenth of a level, and season XP moves 1000 per level.
create or replace function apply_xp(p_user uuid, p_frac real) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  total real;
  gained int;
  points int;
begin
  if p_frac <= 0 then return; end if;

  select xp_frac + p_frac into total from profiles where user_id = p_user;
  gained := floor(total)::int;
  points := round(p_frac * 1000)::int;

  update profiles
     set xp_frac  = total - gained,
         -- The column check caps at 50 and a constraint violation here would
         -- roll back a legitimate reward, so clamp rather than trip it.
         level     = least(50, level + gained),
         xp        = xp + points,
         season_xp = season_xp + points
   where user_id = p_user;
end $$;

create or replace function purchase_cosmetic(p_id text) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  c cosmetics;
  balance int;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;

  select * into c from cosmetics where id = p_id;
  if c is null then raise exception 'no such item'; end if;

  -- Pass-track and bundle items are not purchasable with FILM at any price.
  -- FIRST LIGHT in particular is the entire pitch of the starter bundle, and
  -- a FILM path to it would undercut the only paid offer in the product.
  if c.source <> 'shop' then raise exception 'that item is not sold for FILM'; end if;

  if exists (
    select 1 from profiles
     where user_id = auth.uid() and p_id = any (owned_cosmetics)
  ) then
    raise exception 'already owned';
  end if;

  update profiles
     set film = film - c.cost,
         owned_cosmetics = array_append(owned_cosmetics, p_id)
   where user_id = auth.uid()
     and film >= c.cost
  returning film into balance;

  if not found then raise exception 'not enough FILM'; end if;
  return balance;
end $$;

-- The client's dayIndex() is the local calendar date as days since epoch. A
-- client that could name any day could claim the daily reward a thousand times
-- in a row, so it is bounded to the server's own day plus or minus one, which
-- is wide enough for every timezone and narrow enough to be worthless.
create or replace function day_is_plausible(p_day int) returns boolean
language sql stable as $$
  select abs(p_day - (extract(epoch from current_date) / 86400)::int) <= 1;
$$;

create table daily_claims (
  user_id    uuid not null references profiles on delete cascade,
  day_index  int not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, day_index)
);

alter table daily_claims enable row level security;
create policy daily_claims_own on daily_claims for select using (user_id = auth.uid());
revoke insert, update, delete on daily_claims from anon, authenticated;

-- Pays ECONOMY.dailyCheckin: 100 FILM and 0.1 levels of XP. The primary key is
-- what makes it once-per-day; a retry after a dropped response is free.
create or replace function claim_daily_reward(p_day int) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  film_reward constant int := 100;
  xp_reward   constant real := 0.1;
  balance int;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if not day_is_plausible(p_day) then raise exception 'that is not today'; end if;

  insert into daily_claims (user_id, day_index) values (auth.uid(), p_day)
  on conflict do nothing;

  if not found then raise exception 'already claimed today'; end if;

  update profiles set film = film + film_reward
   where user_id = auth.uid() returning film into balance;
  perform apply_xp(auth.uid(), xp_reward);

  return balance;
end $$;

create table mission_sweeps (
  user_id    uuid not null references profiles on delete cascade,
  day_index  int not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, day_index)
);

alter table mission_sweeps enable row level security;
create policy mission_sweeps_own on mission_sweeps for select using (user_id = auth.uid());
revoke insert, update, delete on mission_sweeps from anon, authenticated;

-- Finishing all three of the day's missions. 100 FILM, once. See
-- data/missions.ts: the sweep bonus is the only reason to do the third mission
-- after the first two have already paid.
create or replace function claim_mission_sweep(p_day int) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  film_reward constant int := 100;
  balance int;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if not day_is_plausible(p_day) then raise exception 'that is not today'; end if;

  insert into mission_sweeps (user_id, day_index) values (auth.uid(), p_day)
  on conflict do nothing;
  if not found then raise exception 'already claimed today'; end if;

  update profiles set film = film + film_reward
   where user_id = auth.uid() returning film into balance;
  return balance;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Sign-up carries the handle and the age bracket
-- ---------------------------------------------------------------------------
--
-- The bracket is set from OAuth metadata at sign-up and defaulted to '18_plus'
-- when absent, which is the wrong direction to be wrong in: it is the flag that
-- gates the NEARBY tab. An account whose bracket was never established should
-- not be treated as an adult by default. The client sets it explicitly after
-- the DOB gate through `set_age_bracket`, and the default is now the
-- restrictive one.

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, handle, age_bracket)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle', 'P' || substr(replace(new.id::text,'-',''), 1, 8)),
    coalesce((new.raw_user_meta_data->>'age_bracket')::age_bracket, '13_17')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Settable once. The DOB itself is never sent and never stored (PRD 3); the
-- client computes the bracket at the gate and reports only which side of 18
-- the player is on. Allowing it to be changed later would make the 18+ gate on
-- the NEARBY tab a formality.
create or replace function set_age_bracket(p_bracket age_bracket) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  update profiles
     set age_bracket = p_bracket
   where user_id = auth.uid()
     and age_bracket = '13_17';
end $$;

-- Handles are chosen in onboarding and are visible on the leaderboard, so
-- uniqueness is already enforced by the column. This exists so the client can
-- tell "taken" apart from "malformed" without reading the constraint name out
-- of an error string.
create or replace function handle_available(p_handle text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_handle ~ '^[A-Z0-9_]{3,12}$'
     and not exists (select 1 from profiles where handle = upper(p_handle));
$$;

-- ---------------------------------------------------------------------------
-- 8. Functions are executable by everyone unless you say otherwise
-- ---------------------------------------------------------------------------
--
-- Postgres grants EXECUTE to PUBLIC on every new function, and PostgREST will
-- happily expose one at /rest/v1/rpc/<name>. A SECURITY DEFINER function that
-- takes the target user as an argument is therefore a privilege escalation
-- unless it is revoked, because it runs as the owner and the caller chooses
-- who it runs *on*.
--
-- `apply_xp(p_user, p_frac)` is exactly that shape: left open, any signed-in
-- player could hand themselves fifty levels, or hand someone else zero. Every
-- function meant to be called by a client takes no user argument and reads
-- auth.uid() itself. The ones below take one, so they are internal.

revoke execute on function apply_xp(uuid, real) from public, anon, authenticated;
revoke execute on function purge_expired_posts() from public, anon, authenticated;
revoke execute on function gen_friend_code() from public, anon, authenticated;
revoke execute on function check_equipped_owned() from public, anon, authenticated;
revoke execute on function assign_friend_code() from public, anon, authenticated;
revoke execute on function handle_new_user() from public, anon, authenticated;
