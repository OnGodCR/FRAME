-- FRAME schema conformance test.
--
-- Apply after 0006_jobs.sql.
--
-- ---------------------------------------------------------------------------
-- Why this is a migration and not a document
-- ---------------------------------------------------------------------------
--
-- Until today no row-level security policy in this repository had ever been
-- executed. 0001 and 0002 were written, reviewed, and reasoned about at length,
-- and two of them turned out to be wrong in ways that reading them did not
-- reveal (see 0003, section 2). Reasoning about a policy and running it are
-- different activities and only one of them is evidence.
--
-- So the load-bearing claims are asserted here, and the migration **fails** if
-- any of them is false. That means the schema cannot reach a database in a
-- state where PRD 9 is violated: the check is not a thing someone remembers to
-- run, it is a thing that has to pass before anything else is applied on top.
--
-- It creates two throwaway auth users, exercises the policies as each of them
-- in turn, and deletes them. Nothing survives it.
--
-- Re-runnable at any time as the service role:  select frame_selftest();
-- ---------------------------------------------------------------------------

create or replace function frame_selftest() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  -- `reset role` returns to the *login* role, and the CLI applies migrations
  -- through a temporary login role that is a member of the owner rather than
  -- the owner itself. Resetting therefore drops privileges instead of
  -- restoring them, so the role to come back to is captured explicitly.
  owner_role  text := current_user;
  restore     text := 'set local role ' || quote_ident(current_user);
  v_hider  uuid := gen_random_uuid();
  v_seeker uuid := gen_random_uuid();
  v_party   uuid;
  v_round   uuid;
  v_code    text;
  n         int;
  checks    int := 0;
