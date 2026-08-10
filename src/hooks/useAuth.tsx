/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiFetch, apiUpload, setToken, getToken, removeToken } from '@/lib/api';

export interface UserAlias {
  id: string;
  alias_email: string;
  label: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  position: string;
  avatar_url?: string;
  is_admin?: number;
  is_active?: number;
  role_id?: number | null;
  role_label?: string | null;
  tenant_id?: string;
  permissions?: string[];
  aliases?: UserAlias[];
  is_superadmin?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string, companyName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refetchUser: () => Promise<void>;
  updateProfile: (data: { display_name: string; position: string }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  hasPermission: (menuKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const userData = await apiFetch<User>('/auth/me.php');
      setUser(userData);
    } catch {
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCurrentUser(); }, []);

  const signUp = async (email: string, password: string, displayName: string, companyName?: string) => {
    const result = await apiFetch<{ token: string; user: User }>('/auth/signup.php', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName, company_name: companyName || displayName }),
    });
    setToken(result.token);
    setUser(result.user);
  };

  const signIn = async (email: string, password: string) => {
    const result = await apiFetch<{ token: string; user: User }>('/auth/login.php', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(result.token);
    setUser(result.user);
  };

  const signOut = async () => {
    try {
      await apiFetch('/auth/logout.php', { method: 'POST' });
    } catch {
      // Continue with logout even if API fails
    }
    removeToken();
    setUser(null);
  };

  const refetchUser = async () => {
    setLoading(true);
    await fetchCurrentUser();
  };

  const updateProfile = async (data: { display_name: string; position: string }) => {
    const updated = await apiFetch<User>('/profile.php', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setUser(updated);
  };

  const uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const result = await apiUpload<{ avatar_url: string }>('/upload.php', formData);
    setUser((prev) => prev ? { ...prev, avatar_url: result.avatar_url } : prev);
  };

  const hasPermission = (menuKey: string): boolean => {
    if (!user) return false;
    if (Number(user.is_superadmin) === 1) return true;
    if (Number(user.is_admin) === 1) return true;
    return user.permissions?.includes(menuKey) ?? false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, refetchUser, updateProfile, uploadAvatar, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
