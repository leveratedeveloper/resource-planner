"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface SessionData {
  access_token: string;
  user: {
    id: number;
    email: string;
  };
  employee: {
    id: number;
    uuid: string;
    full_name: string;
    nickname: string;
    position: string;
    department_name: string;
    photo: string;
  };
  access: {
    level: 'full' | 'restricted';
    can_view_all: boolean;
    can_view_own_only: boolean;
  };
}

interface AuthContextType {
  session: SessionData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchSession(): Promise<SessionData | null> {
  const response = await fetch('/api/auth/me');
  if (!response.ok) return null;
  const data = await response.json();
  return data.data;
}

async function logoutUser(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: session, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.clear();
      router.push('/login');
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
