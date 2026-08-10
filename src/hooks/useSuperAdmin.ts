import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export function useSuperAdminOverview() {
  return useQuery<any>({
    queryKey: ['superadmin-overview'],
    queryFn: () => apiFetch('/superadmin/overview.php'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useSuperAdminTenants() {
  return useQuery<any[]>({
    queryKey: ['superadmin-tenants'],
    queryFn: () => apiFetch('/superadmin/tenants.php'),
    staleTime: 30_000,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; plan: string; admin_email: string; admin_password: string }) =>
      apiFetch('/superadmin/tenants.php', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      qc.invalidateQueries({ queryKey: ['superadmin-overview'] });
    },
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; slug?: string; plan?: string; status?: string }) =>
      apiFetch(`/superadmin/tenants.php?id=${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      qc.invalidateQueries({ queryKey: ['superadmin-overview'] });
    },
  });
}

export function useExtendTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      apiFetch(`/superadmin/tenants.php?id=${id}&action=extend`, {
        method: 'PUT', body: JSON.stringify({ days }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/superadmin/tenants.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      qc.invalidateQueries({ queryKey: ['superadmin-overview'] });
    },
  });
}

export function usePlanLimits() {
  return useQuery<any[]>({
    queryKey: ['plan-limits'],
    queryFn: () => apiFetch('/superadmin/plan-limits.php'),
    staleTime: 300_000,
  });
}

export function useUpdatePlanLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { plan: string; max_users?: number; price_thb?: number; trial_days?: number }) =>
      apiFetch('/superadmin/plan-limits.php', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-limits'] }),
  });
}

export function useCreatePlanLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { plan: string; max_users: number; price_thb: number; trial_days: number }) =>
      apiFetch('/superadmin/plan-limits.php', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-limits'] }),
  });
}

export function useDeletePlanLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: string) =>
      apiFetch(`/superadmin/plan-limits.php?plan=${encodeURIComponent(plan)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-limits'] }),
  });
}

export function usePayments(status?: string) {
  return useQuery<any[]>({
    queryKey: ['superadmin-payments', status ?? 'all'],
    queryFn: () => apiFetch(`/superadmin/payments.php${status ? `?status=${status}` : ''}`),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useApprovePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) =>
      apiFetch('/superadmin/payments.php?action=approve', {
        method: 'POST', body: JSON.stringify({ payment_id: paymentId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-payments'] });
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      qc.invalidateQueries({ queryKey: ['superadmin-overview'] });
    },
  });
}

export function useRejectPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, note }: { paymentId: string; note: string }) =>
      apiFetch('/superadmin/payments.php?action=reject', {
        method: 'POST', body: JSON.stringify({ payment_id: paymentId, note }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-payments'] }),
  });
}

export function useSuperAdminUsers(search = '') {
  return useQuery<any[]>({
    queryKey: ['superadmin-users', search],
    queryFn: () => apiFetch(`/superadmin/users.php${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    staleTime: 30_000,
  });
}

export function usePaymentMethodsAdmin() {
  return useQuery<any[]>({
    queryKey: ['superadmin-payment-methods'],
    queryFn: () => apiFetch('/superadmin/payment-methods.php'),
    staleTime: 300_000,
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/superadmin/payments.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-payments'] }),
  });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { method: string; label: string; account_name?: string; account_number?: string; qr_image_url?: string }) =>
      apiFetch('/superadmin/payment-methods.php', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-payment-methods'] }),
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/superadmin/payment-methods.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-payment-methods'] }),
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: number; label?: string; account_name?: string; account_number?: string; qr_image_url?: string; is_active?: number }) =>
      apiFetch('/superadmin/payment-methods.php', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-payment-methods'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/superadmin/users.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-users'] });
      qc.invalidateQueries({ queryKey: ['superadmin-overview'] });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; is_active?: number; is_superadmin?: number; display_name?: string; email?: string; password?: string }) =>
      apiFetch(`/superadmin/users.php?id=${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-users'] }),
  });
}
