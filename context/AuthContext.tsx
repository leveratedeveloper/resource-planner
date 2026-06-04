"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { QueryClient, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { clearMainPageCaches } from "@/lib/query/main-page-cache";

export interface SessionData {
  access_token: string;
  user: {
    id: number;
    email: string;
  };
  employee: {
    id: number;
    uuid: string;
    nik?: string;
    full_name: string;
    nickname: string;
    position: string;
    dept_id?: number;
    department_name: string;
    photo: string;
  };
  access: {
    level: 'admin' | 'full' | 'restricted';
    can_view_all: boolean;
    can_view_own_only: boolean;
  };
}

export type PublicSessionData = Omit<SessionData, 'access_token'>;

interface AuthContextType {
  session: PublicSessionData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function shouldFetchAuthSession({
  hasInitialSession,
  hasResolvedInitialSession,
}: {
  hasInitialSession: boolean;
  hasResolvedInitialSession: boolean;
}): boolean {
  return !hasInitialSession && !hasResolvedInitialSession;
}

export function clearAuthSessionAfterLogout(queryClient: QueryClient): void {
  clearMainPageCaches();
  queryClient.clear();
  queryClient.setQueryData(["session"], null);
}

async function fetchSession(): Promise<PublicSessionData | null> {
  const response = await fetch('/api/auth/me');
  if (!response.ok) return null;
  const data = await response.json();
  return data.data;
}

async function logoutUser(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export function AuthProvider({
  children,
  initialSession,
  hasResolvedInitialSession = false,
}: {
  children: ReactNode;
  initialSession?: PublicSessionData | null;
  hasResolvedInitialSession?: boolean;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: session, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: fetchSession,
    initialData: initialSession,
    enabled: shouldFetchAuthSession({
      hasInitialSession: initialSession !== undefined,
      hasResolvedInitialSession,
    }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      clearAuthSessionAfterLogout(queryClient);
      router.replace('/login');
      router.refresh();
    },
  });

  return (
    <AuthContext.Provider
      value={{
        session: session || null,
        isLoading,
        isAuthenticated: !!session,
        logout: () => logoutMutation.mutate(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
