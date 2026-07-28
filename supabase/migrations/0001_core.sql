-- FRAME core schema.
--
-- The load-bearing requirement here is PRD 9: "A hider's position between
-- reveal ticks must not be readable by a seeker's session under any query."
-- That is enforced at the database layer rather than in the UI, which is why
-- raw positions are readable ONLY by the player who wrote them, and seekers
-- read a separate `reveals` table that a privileged tick job populates.
--
-- Apply: Supabase dashboard -> SQL Editor -> paste -> Run.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- identity
-- ---------------------------------------------------------------------------

create type age_bracket as enum ('13_17', '18_plus');

create table profiles (
  user_id            uuid primary key references auth.users on delete cascade,
  handle             text unique not null check (handle ~ '^[A-Z0-9_]{3,12}$'),
  age_bracket        age_bracket not null,
  -- The DOB itself is deliberately NOT stored. The bracket is all the game
  -- needs, and not holding a birthdate removes a whole category of risk.
  level              int not null default 1 check (level between 1 and 50),
  xp                 int not null default 0 check (xp >= 0),
  prestige           int not null default 0,
  film               int not null default 0 check (film >= 0),
  equipped           jsonb not null default '{}'::jsonb,
  owned_cosmetics    text[] not null default '{}',
  inventory_slots    int not null default 2 check (inventory_slots between 2 and 4),
  ads_disabled       boolean not null default false,
  attestation_ok     boolean not null default false,
  banned             boolean not null default false,
  created_at         timestamptz not null default now()
);

