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
import { color, REDUCED_MOTION } from './src/theme';
import { GameProvider, Route, useGame } from './src/engine/GameContext';
import { Splash, DobGate, HandlePick, Permissions } from './src/screens/Onboarding';
import { Home } from './src/screens/Home';
import { Join, Lobby } from './src/screens/JoinLobby';
import { RoleReveal } from './src/screens/RoleReveal';
import { HiderRound } from './src/screens/HiderRound';
import { CheckinFlow } from './src/screens/CheckinFlow';
import { SeekerRound } from './src/screens/SeekerRound';
import { Blackout, Results } from './src/screens/Endings';

function Router() {
  const { route, round } = useGame();
  const fade = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState<Route>(route);

  useEffect(() => {
    if (route === shown) return;
    setShown(route);
    if (REDUCED_MOTION) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
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

  return <Animated.View style={{ flex: 1, opacity: fade }}>{screen}</Animated.View>;
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
  boot: { flex: 1, backgroundColor: color.bg },
});
