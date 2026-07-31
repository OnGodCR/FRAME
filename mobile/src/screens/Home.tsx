import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { color, space } from '../theme';
import { IdentityBar } from '../components/IdentityBar';
import { TabBar, type Tab } from '../components/TabBar';
import { AccountGate } from '../components/AccountGate';
import { GameTab } from './tabs/GameTab';
import { LocationTab } from './tabs/LocationTab';
import { ProfileTab } from './tabs/ProfileTab';
import { SocialTab } from './tabs/SocialTab';
import { StoreTab } from './tabs/StoreTab';
import { useGame } from '../engine/GameContext';

// ---------------------------------------------------------------------------
// The shell.
//
// Home used to be one scrolling column holding identity, a start-here card, a
// checklist, the daily assignment, host and join, a map legend, friends,
// leaderboard, season pass, loadout, shop, a reset link, nearby POIs, and an
// ad. A first-time player had no idea which of those was the thing to do.
//
// Now there are five buckets and the middle one is the game:
//
//   NEARBY    games and POIs around you, 18+ only
//   SOCIAL    friends, leaderboard, referrals
//   GAME      missions, host, join. Nothing else.
//   STORE     season pass, shop
//   PROFILE   level, XP, what you own, settings
//
// Identity is pinned above all of them so a player never hunts for their own
// level or balance, and the tab bar is pinned below, so the only thing that
// scrolls is the content of one bucket.
// ---------------------------------------------------------------------------

export function Home() {
  const [tab, setTab] = useState<Tab>('game');
  const { dailyOpen, missionsComplete, missionSweepPaid, hasAccount } = useGame();

  return (
    <View style={styles.screen}>
      <IdentityBar compact={tab !== 'game'} />

      <View style={styles.body}>
        {tab === 'game' && <GameTab onTab={setTab} />}
        {tab === 'location' && <LocationTab />}
        {tab === 'social' && (
          <AccountGate
            feature="Social"
            reason="Friends, referrals, and the leaderboard all point at a person. A guest is not a person the server can point back at."
          >
            <SocialTab />
          </AccountGate>
        )}
        {tab === 'store' && (
          <AccountGate
            feature="The store"
            reason="FILM and anything bought with it are tied to an account, so they survive a lost phone. A guest has nowhere to keep them."
          >
            <StoreTab />
          </AccountGate>
        )}
        {tab === 'profile' && <ProfileTab />}
      </View>

      <TabBar
        active={tab}
        onChange={setTab}
        badges={{
          // A dot only where there is something genuinely waiting.
          game: dailyOpen || (hasAccount && missionsComplete && !missionSweepPaid),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { flex: 1 },
});
