import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { AccountAuthService } from './accountAuth';
import { getSupabaseClient, isCloudConfigured } from './supabaseClient';

type AccountContextValue = {
  user: User | null;
  configured: boolean;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(getSupabaseClient);
  const [loading, setLoading] = useState(() => client !== null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user ?? null); setLoading(false); }
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (active) { setUser(error ? null : data.session?.user ?? null); setLoading(false); }
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client]);

  const value = useMemo<AccountContextValue>(() => {
    const service = client ? new AccountAuthService(client.auth) : null;
    const requireService = () => {
      if (!service) throw new Error('云同步尚未配置');
      return service;
    };
    return {
      user,
      configured: isCloudConfigured(),
      sendCode: email => requireService().sendCode(email),
      verifyCode: (email, code) => requireService().verifyCode(email, code),
      signOut: async () => {
        await requireService().signOut();
        setUser(null);
      },
    };
  }, [client, user]);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('Account provider is not ready');
  return value;
}
