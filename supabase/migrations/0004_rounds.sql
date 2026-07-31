-- FRAME rounds: parties, roles, the check-in schedule, reveals, and scoring.
--
-- Apply after 0003_hardening.sql.
--
-- ---------------------------------------------------------------------------
-- The design, in one paragraph
-- ---------------------------------------------------------------------------
--
-- INFRASTRUCTURE.md 4 makes the argument and this file is the implementation:
-- **tick times are deterministic, so a coarse job can produce exact outcomes.**
-- When a round starts, every check-in window's open and close timestamp is
-- already knowable, so `start_round` writes all of them at once. From then on a
-- once-a-minute `pg_cron` pass asks "which windows closed with nothing
-- submitted" and blacks those players out. The verdict is exact because it
-- compares against `window_close`, not against when the job happened to run.
-- The only thing the coarse schedule degrades is notification latency, and that
-- is already solved separately by the on-device local notifications the client
-- schedules at round start (engine/notify.ts).
--
-- This is what makes PRD 9's server-authority rule true rather than aspirational.
-- The local notification is only the alarm. Whether a submission counts is
-- decided here, against this clock, and a tampered client clock changes nothing.
--
-- ---------------------------------------------------------------------------
-- What a seeker can and cannot read, which is the hard constraint
-- ---------------------------------------------------------------------------
--
-- 0001 established it and nothing here weakens it: `positions` is selectable
-- only by the player who wrote it, and there is no seeker-facing policy on that
-- table at all. Seekers read `reveals`, which the tick job populates with a
-- **snapshot** rather than a reference, so there is no join back to the live
-- track. `round_feed` below is the seeker's view of the round and it carries
-- check-in status and photos, never coordinates.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Party codes
-- ---------------------------------------------------------------------------

-- PRD 4.1's alphabet: no 0/O and no 1/I/L, because these get read aloud across
-- a room and typed by someone who is already walking.
create or replace function gen_party_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    -- Only live codes need to be unique. An expired party holding a code
    -- hostage forever would exhaust a 31^6 space far sooner than it should.
    exit when not exists (
      select 1 from parties
       where code = candidate and state <> 'closed' and expires_at > now()
    );
  end loop;
  return candidate;
end $$;

revoke execute on function gen_party_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Party lifecycle
-- ---------------------------------------------------------------------------

create or replace function create_party(p_settings jsonb default '{}'::jsonb)
returns table (party_id uuid, code text)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  new_code text;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if exists (select 1 from profiles where user_id = auth.uid() and banned) then
    raise exception 'account suspended';
  end if;

  -- One live party per host. Otherwise a host who backgrounded the app and
  -- tapped HOST again leaves a code circulating that nobody is in.
  update parties set state = 'closed'
   where host_id = auth.uid() and state = 'lobby';

  new_code := gen_party_code();

  insert into parties (code, host_id, settings)
  values (new_code, auth.uid(), coalesce(p_settings, '{}'::jsonb))
  returning id into new_id;

  insert into party_members (party_id, user_id) values (new_id, auth.uid());

  return query select new_id, new_code;
end $$;

-- Joining is by code and only by code. There is deliberately no function that
-- takes a party id: the id is visible to every member and passing one around
-- would be a second, unrateable join path.
create or replace function join_party(p_code text)
returns uuid
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  p parties;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if exists (select 1 from profiles where user_id = auth.uid() and banned) then
    raise exception 'account suspended';
  end if;

  select * into p from parties
   where code = upper(trim(p_code)) and state = 'lobby' and expires_at > now();

  if p is null then raise exception 'no open party with that code'; end if;

  -- A block is respected in both directions. Somebody you blocked handing you
  -- a code should not put the two of you in the same round.
  if exists (
    select 1 from blocks b
     join party_members m on m.party_id = p.id
    where (b.blocker_id = auth.uid() and b.blocked_id = m.user_id)
       or (b.blocker_id = m.user_id and b.blocked_id = auth.uid())
  ) then
    raise exception 'cannot join that party';
  end if;

  if (select count(*) from party_members where party_id = p.id) >= 12 then
    raise exception 'that party is full';
  end if;

  insert into party_members (party_id, user_id) values (p.id, auth.uid())
  on conflict do nothing;

  return p.id;
