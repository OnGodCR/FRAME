import React, { useState } from 'react';
import { View } from 'react-native';
import { Segmented } from './Segmented';
import { Friends } from '../Friends';
import { Leaderboard } from '../Leaderboard';

// ---------------------------------------------------------------------------
// Social: friends, leaderboard, referrals.
//
// Referrals live inside Friends rather than getting their own segment. A
// referral is a friend you brought, so splitting them apart would mean two
// screens that both say "enter a code" and neither of which is obviously the
// right one.
// ---------------------------------------------------------------------------

type Seg = 'friends' | 'leaderboard';

const OPTIONS: { key: Seg; label: string }[] = [
  { key: 'friends', label: 'FRIENDS' },
  { key: 'leaderboard', label: 'RANKS' },
];

export function SocialTab() {
  const [seg, setSeg] = useState<Seg>('friends');
  return (
    <View style={{ flex: 1 }}>
      <Segmented options={OPTIONS} value={seg} onChange={setSeg} />
      <View style={{ flex: 1 }}>
        {seg === 'friends' ? <Friends embedded /> : <Leaderboard embedded />}
      </View>
    </View>
  );
}
