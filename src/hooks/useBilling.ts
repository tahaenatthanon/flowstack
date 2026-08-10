import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiUrl, getToken } from '@/lib/api';

export interface BillingStatus {
  plan: 'trial' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  started_at: string;
  expires_at: string | null;
  max_users: number;
  current_users: number;
  price_thb: number;
  trial_days: number;
}

export interface Invoice {
  id: string;
  plan: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
  last_payment_status: string | null;
  pending_payment_id: string | null;
}

export interface PaymentMethod {
  id: number;
  method: 'qr' | 'bank_transfer';
  label: string;
  account_name: string | null;
  account_number: string | null;
  qr_image_url: string | null;
  is_active: number;
  sort_order: number;
}

export interface PlanLimit {
  plan: string;
  max_users: number;
  price_thb: string;
  trial_days: number;
  is_active: number;
}

export function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ['billing-status'],
    queryFn: () => apiFetch('/billing/status.php'),
    staleTime: 60_000,
  });
}

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['billing-invoices'],
    queryFn: () => apiFetch('/billing/invoices.php'),
    staleTime: 30_000,
  });
}

export function usePaymentMethods() {
  return useQuery<PaymentMethod[]>({
    queryKey: ['billing-methods'],
    queryFn: () => apiFetch('/billing/methods.php'),
    staleTime: 300_000,
  });
}

export function usePlanLimits() {
  return useQuery<PlanLimit[]>({
    queryKey: ['plan-limits-public'],
    queryFn: () => apiFetch('/billing/plans.php'),
    staleTime: 300_000,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: string) => apiFetch('/billing/invoices.php', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-invoices'] }),
  });
}

export function useSubmitPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { invoice_id: string; method: 'qr' | 'bank_transfer'; slip_url?: string; note?: string }) =>
      apiFetch('/billing/pay.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-invoices'] });
      qc.invalidateQueries({ queryKey: ['billing-status'] });
    },
  });
}

export function useUploadSlip() {
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('slip', file);
      const res = await fetch(getApiUrl('/billing/upload.php'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken() ?? ''}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'อัปโหลดไม่สำเร็จ');
      return json as { url: string };
    },
  });
}
