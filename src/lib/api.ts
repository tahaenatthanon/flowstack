/**
 * Flowstack API Configuration
 * 
 * This file provides:
 * 1. Centralized API base URL configuration (with .env support)
 * 2. Authentication token management
 * 3. API fetch utilities
 * 
 * Environment Variables:
 * - VITE_API_BASE_URL: Set custom API URL (optional)
 *   - If not set, uses window.location.hostname auto-detection
 *   - Example: VITE_API_BASE_URL=http://platform.ktnbs.com/api
 * - VITE_APP_URL: Set custom Frontend App URL (optional)
 *   - If not set, uses window.location.origin auto-detection
 *   - Example: VITE_APP_URL=http://platform.ktnbs.com:8080
 */

// ============================================================
// App URL Configuration (for email links, redirects, etc.)
// ============================================================

/**
 * Get App URL from environment variable or auto-detect
 * Priority:
 * 1. VITE_APP_URL from .env (for production)
 * 2. Auto-detect from window.location.origin (for development)
 */
function getAppUrl(): string {
  const envUrl = import.meta.env.VITE_APP_URL;
  
  if (envUrl && envUrl.trim() !== '') {
    return envUrl;
  }
  
  // Fallback: use current origin
  return window.location.origin;
}

// Export the App URL
export const APP_URL = getAppUrl();

// ============================================================
// API Base URL Configuration
// ============================================================

/**
 * Get API base URL from environment variable or auto-detect
 * Priority:
 * 1. VITE_API_BASE_URL from .env (for production/custom servers)
 * 2. Auto-detect from window.location.hostname (for development)
 */
function getApiBaseUrl(): string {
  // Check if VITE_API_BASE_URL is set in environment
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (envUrl && envUrl.trim() !== '') {
    return envUrl;
  }
  
  // Fallback: auto-detect from current origin (includes port and scheme)
  return `${window.location.origin}/api`;
}

// Export the API base URL
export const API_BASE = getApiBaseUrl();

/**
 * Helper function to get full API URL for an endpoint
 * @param endpoint - The API endpoint (e.g., '/tasks.php')
 * @returns Full URL to the API endpoint
 */
export function getApiUrl(endpoint: string): string {
  // Ensure endpoint starts with / if it doesn't
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${normalizedEndpoint}`;
}

/**
 * Resolve a stored file path (e.g. "uploads/support/abc.jpg") to a browser URL
 * that works in both dev (Vite /uploads proxy) and prod. Derived from API_BASE
 * by stripping the trailing "/api" so it sits at the same host/base as the API.
 */
export function getFileUrl(filePath: string): string {
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const base = API_BASE.replace(/\/api\/?$/, '');
  const clean = filePath.replace(/^\/+/, '');
  return `${base}/${clean}`;
}

// ============================================================
// Authentication Token Management
// ============================================================

const TOKEN_KEY = 'flowstack_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ============================================================
// API Fetch Utilities
// ============================================================

interface ApiFetchOptions extends RequestInit {
  // Optional: override the base URL for this request
  baseUrl?: string;
}

/**
 * Fetch wrapper with automatic token handling.
 *
 * The default generic is `any` (not `unknown`) because the PHP backend returns
 * loosely-typed JSON and the vast majority of callers access fields directly.
 * Pass an explicit type — `apiFetch<MyShape>(...)` — to opt into checking.
 */
export async function apiFetch<T = any>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Inject superadmin tenant context when impersonating a tenant
  try {
    const raw = localStorage.getItem('sa_tenant_ctx');
    if (raw) {
      const ctx = JSON.parse(raw) as { id: string };
      if (ctx?.id) headers['X-Superadmin-Tenant'] = ctx.id;
    }
  } catch { /* ignore */ }
  
  // Use custom baseUrl if provided, otherwise use default API_BASE
  const baseUrl = options.baseUrl || API_BASE;
  const fullUrl = url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
  
  const res = await fetch(fullUrl, { ...options, headers });

  if (!res.ok) {
    // A 401 from the login/signup endpoints means "wrong credentials", not
    // "session expired" — surface the server's real message instead of
    // wiping the token and redirecting.
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/signup');
    // Token expired or invalid — clear session and redirect to login
    if (res.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem(TOKEN_KEY);
      // Avoid redirect loop if already on auth page
      if (!window.location.hash.includes('/auth')) {
        window.location.href = '/#/auth';
      }
      throw new Error('Session expired. Please log in again.');
    }
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    const err = new Error(error.error || error.message || `HTTP ${res.status}`) as any;
    err.status = res.status;
    err.conflict = error.conflict ?? false;
    err.serverUpdated = error.server_updated ?? null;
    err.duplicate = error.duplicate ?? false;
    err.matches = error.matches ?? null;
    throw err;
  }

  const json = await res.json();
  // PHP wraps successful responses in { data: ... } — unwrap it
  return (json && typeof json === 'object' && 'data' in json) ? json.data : json;
}

/**
 * Upload file with FormData
 */
export async function apiUpload<T = any>(
  url: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const raw = localStorage.getItem('sa_tenant_ctx');
    if (raw) {
      const ctx = JSON.parse(raw) as { id: string };
      if (ctx?.id) headers['X-Superadmin-Tenant'] = ctx.id;
    }
  } catch { /* ignore */ }
  
  const fullUrl = url.startsWith('/') ? `${API_BASE}${url}` : `${API_BASE}/${url}`;
  
  const res = await fetch(fullUrl, {
    ...options,
    method: options.method || 'POST',
    headers,
    body: formData,
  });
  
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.hash.includes('/auth')) {
        window.location.href = '/#/auth';
      }
      throw new Error('Session expired. Please log in again.');
    }
    const error = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || error.message || `HTTP ${res.status}`);
  }
  
  return res.json();
}