create table blocks (
  blocker_id uuid not null references profiles on delete cascade,
  blocked_id uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ---------------------------------------------------------------------------
-- parties and rounds
-- ---------------------------------------------------------------------------

create type party_state as enum ('lobby', 'in_round', 'closed');
create type round_state as enum ('cooldown', 'live', 'ended');
create type player_role as enum ('seeker', 'hider');
create type player_state as enum ('alive', 'tagged', 'blackout', 'left');

create table parties (
  id         uuid primary key default gen_random_uuid(),
  -- PRD 4.1: 6 characters, unambiguous alphabet, no 0/O and no 1/I/L.
  code       text unique not null check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  host_id    uuid not null references profiles,
  settings   jsonb not null default '{}'::jsonb,
  state      party_state not null default 'lobby',
  created_at timestamptz not null default now(),
  -- PRD 4.1: codes die after 4 hours or at round end, whichever is first.
  expires_at timestamptz not null default now() + interval '4 hours'
);

create table party_members (
  party_id     uuid not null references parties on delete cascade,
  user_id      uuid not null references profiles on delete cascade,
  joined_at    timestamptz not null default now(),
  ready        boolean not null default false,
  safety_ack_at timestamptz,
  primary key (party_id, user_id)
);

create table rounds (
  id            uuid primary key default gen_random_uuid(),
  party_id      uuid not null references parties on delete cascade,
  state         round_state not null default 'cooldown',
  started_at    timestamptz not null default now(),
  ends_at       timestamptz not null,
  zone          geography(point, 4326) not null,
  zone_radius_m int not null check (zone_radius_m between 300 and 10000),
  settings      jsonb not null
);

create table round_players (
  round_id      uuid not null references rounds on delete cascade,
  user_id       uuid not null references profiles on delete cascade,
  role          player_role not null,
  state         player_state not null default 'alive',
  eliminated_at timestamptz,
  score         int not null default 0,
  primary key (round_id, user_id)
);

create index on round_players (user_id);

-- ---------------------------------------------------------------------------
-- helpers, security definer so policies do not recurse through round_players
-- ---------------------------------------------------------------------------

create or replace function my_role_in_round(p_round uuid)
returns player_role language sql stable security definer set search_path = public as $$
  select role from round_players where round_id = p_round and user_id = auth.uid();
$$;

create or replace function in_round(p_round uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from round_players where round_id = p_round and user_id = auth.uid());
$$;

create or replace function in_party(p_party uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from party_members where party_id = p_party and user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- positions: the sensitive one
-- ---------------------------------------------------------------------------

create table positions (
  id          bigserial primary key,
  round_id    uuid not null references rounds on delete cascade,
  user_id     uuid not null references profiles on delete cascade,
  geog        geography(point, 4326) not null,
  accuracy_m  real,
  speed_mps   real,
  recorded_at timestamptz not null default now()
);

create index on positions (round_id, user_id, recorded_at desc);

-- Reveals are written by the tick worker only. This is the ONLY surface a
-- seeker ever reads a hider location from, and it carries the snapshot rather
-- than pointing at `positions`, so there is no path back to the live track.
create table reveals (
  id            bigserial primary key,
  round_id      uuid not null references rounds on delete cascade,
  tick_index    int not null,
  subject_id    uuid not null references profiles on delete cascade,
  geog          geography(point, 4326) not null,
  revealed_at   timestamptz not null default now(),
  visible_until timestamptz not null,
  unique (round_id, tick_index, subject_id)
);

create index on reveals (round_id, revealed_at desc);

-- ---------------------------------------------------------------------------
-- check-ins and photos
-- ---------------------------------------------------------------------------

create type checkin_status as enum ('open', 'passed', 'failed', 'missed');

create table checkins (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references rounds on delete cascade,
  user_id        uuid not null references profiles on delete cascade,
  tick_index     int not null,
  -- Written at round start from the server clock. PRD 9: every deadline is
  -- server-authoritative, and the client only ever renders a countdown
  -- derived from these.
  window_open    timestamptz not null,
  window_close   timestamptz not null,
  submitted_at   timestamptz,
  status         checkin_status not null default 'open',
  failure_reason text,
  unique (round_id, user_id, tick_index)
);

create index on checkins (round_id, window_close) where status = 'open';

create table photos (
  id                uuid primary key default gen_random_uuid(),
  checkin_id        uuid not null references checkins on delete cascade,
  camera            text not null check (camera in ('front', 'back')),
  storage_path      text not null,
  phash             bit(64),
  validation_scores jsonb,
  -- PRD 7.6: hard delete 24 hours after round end, with an audit trail.
  delete_after      timestamptz not null,
  created_at        timestamptz not null default now()
);

create index on photos (delete_after) where delete_after is not null;

create table catches (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references rounds on delete cascade,
  seeker_id    uuid not null references profiles,
  target_id    uuid not null references profiles,
  method       text not null check (method in ('ble', 'pin')),
  rssi         int,
  confirmed_at timestamptz not null default now()
);

create table audit_deletions (
  id         bigserial primary key,
  entity     text not null,
  entity_id  uuid not null,
  deleted_at timestamptz not null default now(),
  job_id     text
);

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table profiles       enable row level security;
alter table blocks         enable row level security;
alter table parties        enable row level security;
alter table party_members  enable row level security;
alter table rounds         enable row level security;
alter table round_players  enable row level security;
alter table positions      enable row level security;
alter table reveals        enable row level security;
alter table checkins       enable row level security;
alter table photos         enable row level security;
alter table catches        enable row level security;
alter table audit_deletions enable row level security;

-- profiles: your own row is editable; others are visible only in your party,
-- which keeps PRD 3's no-stranger-discovery rule true at the data layer.
create policy profile_self_rw on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy profile_read_partymates on profiles for select using (
  exists (
    select 1 from party_members mine
    join party_members theirs on theirs.party_id = mine.party_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.user_id
  )
);

create policy blocks_own on blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- parties: readable by members. Joining happens through a security-definer
-- RPC that checks the code, so there is no policy allowing a code fishing
-- expedition.
create policy party_read on parties for select using (in_party(id) or host_id = auth.uid());
create policy party_host_write on parties for update using (host_id = auth.uid());

create policy pm_read on party_members for select using (in_party(party_id));
create policy pm_self on party_members
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy round_read on rounds for select using (in_round(id) or in_party(party_id));
create policy rp_read on round_players for select using (in_round(round_id));

-- THE constraint from PRD 9.
-- Positions are insertable only by their owner and selectable only by their
-- owner. There is deliberately no seeker-facing select policy, so no query a
-- seeker can construct returns another player's live position. Seekers read
-- `reveals` instead.
create policy positions_insert_own on positions
  for insert with check (user_id = auth.uid() and in_round(round_id));

create policy positions_select_own on positions
  for select using (user_id = auth.uid());

-- Reveals: seekers in that round, plus the subject themselves, and only
-- while the reveal has not expired.
create policy reveals_read on reveals for select using (
  visible_until > now()
  and (subject_id = auth.uid() or my_role_in_round(round_id) = 'seeker')
);

-- Check-ins: your own always. Seekers see status but that is all they need,
-- and they get it through the round feed rather than the raw row.
create policy checkins_own on checkins
  for select using (user_id = auth.uid());

create policy checkins_seeker_status on checkins
  for select using (my_role_in_round(round_id) = 'seeker');

create policy checkins_submit on checkins
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Photos: the author, and seekers in the same round. PRD 7.6 also requires
-- short-lived signed URLs, which is enforced in storage, not here.
create policy photos_read on photos for select using (
  exists (
    select 1 from checkins c
    where c.id = photos.checkin_id
      and (c.user_id = auth.uid() or my_role_in_round(c.round_id) = 'seeker')
  )
);

create policy photos_insert_own on photos for insert with check (
  exists (select 1 from checkins c where c.id = checkin_id and c.user_id = auth.uid())
);

create policy catches_read on catches for select using (in_round(round_id));

-- Deletion audit is service-role only. No policy means no anon access, which
-- is the intent: it exists to be shown to a reviewer, not to the client.

-- ---------------------------------------------------------------------------
-- profile bootstrap
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, handle, age_bracket)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle', 'P' || substr(replace(new.id::text,'-',''), 1, 8)),
    coalesce((new.raw_user_meta_data->>'age_bracket')::age_bracket, '18_plus')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