end $$;

create or replace function leave_party(p_party uuid) returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  delete from party_members where party_id = p_party and user_id = auth.uid();
  -- The host leaving closes the party rather than orphaning everyone in a
  -- lobby whose settings nobody can change.
  update parties set state = 'closed'
   where id = p_party and host_id = auth.uid() and state = 'lobby';
end $$;

-- The safety card acknowledgement is a PRD 7 gate and the client currently
-- enforces it alone. Recorded here so `start_round` can refuse without
-- trusting the phone that is about to walk someone into a city.
create or replace function ack_safety(p_party uuid) returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  update party_members set safety_ack_at = now()
   where party_id = p_party and user_id = auth.uid();
end $$;

-- Members may flip their own ready flag and nothing else on the row.
revoke update on party_members from anon, authenticated;
grant update (ready) on party_members to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Seeker bidding
-- ---------------------------------------------------------------------------
--
-- Highest bid takes the seeker role and **spends** the FILM, so it is a
-- currency sink and wanting to seek is a preference rather than an advantage.
-- The constraint that keeps this honest lives outside the database: FILM is
-- earned and never sold. If a FILM IAP ever ships, this feature has to come
-- out the same day, because it would make a role purchasable and that is the
-- hardest line in marketing/BRIEF.md 9.

