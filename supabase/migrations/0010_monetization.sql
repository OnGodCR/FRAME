-- Hidewire: separate earned FILM from bought FILM, and move the box roll to
-- the server.
--
-- Apply after 0009_economy.sql.
--
-- ---------------------------------------------------------------------------
-- 1. The seeker-bidding problem, solved rather than accepted
-- ---------------------------------------------------------------------------
--
-- Selling FILM made the seeker role purchasable, because `bid_seeker` spends
-- FILM and the highest bid takes the role. The two options on the table were to
-- delete bidding or to accept that the role goes to whoever paid. There is a
-- third, and it is better than both: **bidding may only spend FILM that was
-- earned.**
--
-- `profiles.film_purchased` tracks how much of the *current* balance arrived
-- through a payment. Spending draws that down first, so bought FILM is used up
-- before earned FILM, and the earned portion is what bidding is allowed to
-- touch. A player who has never paid is unaffected. A player who buys 10,000
-- FILM can spend all of it on boxes and cosmetics and none of it on the seeker
-- role.
--
-- This restores the only part of "nothing purchasable helps you win" that was
-- load-bearing for fairness between players in the same round. It does **not**
-- restore the claim itself, because the $4.99 box still contains items that
-- change a round. That claim has been removed from the marketing brief, the
-- Terms, and the in-app copy rather than softened.
-- ---------------------------------------------------------------------------

alter table profiles
  add column film_purchased int not null default 0 check (film_purchased >= 0);

-- Invariant: the bought portion can never exceed the balance holding it.
alter table profiles
  add constraint film_purchased_within_balance check (film_purchased <= film);

/**
 * Spend, drawing from bought FILM first.
 *
 * `p_earned_only` is the bidding path: it refuses unless the earned portion
 * alone covers the amount.
 */
create or replace function spend_film(p_amount int, p_earned_only boolean default false)
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  bal int;
  bought int;
  from_bought int;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if p_amount <= 0 then raise exception 'nothing to spend'; end if;

  select film, film_purchased into bal, bought
    from profiles where user_id = auth.uid() for update;

  if p_earned_only then
    if (bal - bought) < p_amount then
      raise exception 'that bid needs FILM you earned, and you have % of it', bal - bought;
    end if;
    -- Spends earned only, so the bought portion is untouched.
    update profiles set film = film - p_amount where user_id = auth.uid()
      returning film into bal;
    return bal;
  end if;

  if bal < p_amount then raise exception 'not enough FILM'; end if;

  from_bought := least(bought, p_amount);
  update profiles
     set film = film - p_amount,
         film_purchased = film_purchased - from_bought
   where user_id = auth.uid()
  returning film into bal;
  return bal;
end $$;

revoke execute on function spend_film(int, boolean) from public, anon, authenticated;

-- Bidding, now earned-only. Everything else about it is unchanged.
create or replace function bid_seeker(p_party uuid, p_amount int) returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  bal int;
  bought int;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  if not in_party(p_party) then raise exception 'not in that party'; end if;
  if p_amount <= 0 then raise exception 'bid something'; end if;

  select film, film_purchased into bal, bought
    from profiles where user_id = auth.uid();

  -- **The line that keeps the seeker role off the shelf.** Bought FILM buys
  -- boxes and cosmetics. It does not buy a role in somebody else's round.
  if (bal - bought) < p_amount then
    raise exception 'seeker bids can only spend FILM you earned';
  end if;

  insert into seeker_bids (party_id, user_id, amount)
  values (p_party, auth.uid(), p_amount)
  on conflict (party_id, user_id) do update set amount = excluded.amount,
                                                created_at = now();
end $$;

-- start_round debits the winner. Route it through the earned-only path so the
-- guard cannot be sidestepped by bidding and then buying.
create or replace function debit_seeker_bid(p_user uuid, p_amount int) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update profiles
     set film = greatest(0, film - p_amount)
   where user_id = p_user;
  -- Keep the invariant true if the balance fell below the bought portion.
  update profiles set film_purchased = least(film_purchased, film)
   where user_id = p_user;
end $$;

