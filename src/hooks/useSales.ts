import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DbCompany,
  DbCustomer,
  DbTaskDependency,
  DbTaskHistory,
  ResourceWorkload,
  CrossProjectImpact,
  DependencyReasonCode,
  CompanySettings
} from '@/types/project';

// ============================================
// COMPANY HOOKS
// ============================================

export function useCompanies(activeOnly: boolean = false, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['companies', user?.id, activeOnly],
    queryFn: async () => {
      const params = activeOnly ? '?active_only=1' : '';
      return apiFetch(`/companies.php${params}`);
    },
    enabled: !!user && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCompany(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      return apiFetch(`/companies.php?id=${id}`);
    },
    enabled: !!user && !!id,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (companyData: Partial<DbCompany>) => {
      return apiFetch('/companies.php', {
        method: 'POST',
        body: JSON.stringify(companyData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['companies-paginated'] });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbCompany> }) => {
      return apiFetch(`/companies.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['companies-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['company', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-with-company-customer'] });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/companies.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['companies-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-with-company-customer'] });
    },
  });
}

// ============================================
// CUSTOMER HOOKS
// ============================================

export function useCustomers(companyId?: string, activeOnly: boolean = false, enabled = true) {
  const { user } = useAuth();
  return useQuery<DbCustomer[]>({
    queryKey: ['customers', user?.id, companyId, activeOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.set('company_id', companyId);
      if (activeOnly) params.set('active_only', '1');
      const qs = params.toString();
      return apiFetch<DbCustomer[]>(`/customers.php${qs ? '?' + qs : ''}`);
    },
    enabled: !!user && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCustomer(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      return apiFetch(`/customers.php?id=${id}`);
    },
    enabled: !!user && !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (customerData: Partial<DbCustomer>) => {
      return apiFetch('/customers.php', {
        method: 'POST',
        body: JSON.stringify(customerData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-paginated'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbCustomer> }) => {
      return apiFetch(`/customers.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-with-company-customer'] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/customers.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-with-company-customer'] });
    },
  });
}

export function usePrimaryContacts(companyId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['primary-contacts', companyId],
    queryFn: async () => {
      return apiFetch(`/customers.php?company_id=${companyId}&primary_only=1&active_only=1`);
    },
    enabled: !!user && !!companyId,
  });
}

export function useProjectsWithCompanyCustomer(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['projects-with-company-customer', user?.id],
    queryFn: async () => {
      return apiFetch('/views/project-company-customer.php');
    },
    enabled: !!user && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================================
// Phase 1 Sales Hooks - Opportunities
// ============================================================

export function useOpportunities(filters?: { companyId?: string; stage?: string; assignedTo?: string }, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['opportunities', filters],
    queryFn: async () => {
      let url = '/opportunities.php?';
      if (filters?.companyId) url += `company_id=${filters.companyId}&`;
      if (filters?.stage) url += `stage=${filters.stage}&`;
      if (filters?.assignedTo) url += `assigned_to=${filters.assignedTo}&`;
      return apiFetch(url);
    },
    enabled: !!user && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useOpportunity(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['opportunity', id],
    queryFn: async () => {
      return apiFetch(`/opportunities.php?id=${id}`);
    },
    enabled: !!user && !!id,
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      return apiFetch('/opportunities.php', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useUpdateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiFetch(`/opportunities.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity', variables.id] });
    },
  });
}

export function useDeleteOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/opportunities.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

// ============================================================
// Phase 1 Sales Hooks - Quotations
// ============================================================

export function useQuotations(filters?: { opportunityId?: string; companyId?: string; status?: string }, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['quotations', filters],
    queryFn: async () => {
      let url = '/quotations.php?';
      if (filters?.opportunityId) url += `opportunity_id=${filters.opportunityId}&`;
      if (filters?.companyId) url += `company_id=${filters.companyId}&`;
      if (filters?.status) url += `status=${filters.status}&`;
      return apiFetch(url);
    },
    enabled: !!user && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useQuotation(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['quotation', id],
    queryFn: async () => {
      return apiFetch(`/quotations.php?id=${id}`);
    },
    enabled: !!user && !!id,
  });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      return apiFetch('/quotations.php', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useUpdateQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiFetch(`/quotations.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation', variables.id] });
    },
  });
}

export function useDeleteQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/quotations.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

// ============================================================
// Sales Activities
// ============================================================

export function useSalesActivities(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['sales-activities', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];
      return apiFetch(`/sales-activities.php?opportunity_id=${opportunityId}`);
    },
    enabled: !!opportunityId,
  });
}

