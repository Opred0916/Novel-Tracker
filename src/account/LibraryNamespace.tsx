import React, { createContext, useContext } from 'react';
import { accountImageDirectory } from './accountStorage';

const NamespaceContext = createContext('novel-tracker');

export function LibraryNamespace({ accountId, children }: { accountId?: string; children: React.ReactNode }) {
  return <NamespaceContext.Provider value={accountImageDirectory(accountId)}>{children}</NamespaceContext.Provider>;
}

export function useLibraryImageDirectory(): string { return useContext(NamespaceContext); }
