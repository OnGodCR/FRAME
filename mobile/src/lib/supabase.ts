import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Whether the project is wired up at all. The demo has to keep working with
 * no backend, so every auth path checks this and degrades to guest rather
 * than throwing.
 */
export const supabaseReady = Boolean(url && anonKey);

// The anon key is meant to be public. It ships in the binary and anyone can
// read it out. Row-level security, not secrecy, is what protects the data,
// which is why the RLS policies are the first backend work.
export const supabase = supabaseReady
  ? createClient(url, anonKey, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // Deep-link callbacks are handled explicitly in AuthGate.
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;
