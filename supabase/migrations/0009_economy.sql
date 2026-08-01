-- Hidewire: retune the FILM faucets, and finish the leaderboard.
--
-- Apply after 0008_selftest.sql.
--
-- ---------------------------------------------------------------------------
-- Why the numbers moved
-- ---------------------------------------------------------------------------
--
-- The old rates were set when the only sink in the game was a 300 to 800 FILM
-- cosmetic. The shop is now loot boxes priced from 1,000 to 10,000 FILM, and
-- against the old faucets a single roll of the top box was fifty days of play
-- for a regular player. See monetization/LOOT-BOXES.md section 2: at those
-- rates the elite items were cash-only in practice, whatever the published
-- odds said, and the whole defence of the design collapsed.
--
--   daily assignment    100 -> 500
--   all-three missions  100 -> 500
--   referral, per side  500 -> 2500
--   rewarded video      new, 250 per view, four a day
--
-- **These are the server's numbers and they are the ones that count.** The
-- client mirrors them in data/economy.ts so the UI can render a price before a
-- round trip, but every grant below is applied here, in a SECURITY DEFINER
-- function, because a client that could set its own balance would make all of
-- this decorative. If the two ever disagree, this file wins.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. The daily assignment
-- ---------------------------------------------------------------------------

create or replace function claim_daily_reward(p_day int) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  film_reward constant int := 500;
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

-- ---------------------------------------------------------------------------
-- 2. The mission sweep
-- ---------------------------------------------------------------------------

create or replace function claim_mission_sweep(p_day int) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  film_reward constant int := 500;
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
-- 3. Referrals
-- ---------------------------------------------------------------------------
--
-- 2,500 each side, up from 500. Worth noting what that does to the farm this
-- guard was built against: at 2,500 a pair, inventing accounts is now five
-- times more attractive than it was. The level-2 requirement is doing real work
-- and should not be relaxed. If abuse shows up, the next lever is requiring the
-- *referred* account to reach level 2 before either side is paid, which is a
-- schema change rather than a constant.

create or replace function redeem_referral(p_code text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  target uuid;
  bonus constant int := 2500;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if exists (select 1 from referrals where referred_id = auth.uid()) then
    raise exception 'already used a referral code';
  end if;

  select l.user_id into target from lookup_friend_code(p_code) l;
  if target is null then raise exception 'no player with that code'; end if;

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
-- 4. Rewarded video
-- ---------------------------------------------------------------------------
--
-- 250 FILM for a 30 second view, four a day.
--
-- **The cap is the entire design.** 250 per 30 seconds is 500 FILM a minute,
-- far the highest rate in the game. Uncapped, the optimal way to play Hidewire
-- would be to sit in a menu watching adverts rather than walking around a city,
-- which is the opposite of the product. Four a day puts the ad ceiling at 1,000
-- against 1,100 from actually playing, so playing still pays more. Preserve
-- that ordering through any retune.
--
-- The cap lives here rather than in the client for the same reason the applause
-- cap does: a modified client would otherwise pay itself.

create table ad_views (
  user_id   uuid not null references profiles on delete cascade,
  day_index int not null,
  views     int not null default 0 check (views >= 0),
  primary key (user_id, day_index)
);

alter table ad_views enable row level security;
create policy ad_views_own on ad_views for select using (user_id = auth.uid());
revoke insert, update, delete on ad_views from anon, authenticated;

-- Returns the FILM paid, which is 0 once the cap is reached. Zero is a normal
-- outcome and not an error: the player still watched something.
create or replace function claim_ad_reward(p_day int) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  per_view constant int := 250;
  cap      constant int := 4;
  seen int;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if not day_is_plausible(p_day) then raise exception 'that is not today'; end if;

  insert into ad_views (user_id, day_index, views) values (auth.uid(), p_day, 0)
  on conflict (user_id, day_index) do nothing;

  select views into seen from ad_views
   where user_id = auth.uid() and day_index = p_day for update;

  if seen >= cap then return 0; end if;

  update ad_views set views = views + 1
   where user_id = auth.uid() and day_index = p_day;
  update profiles set film = film + per_view where user_id = auth.uid();

  return per_view;
end $$;

-- ---------------------------------------------------------------------------
-- 5. The friends leaderboard
-- ---------------------------------------------------------------------------
--
-- `leaderboard_global` has existed since 0003 and ranks on season XP. The
-- friends scope had nothing behind it: the client had a friends tab on the
-- board and no query that could fill it, because `friendships` gives you ids
-- and RLS on `profiles` would not hand over the rows to join against.
--
-- Handles and scores only, same as the global board. Deliberately no friend
-- code, no level of contact, and nothing that turns a ranking into a way to
-- reach somebody.

create or replace function leaderboard_friends()
returns table (user_id uuid, handle text, level int, season_xp int, rank bigint)
language sql stable security definer set search_path = public as $$
  with circle as (
    select auth.uid() as id
    union
    select case when f.low_id = auth.uid() then f.high_id else f.low_id end
      from friendships f
     where auth.uid() in (f.low_id, f.high_id)
  )
  select
    p.user_id,
    p.handle,
    p.level,
    p.season_xp,
    rank() over (order by p.season_xp desc, p.created_at asc) as rank
  from profiles p
  join circle c on c.id = p.user_id
  where not p.banned;
$$;

-- Signed-in players only. A signed-out caller has no auth.uid(), so the CTE is
-- empty and the function returns nothing, but the grant is explicit anyway.
revoke execute on function leaderboard_friends() from anon;
grant execute on function leaderboard_friends() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Keep the self-test honest
-- ---------------------------------------------------------------------------
--
-- 0008 asserts a bid is refused when the balance is short, and it funds the
-- test account with 50 FILM to do it. Nothing above changes that, but the
-- referral figure is now asserted so the two files cannot drift apart.

do $$
declare
  src text;
begin
  select prosrc into src from pg_proc where proname = 'redeem_referral';
  if src not like '%2500%' then
    raise exception 'redeem_referral did not take the new bonus';
  end if;
end $$;
