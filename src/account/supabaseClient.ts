import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { readCloudConfig } from './cloudConfig';

const SESSION_KEY = 'novel-tracker.supabase-session.v1';
let client: SupabaseClient | null | undefined;

const nativeSessionStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export function isCloudConfigured(): boolean {
  return readCloudConfig({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }) !== null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = readCloudConfig({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!config) return (client = null);
  client = createClient(config.url, config.publishableKey, {
    auth: {
      ...(Platform.OS === 'web' ? {} : { storage: nativeSessionStorage }),
      storageKey: SESSION_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
