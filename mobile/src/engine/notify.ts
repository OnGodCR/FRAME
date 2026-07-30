import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Check-in tick notifications.
//
// The mechanic only works if the alert reaches a phone that is in a pocket,
// which is the normal case for a hider. PRD 4.4 says every living hider gets a
// high-priority alert on each tick, and PRD 10.2 requires those be
// time-sensitive because iOS will have suspended the app by then.
//
// Ticks are DETERMINISTIC: their timestamps are fixed when the round starts, so
// they are scheduled on-device as local notifications rather than waiting on a
// server round trip. A suspended app still fires a local notification on time;
// a push has to survive APNs, the network, and the radio being asleep. See
// INFRASTRUCTURE.md 4: the server writes exact window_open / window_close
// timestamps at round start, and this module takes those same absolute
// timestamps. Today the demo engine computes them from its compressed
// timeline, which is the seam where server state will drop in unchanged.
//
// Remote push is still needed for the things that are NOT deterministic
// (someone tagged, a nerf landed, the zone contracted). That path is
// registerForPushToken below and is inert until an EAS project exists.
// ---------------------------------------------------------------------------

/**
 * expo-notifications has no meaningful web implementation, and the dev preview
 * runs on react-native-web. The module is loaded lazily so it never enters the
 * web bundle at all, rather than being imported and then guarded at every call.
 */
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

type NotificationsModule = typeof import('expo-notifications');

let modPromise: Promise<NotificationsModule> | null = null;

async function notifications(): Promise<NotificationsModule | null> {
  if (!SUPPORTED) return null;
  if (!modPromise) {
    modPromise = import('expo-notifications').then((N) => {
      // Foreground presentation. A tick that arrives while the player is
      // staring at the map still has to be impossible to miss, so it banners
      // rather than landing silently in the list.
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      if (Platform.OS === 'android') {
        N.setNotificationChannelAsync(CHANNEL, {
          name: 'Check-in ticks',
          importance: N.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: [0, 250, 150, 400],
          bypassDnd: false,
        });
      }
      return N;
    });
  }
  try {
    return await modPromise;
  } catch {
    // A missing native module must never take the round down with it. The
    // in-app countdown is still running either way.
    modPromise = null;
    return null;
  }
}

const CHANNEL = 'checkin-ticks';

/** Marks our notifications so cancellation never touches anything else. */
const ROUND_TAG = 'frame.round.tick';

export interface TickPlan {
  /** Check-in number as the player sees it. */
  index: number;
  /** When the window opens and the 60 seconds start. */
  opensAt: Date;
  /** When the window closes and a non-submitter is blacked out. */
  closesAt: Date;
}

/** Scheduled identifiers, keyed by check-in index, so a submit can cancel
 *  that tick's remaining warning without disturbing later ticks. */
const scheduled = new Map<number, string[]>();

// --- permission -------------------------------------------------------------

/**
 * Asked the first time the player starts a round, never at launch. Same rule
 * as location (PRD 10.2): a cold permission prompt on the splash screen is the
 * biggest drop-off in the funnel.
 *
 * Returns false rather than throwing when denied. A player who says no should
 * still get a playable round, just a much harder one, and the round screen
 * tells them so.
 */
export async function ensurePermission(): Promise<boolean> {
  const N = await notifications();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await N.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return asked.granted;
  } catch {
    return false;
  }
}

