-- FRAME scheduled jobs.
--
-- Apply after 0005_storage.sql. Kept in its own migration on purpose: enabling
-- an extension is the step most likely to be refused by a project's settings,
-- and a failure here should not take the schema down with it.
--
-- ---------------------------------------------------------------------------
-- Four jobs, and what happens if each one stops
-- ---------------------------------------------------------------------------
--
-- | Job | Every | If it stops |
-- |---|---|---|
-- | `run_round_tick` | 1 min | Missed check-ins are never resolved, so nobody is ever blacked out and no reveal ever fires. The round becomes unlosable. |
-- | `purge_expired_posts` | 15 min | Daily captures outlive the 24 hour promise in the privacy policy. |
-- | `purge_expired_photos` | 15 min | Check-in photos outlive PRD 7.6's hard delete. |
-- | `drain_object_deletions` | 5 min | Rows are gone and the objects behind them are not, which is the failure the queue exists to make visible. |
--
-- The first is a gameplay outage. The other three are promises in a published
-- privacy policy, which is a different category of problem, and they are the
-- reason `pending_object_deletions` records attempts and errors rather than
-- silently retrying forever.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- The tick
-- ---------------------------------------------------------------------------
--
-- Once a minute is deliberate and INFRASTRUCTURE.md 4 explains why it is
-- enough: the outcome is exact regardless of when this runs, because
-- `run_round_tick` compares against each window's own `window_close` rather
-- than against the moment it woke up. What a coarse schedule costs is latency
-- on the *reveal*, not correctness on the *elimination*.
--
-- A player therefore learns they were blacked out up to a minute after it
-- happened. That is acceptable, and it is also why the client schedules its own
-- local notification for the window opening: the alarm is on the phone, the
-- verdict is here.
select cron.schedule('frame-round-tick', '* * * * *', $$select run_round_tick()$$);

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

select cron.schedule('frame-purge-posts',  '*/15 * * * *', $$select purge_expired_posts()$$);
select cron.schedule('frame-purge-photos', '*/15 * * * *', $$select purge_expired_photos()$$);

-- Inert until the service_role key is in Vault. See 0005_storage.sql for the
-- two lines that switch it on; scheduled now so that switching it on is one
-- statement rather than one statement and a job nobody remembered to create.
select cron.schedule('frame-drain-deletions', '*/5 * * * *', $$select drain_object_deletions()$$);

-- ---------------------------------------------------------------------------
-- Watching the jobs
-- ---------------------------------------------------------------------------
--
-- pg_cron writes every run to cron.job_run_details, which is where to look
-- first when the game stops eliminating people. Exposed read-only to the
-- service role only; job history names internal functions and is not something
-- a client should be able to read.

create or replace function job_health()
returns table (jobname text, last_run timestamptz, last_status text, failures_24h bigint)
language sql stable security definer set search_path = cron, public as $$
  select
    j.jobname::text,
    max(d.start_time) as last_run,
    (array_agg(d.status order by d.start_time desc))[1]::text as last_status,
    count(*) filter (where d.status <> 'succeeded' and d.start_time > now() - interval '24 hours')
  from cron.job j
  left join cron.job_run_details d on d.jobid = j.jobid
  where j.jobname like 'frame-%'
  group by j.jobname;
$$;

revoke execute on function job_health() from public, anon, authenticated;
