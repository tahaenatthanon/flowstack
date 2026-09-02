import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ResearchProviderForm from '@/components/brand/ResearchProviderForm';
import { apiFetch } from '@/lib/api';

const toast = vi.fn();

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ResearchProviderForm />
    </QueryClientProvider>,
  );
}

function mockSettings(overrides: Record<string, any> = {}) {
  vi.mocked(apiFetch).mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === '/brand-content.php?action=global-settings' && !options?.method) {
      return {
        research_provider: 'none',
        research_api_login: '',
        has_research_key: false,
        research_location_code: 2764,
        research_language_code: 'th',
        research_cache_hours: 168,
        ...overrides,
      };
    }
    throw new Error(`Unexpected request ${url}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ResearchProviderForm', () => {
  it('keeps test button disabled when provider is not DataForSEO', async () => {
    mockSettings();
    renderForm();

    const button = await screen.findByRole('button', { name: /ทดสอบการเชื่อมต่อ/ });
    expect(button).toHaveProperty('disabled', true);
  });

  it('enables test button when saved DataForSEO credential is available', async () => {
    mockSettings({
      research_provider: 'dataforseo',
      research_api_login: 'login@example.com',
      has_research_key: true,
    });
    renderForm();

    const button = await screen.findByRole('button', { name: /ทดสอบการเชื่อมต่อ/ });
    await waitFor(() => expect(button).toHaveProperty('disabled', false));
  });

  it('shows success toast with balance when connection test succeeds', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string, options?: RequestInit) => {
      if (url === '/brand-content.php?action=global-settings' && !options?.method) {
        return {
          research_provider: 'dataforseo',
          research_api_login: 'login@example.com',
          has_research_key: true,
          research_location_code: 2764,
          research_language_code: 'th',
          research_cache_hours: 168,
        };
      }
      if (url === '/content-research.php?action=test' && options?.method === 'POST') {
        return { ok: true, message: 'เชื่อมต่อ DataForSEO สำเร็จ', balance_usd: 12.5 };
      }
      throw new Error(`Unexpected request ${url}`);
    });
    renderForm();

    const button = await screen.findByRole('button', { name: /ทดสอบการเชื่อมต่อ/ });
    await waitFor(() => expect(button).toHaveProperty('disabled', false));
    fireEvent.click(button);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/content-research.php?action=test', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ provider: 'dataforseo', login: 'login@example.com' }),
      }));
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'เชื่อมต่อ DataForSEO สำเร็จ',
        description: 'ยอดคงเหลือ 12.50 USD',
      }));
    });
  });

  it('shows AI option and hides non-AI fields when AI provider is selected', async () => {
    mockSettings({ research_provider: 'ai' });
    renderForm();

    // wait for settings to load and AI provider to be applied
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('อีเมลสำหรับ DataForSEO')).toBeNull();
    });

    // login / password / location fields are hidden for AI
    expect(screen.queryByPlaceholderText('กรอก password ใหม่')).toBeNull();
    // language + cache still visible
    expect(screen.getByPlaceholderText('th')).toBeTruthy();

    const button = screen.getByRole('button', { name: /ทดสอบการเชื่อมต่อ/ });
    await waitFor(() => expect(button).toHaveProperty('disabled', false));
  });

  it('sends only provider for AI test and shows AI success toast without balance', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string, options?: RequestInit) => {
      if (url === '/brand-content.php?action=global-settings' && !options?.method) {
        return {
          research_provider: 'ai',
          research_api_login: '',
          has_research_key: false,
          research_location_code: 2764,
          research_language_code: 'th',
          research_cache_hours: 168,
        };
      }
      if (url === '/content-research.php?action=test' && options?.method === 'POST') {
        return { ok: true, message: 'Research AI พร้อมใช้งาน' };
      }
      throw new Error(`Unexpected request ${url}`);
    });
    renderForm();

    const button = await screen.findByRole('button', { name: /ทดสอบการเชื่อมต่อ/ });
    await waitFor(() => expect(button).toHaveProperty('disabled', false));
    fireEvent.click(button);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/content-research.php?action=test', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ provider: 'ai' }),
      }));
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'เชื่อมต่อ AI Research สำเร็จ',
      }));
    });
  });

  it('shows error toast when connection test fails without clearing password field', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string, options?: RequestInit) => {
      if (url === '/brand-content.php?action=global-settings' && !options?.method) {
        return {
          research_provider: 'dataforseo',
          research_api_login: '',
          has_research_key: false,
          research_location_code: 2764,
          research_language_code: 'th',
          research_cache_hours: 168,
        };
      }
      if (url === '/content-research.php?action=test' && options?.method === 'POST') {
        return { ok: false, message: 'เชื่อมต่อ DataForSEO ไม่สำเร็จ' };
      }
      throw new Error(`Unexpected request ${url}`);
    });
    renderForm();

    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'dataforseo' } });
    fireEvent.change(await screen.findByPlaceholderText('อีเมลสำหรับ DataForSEO'), { target: { value: 'login@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('กรอก password ใหม่'), { target: { value: 'secret-password' } });
    const button = screen.getByRole('button', { name: /ทดสอบการเชื่อมต่อ/ });
    await waitFor(() => expect(button).toHaveProperty('disabled', false));
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'เชื่อมต่อ DataForSEO ไม่สำเร็จ',
        variant: 'destructive',
      }));
      expect(apiFetch).toHaveBeenCalledWith('/content-research.php?action=test', expect.objectContaining({
        body: JSON.stringify({ provider: 'dataforseo', login: 'login@example.com', password: 'secret-password' }),
      }));
      expect(screen.getByDisplayValue('secret-password')).toBeTruthy();
    });
  });
});
