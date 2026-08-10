const SA_TENANT_KEY = 'sa_tenant_ctx';

export interface SATenantCtx {
  id: string;
  name: string;
}

export function getSATenant(): SATenantCtx | null {
  try {
    const raw = localStorage.getItem(SA_TENANT_KEY);
    return raw ? (JSON.parse(raw) as SATenantCtx) : null;
  } catch {
    return null;
  }
}

export function setSATenant(ctx: SATenantCtx): void {
  localStorage.setItem(SA_TENANT_KEY, JSON.stringify(ctx));
}

export function clearSATenant(): void {
  localStorage.removeItem(SA_TENANT_KEY);
}
