import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { WorldProvider } from './src/engine/WorldContext';
import { Splash, DobGate, HandlePick } from './src/screens/Onboarding';
import { LegalGate } from './src/screens/LegalGate';
import { AuthGate } from './src/screens/AuthGate';
import { Home } from './src/screens/Home';
import { MapTutorial } from './src/screens/MapTutorial';
import { Shop } from './src/screens/Shop';
import { SeasonPass } from './src/screens/SeasonPass';
import { Loadout } from './src/screens/Loadout';
import { Join, Lobby } from './src/screens/JoinLobby';
import { RoleReveal } from './src/screens/RoleReveal';
import { HiderRound } from './src/screens/HiderRound';
import { CheckinFlow } from './src/screens/CheckinFlow';
import { SeekerRound } from './src/screens/SeekerRound';
import { Blackout, Results } from './src/screens/Endings';
import { SoloHub, SoloRun } from './src/screens/Solo';

// Navigation depth drives transition direction: going deeper slides in from
// the right, going back slides in from the left.
const DEPTH: Record<Route, number> = {
  splash: 0,
  dob: 1,
  legal: 2,
  auth: 3,
  handle: 4,
  mapTutorial: 6,
  home: 7,
  shop: 8,
  pass: 8,
  loadout: 8,
  join: 8,
  lobby: 9,
  roleReveal: 10,
  round: 11,
  checkin: 12,
  blackout: 13,
  results: 13,
  // Solo sits alongside the other home-level destinations, so entering it
  // slides forward and backing out of it slides back.
  solo: 8,
  soloRun: 9,
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
    case 'legal':
      screen = <LegalGate />;
      break;
    case 'auth':
      screen = <AuthGate />;
      break;
    case 'handle':
      screen = <HandlePick />;
      break;
    case 'mapTutorial':
      screen = <MapTutorial />;
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
    case 'solo':
      screen = <SoloHub />;
      break;
    case 'soloRun':
      screen = <SoloRun />;
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
    <GestureHandlerRootView style={styles.boot}>
      <SafeAreaProvider>
        <WorldProvider>
          <GameProvider>
            <View style={styles.boot}>
              <StatusBar style="light" />
              <Router />
            </View>
          </GameProvider>
        </WorldProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // overflow hidden so the route transition's horizontal slide never
  // creates a scrollable overhang while it's in flight
  boot: { flex: 1, backgroundColor: color.bg, overflow: 'hidden' },
});
