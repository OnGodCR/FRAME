-- ---------------------------------------------------------------------------
-- 0012: the hidewire.org waitlist.
--
-- One table, for the email addresses collected by the website before the app
-- exists. It is here rather than in the web repo because this is where the
-- database's history lives; Hidewire-web/db/README.md points at this file.
--
-- The shape is the point: one column of real data. No name, no age, no city,
-- no source, no IP, no user agent. Every one of those would be something the
-- privacy policy then has to describe, defend, and delete on request, and
-- counting signups only ever needs `select count(*)`.
--
-- Nothing reaches this table from a browser. The website posts to its own
-- endpoint, which holds a service role key server side; see
-- Hidewire-web/functions/api/waitlist.js and its README.
-- ---------------------------------------------------------------------------

create table if not exists public.waitlist_signups (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  created_at  timestamptz not null default now(),

  -- Not validation, a floor. The endpoint decides what an address looks like;
  -- this only stops something obviously wrong being stored forever.
  constraint waitlist_email_shape check (position('@' in email) > 1 and length(email) between 3 and 254)
);

-- A second signup with the same address has to be a conflict rather than a
-- second row, because that is what lets the site say "already on the list"
-- instead of appearing to work twice. On lower(email) rather than the raw
-- column so it holds even if a caller forgets to normalise.
create unique index if not exists waitlist_signups_email_key
  on public.waitlist_signups (lower(email));

-- Belt and braces. The service role bypasses RLS, so this is not what protects
-- the table in practice. It matters because a table with RLS off is readable
-- by anon the moment it is exposed through PostgREST.
alter table public.waitlist_signups enable row level security;

-- No policies, on purpose. With RLS on and no policy, anon and authenticated
-- can do nothing at all: the only writer is a server-side key and the only
-- reader is a human with the dashboard.
revoke all on public.waitlist_signups from anon, authenticated;

comment on table public.waitlist_signups is
  'Pre-beta waitlist addresses collected at hidewire.org. Email and timestamp only. No IP, no user agent, no analytics identifiers. See Hidewire-web/LEGAL-GAPS.md section 1 for the privacy clause this still needs.';
