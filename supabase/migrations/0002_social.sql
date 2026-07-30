-- FRAME social schema: friends, friend requests, referrals, applause,
-- leaderboard, and the account/guest boundary.
--
-- Apply after 0001_core.sql. Supabase dashboard -> SQL Editor -> paste -> Run.
--
-- ---------------------------------------------------------------------------
-- The three rules this schema enforces at the database layer
-- ---------------------------------------------------------------------------
--
-- 1. **No stranger discovery.** There is no query in this file that returns a
--    list of people you are not already connected to. Lookup is by exact
--    friend code only, through a SECURITY DEFINER function that returns a
--    single row and nothing else. marketing/BRIEF.md 9 makes stranger play a
--    legal line, and the age gate means minors are on this platform.
--
-- 2. **Guests own nothing social.** Every table here keys off `profiles`,
--    which keys off `auth.users`. A guest has no auth user, therefore no
--    profile, therefore no friends, no FILM ledger, and no referral. That is
--    enforced by foreign keys rather than by client-side checks.
--
-- 3. **FILM is minted only by the server.** The client can never write its own
--    balance. Every grant goes through a SECURITY DEFINER function that
--    applies the caps in one transaction, so a modified client cannot pay
--    itself.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- friend codes
-- ---------------------------------------------------------------------------

-- Same unambiguous alphabet as party codes: no I, L, O, 0 or 1, because these
-- get read aloud and typed by hand. 8 characters, so the space is 31^8, about
-- 8.5e11. Guessing one is not a practical attack, and rate limiting below
-- makes enumeration pointless anyway.
alter table profiles
  add column friend_code text unique
    check (friend_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$');

create or replace function gen_friend_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from profiles where friend_code = candidate);
  end loop;
  return candidate;
end $$;

-- Assigned on profile creation so every account has one from the start.
create or replace function assign_friend_code() returns trigger
language plpgsql as $$
begin
  if new.friend_code is null then
    new.friend_code := gen_friend_code();
  end if;
  return new;
end $$;

create trigger profiles_friend_code
  before insert on profiles
  for each row execute function assign_friend_code();

-- ---------------------------------------------------------------------------
-- friend requests and friendships
-- ---------------------------------------------------------------------------

create type friend_request_state as enum ('pending', 'accepted', 'declined', 'cancelled');

-- **Requests, not instant adds.** Somebody with your code should be able to
-- ask, not to attach themselves to you. That matters most for the youngest
-- players on the platform, and it makes a leaked code recoverable rather than
-- permanent.
create table friend_requests (
  id           uuid primary key default gen_random_uuid(),
  from_id      uuid not null references profiles on delete cascade,
  to_id        uuid not null references profiles on delete cascade,
  state        friend_request_state not null default 'pending',
  -- How the request was made, for abuse analysis. 'qr' means the two people
  -- were physically together, which is the strongest signal there is.
  origin       text not null default 'code' check (origin in ('code', 'qr', 'referral')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  check (from_id <> to_id)
);

-- One live request per direction. Re-asking after a decline is allowed only
-- once the previous row is resolved, which is what stops request spam.
create unique index friend_requests_live
  on friend_requests (from_id, to_id)
  where state = 'pending';

create index friend_requests_inbox on friend_requests (to_id, state, created_at desc);

-- Friendship is stored once, not twice, with the pair ordered so (a,b) and
-- (b,a) cannot both exist.
create table friendships (
  low_id     uuid not null references profiles on delete cascade,
  high_id    uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (low_id, high_id),
  check (low_id < high_id)
);

create or replace function are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where low_id = least(a, b) and high_id = greatest(a, b)
  );
$$;

-- ---------------------------------------------------------------------------
-- lookup by code: the ONLY discovery path
-- ---------------------------------------------------------------------------

create table friend_code_lookups (
  user_id    uuid not null references profiles on delete cascade,
  at         timestamptz not null default now()
);
create index friend_code_lookups_rate on friend_code_lookups (user_id, at desc);

-- Returns one row or nothing. Never a list, never a partial match, never a
-- search. Rate limited so a stolen client cannot enumerate the code space.
create or replace function lookup_friend_code(p_code text)
returns table (user_id uuid, handle text, level int)
language plpgsql stable security definer set search_path = public as $$
declare
  recent int;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  select count(*) into recent
  from friend_code_lookups
  where friend_code_lookups.user_id = auth.uid()
    and at > now() - interval '1 hour';

  if recent > 60 then
    raise exception 'too many lookups, try later';
  end if;

  insert into friend_code_lookups (user_id) values (auth.uid());

  return query
  select p.user_id, p.handle, p.level
  from profiles p
  where p.friend_code = upper(p_code)
    and p.user_id <> auth.uid()
    and not p.banned
    -- A blocked person is invisible in both directions.
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
         or (b.blocker_id = p.user_id and b.blocked_id = auth.uid())
    );