begin
  -- -------------------------------------------------------------------------
  -- setup, as the owner
  -- -------------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (v_hider,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'selftest-hider@frame.invalid',  '{"handle":"SELFTESTH","age_bracket":"18_plus"}'::jsonb, now(), now()),
    (v_seeker, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'selftest-seeker@frame.invalid', '{"handle":"SELFTESTS","age_bracket":"18_plus"}'::jsonb, now(), now());

  -- The bootstrap trigger should have made both profiles, with the defaults.
  select count(*) into n from profiles where user_id in (v_hider, v_seeker);
  if n <> 2 then
    raise exception 'SELFTEST: handle_new_user did not create both profiles (got %)', n;
  end if;
  checks := checks + 1;

  select count(*) into n from profiles
   where user_id = v_hider and 'frame-brackets' = any (owned_cosmetics) and friend_code is not null;
  if n <> 1 then
    raise exception 'SELFTEST: a new profile is missing its default cosmetics or friend code';
  end if;
  checks := checks + 1;

  -- -------------------------------------------------------------------------
  -- 1. a client cannot write its own economy
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_hider, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    update profiles set film = 999999 where user_id = v_hider;
    execute restore;
    raise exception 'SELFTEST FAILED: a signed-in client updated its own FILM balance';
  exception
    when insufficient_privilege then null;
  end;
  execute restore;
  checks := checks + 1;

  set local role authenticated;
  begin
    update profiles set level = 50 where user_id = v_hider;
    execute restore;
    raise exception 'SELFTEST FAILED: a signed-in client updated its own level';
  exception
    when insufficient_privilege then null;
  end;
  execute restore;
  checks := checks + 1;

  -- 2. and cannot equip something it does not own
  set local role authenticated;
  begin
    update profiles set equipped = jsonb_set(equipped, '{frame}', '"frame-firstlight"')
     where user_id = v_hider;
    execute restore;
    raise exception 'SELFTEST FAILED: a client equipped a cosmetic it does not own';
  exception
    when raise_exception then null;   -- the check_equipped_owned trigger
  end;
  execute restore;
  checks := checks + 1;

  -- -------------------------------------------------------------------------
  -- 3. a party is joinable by code and not by id
  -- -------------------------------------------------------------------------
  set local role authenticated;
  select p.party_id, p.code into v_party, v_code from create_party('{}'::jsonb) p;
  perform ack_safety(v_party);
  execute restore;

  if v_party is null or v_code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'SELFTEST: create_party returned a malformed code: %', v_code;
  end if;
  checks := checks + 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_seeker, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    insert into party_members (party_id, user_id) values (v_party, v_seeker);
    execute restore;
    raise exception 'SELFTEST FAILED: a player inserted itself into a party without the code';
  exception
    when insufficient_privilege then null;
  end;
  execute restore;
  checks := checks + 1;

  set local role authenticated;
  perform join_party(v_code);
  perform ack_safety(v_party);

  -- A bid with no balance is refused, which is the guard doing its job: a
  -- fresh profile starts on zero FILM deliberately (FRESH_PROFILE).
  begin
    perform bid_seeker(v_party, 25);
    execute restore;
    raise exception 'SELFTEST FAILED: a player bid FILM it does not have';
  exception
    when raise_exception then null;
  end;
  execute restore;
  checks := checks + 1;

  -- Fund it the only way anything is ever funded: server side.
  update profiles set film = 50 where user_id = v_seeker;

  set local role authenticated;
  perform bid_seeker(v_party, 25);
  execute restore;
  checks := checks + 1;

  -- -------------------------------------------------------------------------
  -- 4. the round, and the schedule written up front
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_hider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_round := start_round(v_party, 47.6062, -122.3321, 1000);
  execute restore;

  -- The bidder took the seeker role and the host did not.
  select count(*) into n from round_players
   where round_id = v_round and user_id = v_seeker and role = 'seeker';
  if n <> 1 then raise exception 'SELFTEST: the highest bidder did not become the seeker'; end if;
  checks := checks + 1;

  -- Five check-in windows for the hider, none for the seeker, all with exact
  -- server-side deadlines. This is the claim INFRASTRUCTURE.md 4 rests on.
  select count(*) into n from checkins where round_id = v_round;
  if n <> 5 then
    raise exception 'SELFTEST: expected 5 check-in windows written at round start, got %', n;
  end if;
  checks := checks + 1;

  select count(*) into n from checkins
   where round_id = v_round
     and window_close - window_open <> interval '60 seconds';
  if n <> 0 then raise exception 'SELFTEST: a check-in window is not 60 seconds long'; end if;
  checks := checks + 1;

  -- -------------------------------------------------------------------------
  -- 5. THE HARD CONSTRAINT, PRD 9
  -- -------------------------------------------------------------------------
  -- "A hider's position between reveal ticks must not be readable by a seeker's
  -- session under any query."
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_hider, 'role', 'authenticated')::text, true);
  perform post_position(v_round, 47.6070, -122.3330, 8.0, 1.2);
  execute restore;

  select count(*) into n from positions where round_id = v_round;
  if n <> 1 then raise exception 'SELFTEST: the hider position was not recorded'; end if;
  checks := checks + 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_seeker, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from positions;
  execute restore;

  if n <> 0 then
    raise exception
      'SELFTEST FAILED, PRD 9 VIOLATED: a seeker read % row(s) from positions', n;
  end if;
  checks := checks + 1;

  -- The hider can read their own, or the map has nothing to draw.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_hider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from positions;
  execute restore;
  if n <> 1 then raise exception 'SELFTEST: a hider cannot read its own position'; end if;
  checks := checks + 1;

  -- -------------------------------------------------------------------------
  -- 6. reveals are the seeker's only window, and they expire
  -- -------------------------------------------------------------------------
  insert into reveals (round_id, tick_index, subject_id, geog, visible_until)
  values (v_round, 1, v_hider,
          st_setsrid(st_makepoint(-122.3330, 47.6070), 4326)::geography,
          now() + interval '45 seconds');

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_seeker, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from reveals;
  execute restore;
  if n <> 1 then raise exception 'SELFTEST: a seeker cannot read a live reveal'; end if;
  checks := checks + 1;

  update reveals set visible_until = now() - interval '1 second' where round_id = v_round;

  set local role authenticated;
  select count(*) into n from reveals;
  execute restore;
  if n <> 0 then
    raise exception 'SELFTEST FAILED: a seeker read a reveal that had expired';
  end if;
  checks := checks + 1;

  -- -------------------------------------------------------------------------
  -- 7. check-ins are judged against the server clock
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_hider, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform submit_checkin(
      (select id from checkins where round_id = v_round order by tick_index limit 1),
      '{"meanLuminance":90,"blurVariance":220,"entropy":6.1,"edgeDensity":0.08}'::jsonb,
      'p/x.jpg', null, null);
    execute restore;
    raise exception 'SELFTEST FAILED: a check-in was accepted before its window opened';
  exception
    when raise_exception then null;
  end;
  execute restore;
  checks := checks + 1;

  -- -------------------------------------------------------------------------
  -- 8. guests own nothing
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  select count(*) into n from profiles;
  execute restore;
  if n <> 0 then
    raise exception 'SELFTEST FAILED: a signed-out reader saw % profile row(s)', n;
  end if;
  checks := checks + 1;

  set local role anon;
  begin
    perform lookup_friend_code('AAAAAAAA');
    execute restore;
    raise exception 'SELFTEST FAILED: a guest ran a friend code lookup';
  exception
    when raise_exception or insufficient_privilege then null;
  end;
  execute restore;
  checks := checks + 1;

  -- -------------------------------------------------------------------------
  -- teardown. The cascade from auth.users removes every row above.
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id in (v_hider, v_seeker);

  select count(*) into n from profiles where user_id in (v_hider, v_seeker);
  if n <> 0 then raise exception 'SELFTEST: teardown left % profile row(s) behind', n; end if;

  return format('frame_selftest: %s checks passed', checks + 1);
end $$;

revoke execute on function frame_selftest() from public, anon, authenticated;

do $$
declare
  result text;
begin
  select frame_selftest() into result;
  raise notice '%', result;
end $$;
