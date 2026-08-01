-- Hidewire: the paid box guarantees an elite item.
--
-- Apply after 0010_monetization.sql.
--
-- ---------------------------------------------------------------------------
-- What changed and why it matters
-- ---------------------------------------------------------------------------
--
-- The "one in five" in the original spec was always about *which* elite item
-- you get, not whether you get one. 0010 seeded it the other way round, as a
-- 20% chance of reaching the elite band at all. Corrected here: FIRST LIGHT
-- CASE is 100% elite, and each of the five elite items is a 1 in 5 roll inside
-- that, which is the 20% figure landing where it belongs.
--
-- **This is a material escalation and it should not pass without being said.**
-- At 100% elite the paid box is now strictly better than every FILM box,
-- including VAULT NEGATIVE at 25%. The argument in LOOT-BOXES.md section 2,
-- that earned currency buys better odds than money does, is now false: $4.99
-- is the fastest route to a gameplay item by a wide margin, and the expected
-- earned-FILM cost of an elite item is unchanged at 40,000.
--
-- What still holds, and is now the entire fairness story:
--
--   - The seeker role cannot be bought (0010, `bid_seeker` spends earned FILM).
--   - One utility item per player per round.
--   - Nothing is purchase-only: every elite item still drops from VAULT
--     NEGATIVE, just far more slowly.
--
-- The marketing claim that nothing purchasable helps you win has already been
-- removed rather than softened. This is why.
-- ---------------------------------------------------------------------------

update loot_boxes
   set odds = '{"common":0,"uncommon":0,"rare":0,"elite":1}'::jsonb
 where id = 'box-first-light';

-- The sum trigger from 0010 runs on update, so a bad table cannot land here.
-- Prove the intended shape rather than trusting that.
do $$
declare
  o jsonb;
  n int;
begin
  select odds into o from loot_boxes where id = 'box-first-light';
  if (o ->> 'elite')::numeric <> 1 then
    raise exception 'FIRST LIGHT CASE is not a guaranteed elite';
  end if;

  select count(*) into n from utility_items where elite;
  if n <> 5 then
    raise exception 'the guaranteed elite roll needs exactly 5 elite items, found %', n;
  end if;
end $$;