/** Whether alerts are already granted, without prompting. */
export async function hasPermission(): Promise<boolean> {
  const N = await notifications();
  if (!N) return false;
  try {
    return (await N.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// --- scheduling -------------------------------------------------------------

/**
 * How early the "you are about to be blacked out" warning fires. A third of the
 * window, capped at 20 seconds, so it works for the real 60 second window and
 * for the demo's compressed one without a second constant to keep in sync.
 */
function warningLead(windowSeconds: number): number {
  return Math.min(20, Math.max(5, Math.round(windowSeconds / 3)));
}

/**
 * Schedules every tick for a round in one pass. Call at round start, once the
 * window timestamps are known. Anything already in the past is skipped, which
 * is what happens to a player who joins late or whose clock drifted.
 */
export async function scheduleTicks(plan: TickPlan[]): Promise<void> {
  const N = await notifications();
  if (!N) return;
  if (!(await hasPermission())) return;

  await cancelAll();

  for (const tick of plan) {
    const ids: string[] = [];
    const windowSeconds = (tick.closesAt.getTime() - tick.opensAt.getTime()) / 1000;

    const openId = await schedule(N, tick.opensAt, {
      title: `CHECK-IN ${pad(tick.index)}`,
      body: `${Math.round(windowSeconds)} seconds. Photograph where you are hiding.`,
      data: { tag: ROUND_TAG, kind: 'open', index: tick.index },
    });
    if (openId) ids.push(openId);

    const warnAt = new Date(tick.closesAt.getTime() - warningLead(windowSeconds) * 1000);
    const warnId = await schedule(N, warnAt, {
      title: `${warningLead(windowSeconds)} SECONDS`,
      body: 'Submit check-in or you are BLACKED OUT.',
      data: { tag: ROUND_TAG, kind: 'closing', index: tick.index },
    });
    if (warnId) ids.push(warnId);

    if (ids.length) scheduled.set(tick.index, ids);
  }
}

async function schedule(
  N: NotificationsModule,
  when: Date,
  content: { title: string; body: string; data: Record<string, unknown> },
): Promise<string | null> {
  // A DATE trigger in the past fires immediately on iOS, which would spam a
  // returning player with every tick they already missed.
  if (when.getTime() <= Date.now()) return null;
  try {
    return await N.scheduleNotificationAsync({
      content: {
        ...content,
        sound: 'default',
        // Time Sensitive breaks through Focus and a Scheduled Summary. It
        // needs the matching iOS entitlement, which app.json declares. Without
        // the entitlement provisioned, iOS quietly downgrades this to
        // 'active' rather than failing, so the alert still lands.
        interruptionLevel: 'timeSensitive',
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: CHANNEL,
      },
    });
  } catch {
    return null;
  }
}

/**
 * Called the moment a check-in passes validation. Kills that tick's closing
 * warning so a player who already submitted is not told they are about to be
 * eliminated. Later ticks are untouched.
 */
export async function cancelTick(index: number): Promise<void> {
  const N = await notifications();
  if (!N) return;
  const ids = scheduled.get(index);
  if (!ids) return;
  scheduled.delete(index);
  await Promise.all(
    ids.map((id) => N.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
}

/**
 * Called on every exit from a round: finished, left, tagged, blacked out.
 * A pending tick that fires after the round ended is the kind of bug that
 * makes someone uninstall.
 *
 * Cancels the tick identifiers this module scheduled, one by one, rather than
 * calling cancelAllScheduledNotificationsAsync. The blunt version would also
 * wipe the next-round appointment, which has nothing to do with the round that
 * just ended and is the more valuable of the two.
 */
export async function cancelAll(): Promise<void> {
  const N = await notifications();
  if (!N) return;
  const ids = [...scheduled.values()].flat();
  scheduled.clear();
  await Promise.all(
    ids.map((id) => N.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
}

/** Identifier for the "next round is booked" reminder, kept apart from ticks
 *  so cancelling a round's ticks never cancels the appointment. */
let reminderId: string | null = null;

/**
 * Books the next session. For a game that structurally needs three other
 * people, the appointment is doing more work than any streak could: the
 * failure mode is not that the player forgot, it is that nobody agreed a time.
 *
 * Deliberately survives cancelAll, which only clears in-round ticks.
 */
export async function scheduleRoundReminder(when: Date): Promise<boolean> {
  const N = await notifications();
  if (!N) return false;
  if (!(await ensurePermission())) return false;
  await cancelRoundReminder();
  if (when.getTime() <= Date.now()) return false;
  try {
    reminderId = await N.scheduleNotificationAsync({
      content: {
        title: 'ROUND BOOKED',
        body: 'Your party is expected. Open FRAME to host.',
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        data: { tag: REMINDER_TAG, kind: 'appointment' },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
    });
    return reminderId != null;
  } catch {
    return false;
  }
}

export async function cancelRoundReminder(): Promise<void> {
  const N = await notifications();
  if (!N || !reminderId) return;
  const id = reminderId;
  reminderId = null;
  try {
    await N.cancelScheduledNotificationAsync(id);
  } catch {}
}

const REMINDER_TAG = 'frame.round.reminder';

// --- immediate alerts -------------------------------------------------------

/**
 * PRD 4.6: a hider is told a reveal happened so they can react, but never what
 * the seeker actually sees.
 */
export async function pingReveal(): Promise<void> {
  await fire('YOU HAVE BEEN PINGED', 'Your position was just revealed to the seeker.');
}

/** Generic immediate alert for round events the player must not miss. */
export async function fire(title: string, body: string): Promise<void> {
  const N = await notifications();
  if (!N) return;
  if (!(await hasPermission())) return;
  try {
    await N.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        interruptionLevel: 'timeSensitive',
        data: { tag: ROUND_TAG, kind: 'event' },
      },
      trigger: null,
    });
  } catch {}
}

// --- remote push ------------------------------------------------------------

/**
 * For the events that are not deterministic and so cannot be scheduled ahead:
 * a tag, a nerf, an early zone contraction.
 *
 * Inert today. It needs an EAS project id in app.json (extra.eas.projectId),
 * which needs an EAS project, which needs the Apple Developer Program for the
 * iOS half. Returns null instead of throwing so callers can register
 * unconditionally and get a token as soon as that lands.
 */
export async function registerForPushToken(
  projectId: string | undefined,
): Promise<string | null> {
  const N = await notifications();
  if (!N || !projectId) return null;
  if (!(await ensurePermission())) return null;
  try {
    const token = await N.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

const pad = (n: number) => n.toString().padStart(2, '0');
