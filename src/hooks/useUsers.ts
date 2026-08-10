import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface User {
  id: string;
  email: string;
  display_name: string;
  position: string;
  is_admin?: number;
  is_active?: number;
  role_id?: number | null;
  role_label?: string | null;
  created_at?: string;
}

export interface RoleData {
  id: number;
  name: string;
  label: string;
  permissions: string[];
  user_count?: number;
}

export function useUsers(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => apiFetch<User[]>('/users.php?active_only=1'),
    enabled: !!user && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<User> }) =>
      apiFetch(`/users.php?id=${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiFetch(`/users.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (id: string) =>
      apiFetch<{ temporary_password: string }>(`/users.php?id=${id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reset_password' }),
      }),
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      apiFetch<{ is_active: number }>(`/users.php?id=${id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'toggle_active' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (user: { email: string; display_name: string; position: string; password?: string; role_id?: number | null; is_admin?: number }) =>
      apiFetch('/users.php', { method: 'POST', body: JSON.stringify(user) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useChangeUserPassword() {
  return useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) =>
      apiFetch(`/users.php?id=${id}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'change_password', new_password: newPassword }),
      }),
  });
}

export function useRoles(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => apiFetch<RoleData[]>('/roles.php'),
    enabled: Number(user?.is_admin) === 1 && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; label: string; permissions: string[] }) =>
      apiFetch<RoleData>('/roles.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label, permissions }: { id: number; label: string; permissions: string[] }) =>
      apiFetch<RoleData>(`/roles.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ label, permissions }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => apiFetch(`/roles.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}