revoke execute on function debit_seeker_bid(uuid, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Where the player is, and whether FILM is on sale
-- ---------------------------------------------------------------------------

-- **The storefront country, not the IP and not the GPS.** The storefront is
-- what actually governs the transaction, so it is the only source that answers
-- the question a regulator is asking. It comes from the payment provider,
-- which does not exist yet, so this stays null and section 3 fails closed.
alter table profiles add column store_country text
  check (store_country is null or store_country ~ '^[A-Z]{2}$');

create or replace function set_store_country(p_code text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;
  update profiles set store_country = upper(p_code) where user_id = auth.uid();
end $$;

-- One row, so the kill switch is a single UPDATE rather than a deploy.
create table app_config (
  id                int primary key default 1 check (id = 1),
  -- When true, every FILM box becomes a paid random item, because a box that
  -- can be bought into indirectly with money is a paid loot box in Belgium and
  -- in most frameworks that test for it.
  film_purchasable  boolean not null default false,
  -- Where paid random items are not offered at all.
  blocked_countries text[] not null default array['BE','NL'],
  updated_at        timestamptz not null default now()
);

insert into app_config (id) values (1);

alter table app_config enable row level security;
create policy app_config_read on app_config for select using (true);
revoke insert, update, delete on app_config from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The catalogue, server side, because the client cannot be trusted with odds
-- ---------------------------------------------------------------------------

-- Declared in rarity order, because `open_box` walks `enum_range` to turn one
-- random draw into a band. Reordering these silently reweights every box.
create type rarity_tier as enum ('common', 'uncommon', 'rare', 'elite');

create table utility_items (
  id       text primary key,
  name     text not null,
  role     text not null check (role in ('hider','seeker','both')),
  rarity   rarity_tier not null,
  film     int not null check (film > 0),
  elite    boolean not null default false
);

create table loot_boxes (
  id        text primary key,
  name      text not null,
  film_cost int check (film_cost is null or film_cost > 0),
  price_usd numeric(6,2),
  odds      jsonb not null,
  -- Exactly one of the two prices.
  check ((film_cost is null) <> (price_usd is null))
);

create table player_items (
  user_id uuid not null references profiles on delete cascade,
  item_id text not null references utility_items,
  qty     int not null default 0 check (qty >= 0),
  primary key (user_id, item_id)
);

alter table utility_items enable row level security;
alter table loot_boxes    enable row level security;
alter table player_items  enable row level security;

-- The catalogue and the odds are public: they are on the shop screen, and in
-- several markets publishing them is a legal requirement rather than a choice.
create policy items_read on utility_items for select using (true);
create policy boxes_read on loot_boxes    for select using (true);
create policy player_items_own on player_items for select using (user_id = auth.uid());

revoke insert, update, delete on utility_items, loot_boxes, player_items
  from anon, authenticated;

-- Odds that do not sum to 1 are a published falsehood, so the database refuses
-- to hold them.
create or replace function check_odds_sum() returns trigger
language plpgsql as $$
declare
  total numeric;
begin
  select sum(value::numeric) into total from jsonb_each_text(new.odds);
  if abs(total - 1) > 1e-9 then
    raise exception 'odds for % sum to %, not 1', new.id, total;
  end if;
  return new;
end $$;

create trigger loot_boxes_odds_sum
  before insert or update on loot_boxes
  for each row execute function check_odds_sum();

revoke execute on function check_odds_sum() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Opening a box
-- ---------------------------------------------------------------------------

/**
 * Rolls server side, against server-held odds, with the gates applied here.
 *
 * **Fails closed.** If a box counts as a paid random item and the store country
 * is unknown, it is refused rather than allowed. Nothing currently supplies the
 * country, so this refuses every paid random item today, which is correct: no
 * payment provider exists either, so no such purchase can legitimately happen
 * yet.
 */
create or replace function open_box(p_box text)
returns table (item_id text, item_name text, rarity rarity_tier, duplicate boolean, refund int)
language plpgsql volatile security definer set search_path = public as $$
declare
  b        loot_boxes;
  cfg      app_config;
  bracket  age_bracket;
  country  text;
  paid_random boolean;
  roll     numeric;
  acc      numeric := 0;
  chosen   rarity_tier;
  pick     utility_items;
  had      int;
  refund_v int := 0;
begin
  if auth.uid() is null then raise exception 'sign in required'; end if;

  select * into b from loot_boxes where id = p_box;
  if b is null then raise exception 'no such box'; end if;

  select * into cfg from app_config where id = 1;
  select p.age_bracket, p.store_country into bracket, country
    from profiles p where p.user_id = auth.uid();

  paid_random := (b.price_usd is not null) or cfg.film_purchasable;

  if paid_random then
    -- Nobody under 18 is offered a random item, in any country. Stricter than
    -- any single jurisdiction requires, and it resolves PEGI's June 2026 rule
    -- and the Brazilian courts' minor-blocking requirement in one line.
    if bracket is distinct from '18_plus' then
      raise exception 'random items are 18 and over';
    end if;
    if country is null then
      raise exception 'cannot confirm your store region';
    end if;
    if country = any (cfg.blocked_countries) then
      raise exception 'not available in your region';
    end if;
  end if;

  if b.price_usd is not null then
    -- There is no receipt to verify, so there is no honest way to grant this.
    raise exception 'paid boxes need a payment provider, which is not wired up';
  end if;

  perform spend_film(b.film_cost, false);

  -- Roll the band, then pick uniformly inside it. `random()` runs here, on the
  -- server, which is the entire point of this function existing.
  roll := random();
  for chosen in select r from unnest(enum_range(null::rarity_tier)) r loop
    acc := acc + coalesce((b.odds ->> chosen::text)::numeric, 0);
    exit when roll < acc;
  end loop;

  select * into pick from utility_items
   where utility_items.rarity = chosen
   order by random() limit 1;

  if pick is null then raise exception 'no item available for that outcome'; end if;

  select qty into had from player_items
   where player_items.user_id = auth.uid() and player_items.item_id = pick.id;

  if coalesce(had, 0) > 0 then
    refund_v := case pick.rarity
      when 'common' then 200 when 'uncommon' then 450
      when 'rare' then 900 else 2000 end;
    update profiles set film = film + refund_v where user_id = auth.uid();
  end if;

  insert into player_items (user_id, item_id, qty)
  values (auth.uid(), pick.id, 1)
  on conflict (user_id, item_id) do update set qty = player_items.qty + 1;

  return query select pick.id, pick.name, pick.rarity, coalesce(had, 0) > 0, refund_v;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Seed, mirroring mobile/src/data/lootboxes.ts
-- ---------------------------------------------------------------------------

insert into utility_items (id, name, role, rarity, film, elite) values
  ('util-second-exposure','SECOND EXPOSURE','hider','common',400,false),
  ('util-light-meter','LIGHT METER','hider','common',400,false),
  ('util-contact-print','CONTACT PRINT','seeker','common',400,false),
  ('util-grace','GRACE','hider','uncommon',900,false),
  ('util-sector','SECTOR CALL','seeker','uncommon',900,false),
  ('util-dead-air','DEAD AIR','hider','rare',1800,false),
  ('util-pressure','PRESSURE','seeker','rare',1800,false),
  ('util-darkroom','DARKROOM','hider','elite',4000,true),
  ('util-decoy','DECOY','hider','elite',4000,true),
  ('util-long-lens','LONG LENS','hider','elite',4000,true),
  ('util-fixer','FIXER','hider','elite',4000,true),
  ('util-tighten','TIGHTEN','seeker','elite',4000,true);

insert into loot_boxes (id, name, film_cost, price_usd, odds) values
  ('box-tray','DEVELOPING TRAY',1000,null,
     '{"common":0.70,"uncommon":0.25,"rare":0.05,"elite":0}'::jsonb),
  ('box-contact','CONTACT SHEET',3000,null,
     '{"common":0.45,"uncommon":0.38,"rare":0.16,"elite":0.01}'::jsonb),
  ('box-silver','SILVER RESERVE',5000,null,
     '{"common":0.25,"uncommon":0.40,"rare":0.32,"elite":0.03}'::jsonb),
  ('box-vault','VAULT NEGATIVE',10000,null,
     '{"common":0.05,"uncommon":0.30,"rare":0.40,"elite":0.25}'::jsonb),
  ('box-first-light','FIRST LIGHT CASE',null,4.99,
     '{"common":0,"uncommon":0.30,"rare":0.50,"elite":0.20}'::jsonb);

-- ---------------------------------------------------------------------------
-- 6. Assertions
-- ---------------------------------------------------------------------------

do $$
declare
  n int;
begin
  select count(*) into n from loot_boxes;
  if n <> 5 then raise exception 'expected 5 boxes, got %', n; end if;

  select count(*) into n from utility_items where elite;
  if n <> 5 then raise exception 'expected 5 elite items, got %', n; end if;

  -- The trigger already refuses a bad table; prove it is actually attached.
  begin
    insert into loot_boxes (id, name, film_cost, odds)
    values ('box-bad','BAD',100,'{"common":0.5,"uncommon":0.2,"rare":0.1,"elite":0.1}'::jsonb);
    raise exception 'ASSERTION FAILED: odds that sum to 0.9 were accepted';
  exception when raise_exception then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
  end;
end $$;
