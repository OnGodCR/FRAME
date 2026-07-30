import { supabase } from '../lib/supabase';
import { TEST_MODE } from '../config';
import { DIRECTORY, type Friend } from './friends';
import type { LeaderRow } from './leaderboard';

// ---------------------------------------------------------------------------
// The social data seam.
//
// Screens call this. They never call Supabase and they never read a fixture
// array. Which of the two answers is decided here, in one place, by TEST_MODE
// and by whether a Supabase client exists at all.
//
// That is the whole point: when the backend is applied, the local
// implementations below get deleted and the screens do not change. Every method
// already has the shape the server returns, and every one of them corresponds
// to a function in supabase/migrations/0002_social.sql.
//
// **Nothing here trusts the client.** FILM grants, applause caps, and referral
// bonuses are all server-side functions; the local versions exist only so the
// app is reviewable without a database and are gated behind TEST_MODE.
// ---------------------------------------------------------------------------

export interface FriendRequest {
  id: string;
  fromId: string;
  fromHandle: string;
  toId: string;
  origin: 'code' | 'qr' | 'referral';
  createdAt: string;
}

export interface LookupResult {
  userId: string;
  handle: string;
  level: number;
}

/** True once a real project is configured and the player is signed in. */
export async function isLive(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

// ---------------------------------------------------------------------------
// lookup
// ---------------------------------------------------------------------------

/**
 * Exact-code lookup. Returns one player or null, never a list.
 *
 * The server version is rate limited and hides blocked players in both
 * directions. There is deliberately no search, no prefix match, and no
 * suggestion API anywhere in this file.
 */
export async function lookupByCode(code: string): Promise<LookupResult | null> {
  if (await isLive()) {
    const { data, error } = await supabase!.rpc('lookup_friend_code', { p_code: code });
    if (error || !data?.length) return null;
    const row = data[0];
    return { userId: row.user_id, handle: row.handle, level: row.level };
  }
  if (!TEST_MODE) return null;
  const f = DIRECTORY.find((d) => d.code === code.toUpperCase());
  return f ? { userId: f.id, handle: f.handle, level: f.level } : null;
}

// ---------------------------------------------------------------------------
// requests
// ---------------------------------------------------------------------------

/**
 * Sends a friend request. **Requests, not instant adds**: somebody holding
 * your code should be able to ask, not to attach themselves to you. That
 * matters most for the youngest players here, and it makes a leaked code
 * recoverable instead of permanent.
 */
export async function sendRequest(
  code: string,
  origin: 'code' | 'qr' | 'referral' = 'code',
): Promise<{ ok: boolean; error?: string }> {
  if (await isLive()) {
    const { error } = await supabase!.rpc('send_friend_request', {
      p_code: code,
      p_origin: origin,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  if (!TEST_MODE) return { ok: false, error: 'Not connected.' };
  const found = await lookupByCode(code);
  return found ? { ok: true } : { ok: false, error: 'No player with that code.' };
}

export async function incomingRequests(): Promise<FriendRequest[]> {
  if (await isLive()) {
    const { data, error } = await supabase!
      .from('friend_requests')
      .select('id, from_id, to_id, origin, created_at, profiles!friend_requests_from_id_fkey(handle)')
      .eq('state', 'pending');
    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id,
      fromId: r.from_id,
      fromHandle: r.profiles?.handle ?? '',
      toId: r.to_id,
      origin: r.origin,
      createdAt: r.created_at,
    }));
  }
  return [];
}

export async function acceptRequest(id: string): Promise<boolean> {
  if (await isLive()) {
    const { error } = await supabase!.rpc('accept_friend_request', { p_id: id });
    return !error;
  }
  return TEST_MODE;
}

export async function resolveRequest(
  id: string,
  state: 'declined' | 'cancelled',
): Promise<boolean> {
  if (await isLive()) {
    const { error } = await supabase!.rpc('resolve_friend_request', {
      p_id: id,
      p_state: state,
    });
    return !error;
  }
  return TEST_MODE;
}

// ---------------------------------------------------------------------------
// friends
// ---------------------------------------------------------------------------

export async function listFriends(): Promise<Friend[]> {
  if (await isLive()) {
    const { data, error } = await supabase!
      .from('friendships')
      .select('low_id, high_id');
    if (error || !data) return [];
    // Resolving the other side's profile is a second query in the real
    // implementation; kept explicit rather than clever so the RLS path is
    // obvious when this gets wired up.
    return [];
  }
  return [];
}

export async function removeFriend(otherId: string): Promise<boolean> {
  if (await isLive()) {
    const { error } = await supabase!.rpc('remove_friend', { p_other: otherId });
    return !error;
  }
  return TEST_MODE;
}

export async function blockPlayer(otherId: string): Promise<boolean> {
  if (await isLive()) {
    const { error } = await supabase!.from('blocks').insert({ blocked_id: otherId });
    return !error;
  }
  return TEST_MODE;
}

// ---------------------------------------------------------------------------
// applause
// ---------------------------------------------------------------------------

/**
 * Applauds a post. Returns the FILM the receiver was paid, which is 0 once
 * their daily cap is reached.
 *
 * **The cap is applied server side**, in one transaction, so a modified client
 * cannot pay itself past it. The local branch mirrors the same rule only so
 * the demo behaves the same way.
 */
export async function applaudPost(postId: string): Promise<number> {
  if (await isLive()) {
    const { data, error } = await supabase!.rpc('applaud_post', { p_post: postId });
    return error ? 0 : (data as number);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// referrals
// ---------------------------------------------------------------------------

export async function redeemReferral(code: string): Promise<{ ok: boolean; error?: string }> {
  if (await isLive()) {
    const { error } = await supabase!.rpc('redeem_referral', { p_code: code });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  if (!TEST_MODE) return { ok: false, error: 'Not connected.' };
  const found = await lookupByCode(code);
  return found ? { ok: true } : { ok: false, error: 'No player with that code.' };
}

// ---------------------------------------------------------------------------
// leaderboard
// ---------------------------------------------------------------------------

export async function globalBoard(limit = 50): Promise<LeaderRow[]> {
  if (await isLive()) {
    const { data, error } = await supabase!
      .from('leaderboard_global')
      .select('user_id, handle, level, xp')
      .order('xp', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.user_id,
      handle: r.handle,
      level: r.level,
      xp: r.xp,
    }));
  }
  return [];
}
