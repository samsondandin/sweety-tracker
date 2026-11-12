import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, type User } from '../api/auth';

interface AuthContextType {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: { full_name?: string; display_name?: string | null; timezone?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('sweety_auth_token');
    if (!token) {
      setReady(true);
      return;
    }

    authApi.getMe()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        localStorage.removeItem('sweety_auth_token');
        setUser(null);
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setUser(res.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await authApi.register(name, email, password);
    setUser(res.user);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const updateProfile = async (profileData: { full_name?: string; display_name?: string | null; timezone?: string }) => {
    const res = await authApi.updateProfile(profileData);
    if (user) {
      setUser({
        ...user,
        profile: {
          ...user.profile,
          ...res.profile
        }
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