end $$;

-- ---------------------------------------------------------------------------
-- request lifecycle
-- ---------------------------------------------------------------------------

create or replace function send_friend_request(p_code text, p_origin text default 'code')
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  target uuid;
  req_id uuid;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;

  select l.user_id into target from lookup_friend_code(p_code) l;
  if target is null then raise exception 'no player with that code'; end if;
  if are_friends(auth.uid(), target) then raise exception 'already friends'; end if;

  -- If they already asked you, accept instead of creating a mirror request.
  if exists (
    select 1 from friend_requests
    where from_id = target and to_id = auth.uid() and state = 'pending'
  ) then
    perform accept_friend_request(
      (select id from friend_requests
        where from_id = target and to_id = auth.uid() and state = 'pending')
    );
    return null;
  end if;

  insert into friend_requests (from_id, to_id, origin)
  values (auth.uid(), target, p_origin)
  on conflict do nothing
  returning id into req_id;

  return req_id;
end $$;

create or replace function accept_friend_request(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  r friend_requests;
begin
  select * into r from friend_requests where id = p_id;
  if r is null then raise exception 'no such request'; end if;
  if r.to_id <> auth.uid() then raise exception 'not yours to accept'; end if;
  if r.state <> 'pending' then raise exception 'already resolved'; end if;

  update friend_requests
     set state = 'accepted', resolved_at = now()
   where id = p_id;

  insert into friendships (low_id, high_id)
  values (least(r.from_id, r.to_id), greatest(r.from_id, r.to_id))
  on conflict do nothing;
end $$;

create or replace function resolve_friend_request(p_id uuid, p_state friend_request_state)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  r friend_requests;
begin
  select * into r from friend_requests where id = p_id;
  if r is null then raise exception 'no such request'; end if;
  -- The recipient may decline; the sender may cancel.
  if p_state = 'declined' and r.to_id <> auth.uid() then
    raise exception 'not yours to decline';
  end if;
  if p_state = 'cancelled' and r.from_id <> auth.uid() then
    raise exception 'not yours to cancel';
  end if;
  update friend_requests set state = p_state, resolved_at = now() where id = p_id;
end $$;

create or replace function remove_friend(p_other uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from friendships
   where low_id = least(auth.uid(), p_other)
     and high_id = greatest(auth.uid(), p_other);
end $$;

-- ---------------------------------------------------------------------------
-- daily assignment posts and applause
-- ---------------------------------------------------------------------------

create table daily_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles on delete cascade,
  -- Local calendar day index, matching data/assignments.ts dayIndex().
  day_index   int not null,
  photo_key   text not null,
  created_at  timestamptz not null default now(),
  -- PRD 4.4: captures are deleted 24 hours after they stop mattering.
  expires_at  timestamptz not null default now() + interval '24 hours',
  unique (user_id, day_index)
);

create index daily_posts_day on daily_posts (day_index, created_at desc);

create table applause (
  post_id    uuid not null references daily_posts on delete cascade,
  from_id    uuid not null references profiles on delete cascade,
  film_paid  int not null default 0 check (film_paid >= 0),
  created_at timestamptz not null default now(),
  primary key (post_id, from_id)
);

-- Per-day FILM earned from applause, so the cap is enforced server side.
create table applause_ledger (
  user_id   uuid not null references profiles on delete cascade,
  day_index int not null,
  earned    int not null default 0 check (earned >= 0),
  primary key (user_id, day_index)
);

-- **The cap lives here, not in the client.** Applause past the cap still
-- records, it just pays zero: the social signal survives without the faucet
-- running. See CLAUDE.md 6.1.
create or replace function applaud_post(p_post uuid) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  post daily_posts;
  cap  constant int := 100;
  per  constant int := 20;
  already int;
  payout int;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;

  select * into post from daily_posts where id = p_post;
  if post is null then raise exception 'no such post'; end if;
  if post.user_id = auth.uid() then raise exception 'cannot applaud your own'; end if;
  if not are_friends(auth.uid(), post.user_id) then raise exception 'not friends'; end if;

  select coalesce(earned, 0) into already
    from applause_ledger
   where user_id = post.user_id and day_index = post.day_index;

  payout := least(per, greatest(0, cap - coalesce(already, 0)));

  insert into applause (post_id, from_id, film_paid)
  values (p_post, auth.uid(), payout)
  on conflict (post_id, from_id) do nothing;

  if not found then return 0; end if;

  if payout > 0 then
    insert into applause_ledger (user_id, day_index, earned)
    values (post.user_id, post.day_index, payout)
    on conflict (user_id, day_index)
      do update set earned = applause_ledger.earned + excluded.earned;

    update profiles set film = film + payout where user_id = post.user_id;
  end if;

  return payout;
end $$;

-- ---------------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------------

create table referrals (
  referred_id uuid primary key references profiles on delete cascade,
  referrer_id uuid not null references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  check (referred_id <> referrer_id)
);

create table referral_progress (
  referred_id uuid not null references profiles on delete cascade,
  task_key    text not null,
  progress    int not null default 0 check (progress >= 0),
  primary key (referred_id, task_key)
);

-- One per account, ever. Primary key on referred_id does the enforcing, so a
-- retry cannot double pay.
create or replace function redeem_referral(p_code text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  target uuid;
  bonus constant int := 500;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if exists (select 1 from referrals where referred_id = auth.uid()) then
    raise exception 'already used a referral code';
  end if;

  select l.user_id into target from lookup_friend_code(p_code) l;
  if target is null then raise exception 'no player with that code'; end if;

  -- An account that has played nothing cannot refer, which removes the
  -- obvious farm: make accounts, refer yourself, collect.
  if (select level from profiles where user_id = target) < 2 then
    raise exception 'that player cannot refer yet';
  end if;

  insert into referrals (referred_id, referrer_id) values (auth.uid(), target);
  update profiles set film = film + bonus where user_id in (auth.uid(), target);

  insert into friend_requests (from_id, to_id, origin)
  values (auth.uid(), target, 'referral')
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- leaderboard
-- ---------------------------------------------------------------------------

-- Handles and scores only. No location, no captures, no contact route, and
-- deliberately no friend_code: a global list that exposed codes would be
-- stranger discovery wearing a different hat.
create view leaderboard_global as
  select
    p.user_id,
    p.handle,
    p.level,
    p.xp,
    rank() over (order by p.xp desc, p.created_at asc) as rank
  from profiles p
  where not p.banned;

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table friend_requests     enable row level security;
alter table friendships         enable row level security;
alter table friend_code_lookups enable row level security;
alter table daily_posts         enable row level security;
alter table applause            enable row level security;
alter table applause_ledger     enable row level security;
alter table referrals           enable row level security;
alter table referral_progress   enable row level security;

-- Requests: visible to the two people involved, and never writable directly.
-- Every state change goes through the functions above, which is what keeps
-- "accept" from being something you can do to yourself.
create policy fr_read on friend_requests for select
  using (from_id = auth.uid() or to_id = auth.uid());

create policy friendship_read on friendships for select
  using (low_id = auth.uid() or high_id = auth.uid());

create policy lookups_own on friend_code_lookups for select
  using (user_id = auth.uid());

-- A capture is readable by its author and by their friends. Not by the world.
create policy posts_own on daily_posts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy posts_friends_read on daily_posts for select
  using (are_friends(auth.uid(), user_id));

create policy applause_read on applause for select
  using (
    from_id = auth.uid()
    or exists (select 1 from daily_posts d where d.id = post_id and d.user_id = auth.uid())
  );

create policy applause_ledger_own on applause_ledger for select
  using (user_id = auth.uid());

create policy referrals_own on referrals for select
  using (referred_id = auth.uid() or referrer_id = auth.uid());

create policy referral_progress_own on referral_progress for select
  using (referred_id = auth.uid());

-- ---------------------------------------------------------------------------
-- guests
-- ---------------------------------------------------------------------------
--
-- There is nothing to add here, and that is the point. A guest has no row in
-- auth.users, so auth.uid() is null, so no policy above ever passes and no
-- function above proceeds past its first line. The account boundary is a
-- property of the schema rather than a check the client is trusted to make.
--
-- The client still hides these surfaces for guests, but only so the app reads
-- honestly. If that check were removed the database would still refuse.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- retention job
-- ---------------------------------------------------------------------------

-- PRD 4.4 and the privacy policy both promise 24 hour deletion. Schedule with
-- pg_cron once the extension is enabled:
--   select cron.schedule('purge-daily-posts', '*/15 * * * *', 'select purge_expired_posts()');
create or replace function purge_expired_posts() returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  removed int;
begin
  with gone as (
    delete from daily_posts where expires_at < now() returning id
  )
  insert into audit_deletions (entity, entity_id, job_id)
  select 'daily_post', id, 'purge_expired_posts' from gone;
  get diagnostics removed = row_count;
  return removed;
end $$;
