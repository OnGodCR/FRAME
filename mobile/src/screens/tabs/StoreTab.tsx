import React, { useState } from 'react';
import { View } from 'react-native';
import { Segmented } from './Segmented';
import { Shop } from '../Shop';
import { SeasonPass } from '../SeasonPass';

// ---------------------------------------------------------------------------
// Store: everything that costs money or FILM, and nothing that does not.
//
// Keeping the pass and the shop in one bucket is deliberate. They compete for
// the same spend, so a player deciding between them should be able to see both
// without leaving, and neither should be able to ambush someone who came here
// for the other.
// ---------------------------------------------------------------------------

type Seg = 'shop' | 'pass';

const OPTIONS: { key: Seg; label: string }[] = [
  { key: 'shop', label: 'SHOP' },
  { key: 'pass', label: 'SEASON PASS' },
];

export function StoreTab() {
  const [seg, setSeg] = useState<Seg>('shop');
  return (
    <View style={{ flex: 1 }}>
      <Segmented options={OPTIONS} value={seg} onChange={setSeg} />
      <View style={{ flex: 1 }}>
        {seg === 'shop' ? <Shop embedded /> : <SeasonPass embedded />}
      </View>
    </View>
  );
}