create table seeker_bids (
  party_id   uuid not null references parties on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  amount     int not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

alter table seeker_bids enable row level security;

-- Bids are visible to the whole party. A sealed auction would just mean
-- everyone bids their whole balance.
create policy bids_read on seeker_bids for select using (in_party(party_id));
revoke insert, update, delete on seeker_bids from anon, authenticated;

-- FILM is NOT deducted here. It is deducted at `start_round`, from the winner
-- only. Charging at bid time would mean refunding every loser, and a refund
-- path is a second place FILM can be minted.
create or replace function bid_seeker(p_party uuid, p_amount int) returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  balance int;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if not in_party(p_party) then raise exception 'not in that party'; end if;
  if p_amount <= 0 then raise exception 'bid something'; end if;

  select film into balance from profiles where user_id = auth.uid();
  if balance < p_amount then raise exception 'not enough FILM'; end if;

  insert into seeker_bids (party_id, user_id, amount)
  values (p_party, auth.uid(), p_amount)
  on conflict (party_id, user_id) do update set amount = excluded.amount,
                                                created_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- 4. Starting a round, and writing every deadline up front
-- ---------------------------------------------------------------------------

-- Defaults match the client: 30 minute round, check-in every 5 minutes with a
-- 60 second window, reveals every 3 minutes visible for 45 seconds. See
-- ROUND_DISPLAY_MINUTES and HIDER_CHECKIN_TICKS in GameContext.tsx. Anything
-- the host changed arrives in `parties.settings`.
create or replace function round_setting(s jsonb, k text, d int) returns int
language sql immutable as $$
  select coalesce((s ->> k)::int, d);
$$;

create or replace function start_round(
  p_party    uuid,
  p_lat      double precision,
  p_lon      double precision,
  p_radius_m int
) returns uuid
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  p          parties;
  s          jsonb;
  round_s    int;
  checkin_s  int;
  window_s   int;
  new_round  uuid;
  t0         timestamptz := now();
  seeker     uuid;
  bid        int := 0;
  member     record;
  tick       int;
  open_at    timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;

  select * into p from parties where id = p_party;
  if p is null then raise exception 'no such party'; end if;
  if p.host_id <> auth.uid() then raise exception 'only the host can start'; end if;
  if p.state <> 'lobby' then raise exception 'that party is not in a lobby'; end if;

  if (select count(*) from party_members where party_id = p_party) < 2 then
    raise exception 'a round needs at least two players';
  end if;

  -- PRD 7. The client shows the safety card and gates START ROUND on it, but
  -- the client is the thing being trusted to walk a teenager into a city at
  -- night, so the gate is repeated here.
  if exists (
    select 1 from party_members
     where party_id = p_party and safety_ack_at is null
  ) then
    raise exception 'every player must accept the safety card first';
  end if;

  if p_radius_m < 300 or p_radius_m > 10000 then
    raise exception 'zone radius must be between 300 m and 10 km';
  end if;

  s         := coalesce(p.settings, '{}'::jsonb);
  round_s   := round_setting(s, 'round_seconds',   30 * 60);
  checkin_s := round_setting(s, 'checkin_seconds',  5 * 60);
  window_s  := round_setting(s, 'window_seconds',        60);

  -- The seeker is whoever bid highest. With no bids at all it falls to a
  -- random member, which is the old behaviour and still the right fallback:
  -- a lobby where nobody wants to seek should still be able to play.
  select user_id, amount into seeker, bid
    from seeker_bids
   where party_id = p_party
     and user_id in (select user_id from party_members where party_id = p_party)
   order by amount desc, created_at asc
   limit 1;

  if seeker is null then
    select user_id into seeker from party_members
     where party_id = p_party order by random() limit 1;
    bid := 0;
  end if;

  insert into rounds (party_id, state, started_at, ends_at, zone, zone_radius_m, settings)
  values (
    p_party, 'live', t0, t0 + make_interval(secs => round_s),
    st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography,
    p_radius_m,
    s || jsonb_build_object(
      'round_seconds', round_s,
      'checkin_seconds', checkin_s,
      'window_seconds', window_s,
      'seeker_bid', bid
    )
  )
  returning id into new_round;

  update parties set state = 'in_round' where id = p_party;

  -- The winning bid is spent, once, here. `greatest(0, ...)` rather than a
  -- constraint violation: a player whose balance moved between bidding and
  -- starting should not block the round for everybody else.
  if bid > 0 then
    update profiles
       set film = greatest(0, film - bid)
     where user_id = seeker;
  end if;
  delete from seeker_bids where party_id = p_party;

  for member in select user_id from party_members where party_id = p_party loop
    insert into round_players (round_id, user_id, role)
    values (
      new_round,
      member.user_id,
      (case when member.user_id = seeker then 'seeker' else 'hider' end)::player_role
    );

    -- **Every deadline for the whole round, written now.** This is the line
    -- that makes a once-a-minute cron job produce exact outcomes.
    if member.user_id <> seeker then
      tick := 1;
      loop
        open_at := t0 + make_interval(secs => checkin_s * tick);
        exit when open_at + make_interval(secs => window_s) > t0 + make_interval(secs => round_s);

        insert into checkins (round_id, user_id, tick_index, window_open, window_close)
        values (new_round, member.user_id, tick, open_at,
                open_at + make_interval(secs => window_s));
        tick := tick + 1;
      end loop;
    end if;
  end loop;

  return new_round;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Submitting a check-in
-- ---------------------------------------------------------------------------
--
-- PRD 9 says never trust a client-reported pass. The client's verdict is a
-- preview shown to the player so the retry flow can name what failed; what is
-- recorded here is the *scores*, and the pass or fail is decided against this
-- server's own clock and thresholds.
--
-- Server-side revalidation of the pixels themselves is still outstanding: it
-- needs the photo in object storage and a worker that can decode it. Until
-- that lands, `passed` here means "arrived inside the window with plausible
-- signals attached", which is strictly more than the client used to be trusted
-- for and strictly less than PRD 9 finally requires. Recorded rather than
-- glossed over.

create table validator_thresholds (
  id             int primary key default 1 check (id = 1),
  blur_min       real not null default 40,
  dark_max       real not null default 15,
  bright_min     real not null default 240,
  entropy_min    real not null default 3.2,
  edge_min       real not null default 0.012,
  phash_min_dist int  not null default 6,
  updated_at     timestamptz not null default now()
);

-- PRD 4.5 wants these servable without an app release, which is the entire
-- reason they are a table and not a constant. They are placeholders until the
-- calibration set exists. See calibration/HOW-TO-SHOOT.md.
insert into validator_thresholds (id) values (1);

alter table validator_thresholds enable row level security;
create policy thresholds_read on validator_thresholds for select using (true);
revoke insert, update, delete on validator_thresholds from anon, authenticated;

create or replace function submit_checkin(
  p_checkin uuid,
  p_scores  jsonb,
  p_back    text,
  p_front   text,
  p_phash   text default null
) returns checkin_status
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  c        checkins;
  t        validator_thresholds;
  verdict  checkin_status;
  reason   text := null;
  lum      real;
  blur     real;
  ent      real;
  edge     real;
  keep_until timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;

  select * into c from checkins where id = p_checkin;
  if c is null then raise exception 'no such check-in'; end if;
  if c.user_id <> auth.uid() then raise exception 'not your check-in'; end if;
  if c.status <> 'open' then raise exception 'that check-in is already resolved'; end if;

  -- The server clock, and only the server clock.
  if now() < c.window_open then raise exception 'that window has not opened yet'; end if;
  if now() > c.window_close then
    update checkins set status = 'missed', failure_reason = 'window closed'
     where id = p_checkin;
    return 'missed';
  end if;

  select * into t from validator_thresholds where id = 1;

  lum  := (p_scores ->> 'meanLuminance')::real;
  blur := (p_scores ->> 'blurVariance')::real;
  ent  := (p_scores ->> 'entropy')::real;
  edge := (p_scores ->> 'edgeDensity')::real;

  -- A submission with no signals attached is not given the benefit of the
  -- doubt. Everything else is: a false elimination is unrecoverable and a
  -- false accept costs one round.
  if lum is null or blur is null or ent is null or edge is null then
    verdict := 'failed'; reason := 'no validation signals';
  elsif lum < t.dark_max then      verdict := 'failed'; reason := 'too_dark';
  elsif lum > t.bright_min then    verdict := 'failed'; reason := 'too_bright';
  elsif blur < t.blur_min then     verdict := 'failed'; reason := 'blurred';
  elsif ent < t.entropy_min then   verdict := 'failed'; reason := 'uniform_surface';
  elsif edge < t.edge_min then     verdict := 'failed'; reason := 'low_detail';
  else                             verdict := 'passed';
  end if;

  update checkins
     set status = verdict, submitted_at = now(), failure_reason = reason
   where id = p_checkin;

  -- PRD 7.6: hard delete 24 hours after the round ends, not after the photo
  -- was taken. A round that runs long should not start deleting its own feed.
  select ends_at + interval '24 hours' into keep_until from rounds where id = c.round_id;

  if p_back is not null then
    insert into photos (checkin_id, camera, storage_path, validation_scores, delete_after, phash)
    values (p_checkin, 'back', p_back, p_scores, keep_until,
            case when p_phash is null then null else p_phash::bit(64) end);
  end if;
  if p_front is not null then
    insert into photos (checkin_id, camera, storage_path, validation_scores, delete_after)
    values (p_checkin, 'front', p_front, p_scores, keep_until);
  end if;

  if verdict = 'passed' then
    update round_players set score = score + 100
     where round_id = c.round_id and user_id = auth.uid();
  end if;

  return verdict;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Positions, and the speed lock
-- ---------------------------------------------------------------------------

-- PRD 7: sustained travel above 10 mph means somebody is in a vehicle, and a
-- game that keeps issuing check-ins to a person in a moving car is the single
-- most dangerous thing this product could do. 4.5 m/s is about 10 mph.
create table speed_locks (
  round_id   uuid not null references rounds on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  started_at timestamptz not null default now(),
  cleared_at timestamptz,
  primary key (round_id, user_id, started_at)
);

alter table speed_locks enable row level security;
create policy speed_locks_own on speed_locks for select using (user_id = auth.uid());
revoke insert, update, delete on speed_locks from anon, authenticated;

create or replace function post_position(
  p_round    uuid,
  p_lat      double precision,
  p_lon      double precision,
  p_accuracy real default null,
  p_speed    real default null
) returns boolean
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  limit_mps constant real := 4.5;
  hold_s    constant int  := 30;
  sustained boolean;
  locked    boolean;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if not in_round(p_round) then raise exception 'not in that round'; end if;

  insert into positions (round_id, user_id, geog, accuracy_m, speed_mps)
  values (p_round, auth.uid(),
          st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography,
          p_accuracy, p_speed);

  -- Sustained, not instantaneous. A single bad GPS fix throwing 30 mph is
  -- common and locking on it would make the feature read as broken.
  -- At least two fixes, and all of them over the limit. A single bad fix
  -- reading 30 mph is routine, and locking a player out on one of those would
  -- make a safety feature read as a bug, which is how safety features get
  -- switched off.
  select count(*) >= 2 and coalesce(bool_and(speed_mps >= limit_mps), false)
    into sustained
    from positions
   where round_id = p_round and user_id = auth.uid()
     and recorded_at > now() - make_interval(secs => hold_s)
     and speed_mps is not null;

  select exists (
    select 1 from speed_locks
     where round_id = p_round and user_id = auth.uid() and cleared_at is null
  ) into locked;

  if sustained and not locked then
    insert into speed_locks (round_id, user_id) values (p_round, auth.uid());
    return true;
  elsif not sustained and locked then
    update speed_locks set cleared_at = now()
     where round_id = p_round and user_id = auth.uid() and cleared_at is null;
  end if;

  return sustained;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Catches
-- ---------------------------------------------------------------------------

create or replace function confirm_catch(
  p_round  uuid,
  p_target uuid,
  p_method text,
  p_rssi   int default null
) returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if my_role_in_round(p_round) <> 'seeker' then
    raise exception 'only the seeker can confirm a catch';
  end if;
  if not exists (
    select 1 from round_players
     where round_id = p_round and user_id = p_target
       and role = 'hider' and state = 'alive'
  ) then
    raise exception 'that player is not in play';
  end if;

  insert into catches (round_id, seeker_id, target_id, method, rssi)
  values (p_round, auth.uid(), p_target, p_method, p_rssi);

  update round_players
     set state = 'tagged', eliminated_at = now()
   where round_id = p_round and user_id = p_target;

  update round_players set score = score + 150
   where round_id = p_round and user_id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- 8. The seeker's view of the round: status and photographs, never coordinates
-- ---------------------------------------------------------------------------

create view round_feed
with (security_invoker = on) as
  select
    c.round_id,
    c.user_id,
    p.handle,
    c.tick_index,
    c.status,
    c.window_open,
    c.window_close,
    c.submitted_at,
    ph.id  as photo_id,
    ph.camera,
    ph.storage_path
  from checkins c
  join profiles p on p.user_id = c.user_id
  left join photos ph on ph.checkin_id = c.id;

-- security_invoker means the caller's own policies apply, so this view can
-- never widen what the underlying tables allow. Without it the view would run
-- as its owner and quietly hand every check-in to everybody.
grant select on round_feed to authenticated;

-- ---------------------------------------------------------------------------
-- 9. The tick: one coarse job, exact outcomes
-- ---------------------------------------------------------------------------

create or replace function run_round_tick() returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  missed_n   int := 0;
  revealed_n int := 0;
  ended_n    int := 0;
  r          record;
  reveal_s   int;
  visible_s  int;
  idx        int;
  batch_n    int := 0;
begin
  -- 9a. Windows that closed with nothing submitted. Exact, because it compares
  -- against window_close and not against now-minus-a-minute.
  with closed as (
    update checkins
       set status = 'missed', failure_reason = 'no submission'
     where status = 'open' and window_close < now()
    returning round_id, user_id
  )
  update round_players rp
     set state = 'blackout', eliminated_at = now()
    from closed
   where rp.round_id = closed.round_id
     and rp.user_id = closed.user_id
     and rp.state = 'alive';
  get diagnostics missed_n = row_count;

  -- 9b. Reveals. The seeker's only window onto where anyone is, and it carries
  -- a snapshot rather than a pointer, so there is no path back to the track.
  for r in select * from rounds where state = 'live' loop
    reveal_s  := round_setting(r.settings, 'reveal_seconds', 180);
    visible_s := round_setting(r.settings, 'reveal_visible_seconds', 45);
    idx := floor(extract(epoch from (now() - r.started_at)) / reveal_s)::int;

    if idx >= 1 then
      insert into reveals (round_id, tick_index, subject_id, geog, visible_until)
      select r.id, idx, rp.user_id, latest.geog,
             now() + make_interval(secs => visible_s)
        from round_players rp
        join lateral (
          select geog from positions
           where round_id = r.id and user_id = rp.user_id
           order by recorded_at desc limit 1
        ) latest on true
       where rp.round_id = r.id and rp.role = 'hider' and rp.state = 'alive'
      on conflict (round_id, tick_index, subject_id) do nothing;
      get diagnostics batch_n = row_count;
      revealed_n := revealed_n + batch_n;
    end if;
  end loop;

  -- 9c. Rounds past their end. Everyone still alive survived.
  with done as (
    update rounds set state = 'ended'
     where state = 'live' and ends_at < now()
    returning id, party_id
  )
  update parties set state = 'closed' where id in (select party_id from done);
  get diagnostics ended_n = row_count;

  update round_players rp set score = score + 500
    from rounds r
   where r.id = rp.round_id and r.state = 'ended'
     and rp.state = 'alive' and rp.role = 'hider'
     and rp.eliminated_at is null
     and not exists (
       select 1 from checkins c
        where c.round_id = rp.round_id and c.user_id = rp.user_id and c.status = 'open'
     );

  -- 9d. Parties nobody ever started. PRD 4.1: a code dies after four hours.
  update parties set state = 'closed'
   where state = 'lobby' and expires_at < now();

  return jsonb_build_object(
    'blacked_out', missed_n,
    'revealed', revealed_n,
    'rounds_ended', ended_n,
    'at', now()
  );
end $$;

revoke execute on function run_round_tick() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Round rewards
-- ---------------------------------------------------------------------------
--
-- Claimed rather than pushed, and idempotent per (round, player), so the
-- results screen can call it on mount without a dropped response costing
-- anybody their XP or paying it twice.

create table round_rewards (
  round_id   uuid not null references rounds on delete cascade,
  user_id    uuid not null references profiles on delete cascade,
  film       int not null,
  xp_frac    real not null,
  claimed_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

alter table round_rewards enable row level security;
create policy round_rewards_own on round_rewards for select using (user_id = auth.uid());
revoke insert, update, delete on round_rewards from anon, authenticated;

create or replace function claim_round_reward(p_round uuid)
returns table (out_film int, out_xp real)
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  rp     round_players;
  r      rounds;
  passed int;
  pay    int;
  gain   real;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;

  select * into r from rounds where id = p_round;
  if r is null then raise exception 'no such round'; end if;
  if r.state <> 'ended' then raise exception 'that round is still running'; end if;

  select * into rp from round_players where round_id = p_round and user_id = auth.uid();
  if rp is null then raise exception 'you were not in that round'; end if;

  select count(*) into passed from checkins
   where round_id = p_round and user_id = auth.uid() and status = 'passed';

  -- 25 FILM a check-in, 100 for surviving. Deliberately modest against the
  -- daily's 100: a round needs three other people free at the same time, so
  -- pinning progression to it would punish players for other people's diaries.
  pay  := passed * 25 + case when rp.state = 'alive' then 100 else 0 end;
  gain := least(0.5, passed * 0.04 + case when rp.state = 'alive' then 0.1 else 0 end);

  insert into round_rewards (round_id, user_id, film, xp_frac)
  values (p_round, auth.uid(), pay, gain)
  on conflict do nothing;

  if not found then
    raise exception 'already claimed';
  end if;

  update profiles set film = film + pay where user_id = auth.uid();
  perform apply_xp(auth.uid(), gain);

  return query select pay, gain;
end $$;
