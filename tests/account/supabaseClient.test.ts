jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ mocked: true })),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { getSupabaseClient } from '../../src/account/supabaseClient';

describe('Supabase native session storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key';
  });

  it('uses a stable SecureStore-safe storage key', async () => {
    getSupabaseClient();

    const auth = (createClient as jest.Mock).mock.calls[0][2].auth;
    expect(auth.storageKey).toBe('novel-tracker.supabase-session.v1');

    await auth.storage.getItem(auth.storageKey);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('novel-tracker.supabase-session.v1');
  });
});
