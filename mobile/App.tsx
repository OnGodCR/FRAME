import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { color } from './src/theme';
import { EASE_OUT } from './src/components/motion';
import { GameProvider, Route, useGame } from './src/engine/GameContext';
import { Splash, DobGate, HandlePick, Permissions } from './src/screens/Onboarding';
import { Home } from './src/screens/Home';
import { Shop } from './src/screens/Shop';
import { SeasonPass } from './src/screens/SeasonPass';
import { Loadout } from './src/screens/Loadout';
import { Join, Lobby } from './src/screens/JoinLobby';
import { RoleReveal } from './src/screens/RoleReveal';
import { HiderRound } from './src/screens/HiderRound';
import { CheckinFlow } from './src/screens/CheckinFlow';
import { SeekerRound } from './src/screens/SeekerRound';
import { Blackout, Results } from './src/screens/Endings';

// Navigation depth drives transition direction: going deeper slides in from
// the right, going back slides in from the left.
const DEPTH: Record<Route, number> = {
  splash: 0,
  dob: 1,
  handle: 2,
  permissions: 3,
  home: 4,
  shop: 5,
  pass: 5,
  loadout: 5,
  join: 5,
  lobby: 6,
  roleReveal: 7,
  round: 8,
  checkin: 9,
  blackout: 10,
  results: 10,
};

function Router() {
  const { route, round } = useGame();
  const anim = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState<Route>(route);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    if (route === shown) return;
    setDir(DEPTH[route] >= DEPTH[shown] ? 1 : -1);
    setShown(route);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [route]);

  let screen: React.ReactNode = null;
  switch (shown) {
    case 'splash':
      screen = <Splash />;
      break;
    case 'dob':
      screen = <DobGate />;
      break;
    case 'handle':
      screen = <HandlePick />;
      break;
    case 'permissions':
      screen = <Permissions />;
      break;
    case 'home':
      screen = <Home />;
      break;
    case 'shop':
      screen = <Shop />;
      break;
    case 'pass':
      screen = <SeasonPass />;
      break;
    case 'loadout':
      screen = <Loadout />;
      break;
    case 'join':
      screen = <Join />;
      break;
    case 'lobby':
      screen = <Lobby />;
      break;
    case 'roleReveal':
      screen = <RoleReveal />;
      break;
    case 'round':
      screen = round?.role === 'seeker' ? <SeekerRound /> : <HiderRound />;
      break;
    case 'checkin':
      screen = <CheckinFlow />;
      break;
    case 'blackout':
      screen = <Blackout />;
      break;
    case 'results':
      screen = <Results />;
      break;
  }

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: anim,
        transform: [
          {
            translateX: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [28 * dir, 0],
            }),
          },
        ],
      }}
    >
      {screen}
    </Animated.View>
  );
}

export default function App() {
  const [loaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  if (!loaded) return <View style={styles.boot} />;
  return (
    <SafeAreaProvider>
      <GameProvider>
        <View style={styles.boot}>
          <StatusBar style="light" />
          <Router />
        </View>
      </GameProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // overflow hidden so the route transition's horizontal slide never
  // creates a scrollable overhang while it's in flight
  boot: { flex: 1, backgroundColor: color.bg, overflow: 'hidden' },
});
