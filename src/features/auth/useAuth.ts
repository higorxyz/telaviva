'use client';

import { useContext } from 'react';
import { AuthContext, type AuthApi } from './auth-context';

export type { AuthApi, AuthStatus } from './auth-context';

export function useAuth(): AuthApi {
  const api = useContext(AuthContext);
  if (!api) throw new Error('useAuth must be used inside AuthProvider');
  return api;
}