export function useCreateSalesActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      opportunity_id: string;
      activity_type: string;
      subject: string;
      description?: string;
      activity_date?: string;
    }) => {
      return apiFetch('/sales-activities.php', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-activities', variables.opportunity_id] });
    },
  });
}

export function useDeleteSalesActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; opportunityId: string }) => {
      return apiFetch(`/sales-activities.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-activities', variables.opportunityId] });
    },
  });
}

export function useUpdateSalesActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      opportunity_id: string;
      activity_type: string;
      subject: string;
      description?: string;
      activity_date?: string;
    }) => {
      return apiFetch(`/sales-activities.php?id=${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-activities', variables.opportunity_id] });
    },
  });
}

// ============================================================
// Paginated Companies & Customers
// ============================================================

export interface PagedResult<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export function useCompaniesPaginated(params: {
  page: number;
  perPage?: number;
  search?: string;
  activeOnly?: boolean;
}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['companies-paginated', params.page, params.perPage, params.search, params.activeOnly],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('page', String(params.page));
      qs.set('per_page', String(params.perPage ?? 12));
      if (params.search)     qs.set('search',      params.search);
      if (params.activeOnly) qs.set('active_only', '1');
      return apiFetch<PagedResult<any>>(`/companies.php?${qs.toString()}`);
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev: any) => prev,
  });
}

export function useCustomersPaginated(params: {
  page: number;
  perPage?: number;
  search?: string;
  companyId?: string;
  activeOnly?: boolean;
}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['customers-paginated', params.page, params.perPage, params.search, params.companyId, params.activeOnly],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('page', String(params.page));
      qs.set('per_page', String(params.perPage ?? 12));
      if (params.search)     qs.set('search',      params.search);
      if (params.companyId)  qs.set('company_id',  params.companyId);
      if (params.activeOnly) qs.set('active_only', '1');
      return apiFetch<PagedResult<any>>(`/customers.php?${qs.toString()}`);
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev: any) => prev,
  });
}

// ============================================================
// Sales Activity Evaluation (per-company email + CRM metrics)
// ============================================================

export interface SalesActivityEvalCompany {
  company_id: string;
  company_name: string;
  customers_count: number;
  emails_sent: number;
  emails_delivered: number;
  emails_opened: number;
  emails_clicked: number;
  emails_bounced: number;
  open_rate: number;
  click_rate: number;
  ca_total: number;
  ca_email_sent: number;
  ca_email_opened: number;
  ca_email_clicked: number;
  ca_email_replied: number;
  ca_email_bounced: number;
  sales_act_total: number;
  sa_email: number;
  sa_call: number;
  sa_meeting: number;
  sa_note: number;
  sa_quotation: number;
  sa_other: number;
  opp_count: number;
  opp_won: number;
  opp_lost: number;
  opp_value: number;
  win_rate: number;
  survey_count: number;
  survey_responded: number;
  survey_response_rate: number;
  avg_pain_score: number | null;
  engagement_score: number;
}

export interface SalesActivityEvalResult {
  summary: {
    companies_total: number;
    avg_open_rate: number;
    avg_click_rate: number;
    win_rate: number;
    total_sales_acts: number;
    total_ca_acts: number;
    activity_breakdown: Record<string, number>;
  };
  companies: SalesActivityEvalCompany[];
}

export function useSalesActivityEval(
  params?: { start_date?: string; end_date?: string; company_id?: string },
  enabled = true
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['sales-activity-eval', params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.start_date) qs.set('start_date', params.start_date);
      if (params?.end_date)   qs.set('end_date',   params.end_date);
      if (params?.company_id) qs.set('company_id', params.company_id);
      return apiFetch<SalesActivityEvalResult>(`/sales-activity-eval.php?${qs.toString()}`);
    },
    enabled: !!user && enabled,
    staleTime: 3 * 60 * 1000,
  });
}

// ============================================================
// Company Settings (single-row system config)
// ============================================================

export function useCompanySettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      return apiFetch<CompanySettings>('/settings.php');
    },
    enabled: !!user,
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
      return apiFetch<CompanySettings>('/settings.php', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    },
  });
}

export function useNextQuotationNumber(enabled: boolean = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['next-quotation-number'],
    queryFn: async () => {
      return apiFetch<{ next_number: string; period_key: string; sequence: number; format: string }>(
        '/next-quotation-number.php'
      );
    },
    enabled: !!user && enabled,
  });
}

