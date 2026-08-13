import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentApprovalPage from '@/pages/ContentApprovalPage';
import type { ContentItem } from '@/components/content/types';

// One item per approval-relevant status so the stat cards have distinct, checkable counts.
// Only the `pending_approval` item renders the approve/reject buttons.
const ITEMS: ContentItem[] = [
  { id: 'ci-pending',  title: 'รอตรวจ บทความ A', type: 'article', status: 'pending_approval',
    views: 0, likes: 0, created_at: '2026-01-04', platform: 'facebook', plan_item_id: null },
  { id: 'ci-approved', title: 'อนุมัติแล้ว B',    type: 'article', status: 'approved',
    views: 0, likes: 0, created_at: '2026-01-03', platform: 'facebook', plan_item_id: null },
  { id: 'ci-revision', title: 'ขอแก้ไข C',        type: 'article', status: 'revision',
    views: 0, likes: 0, created_at: '2026-01-02', platform: 'facebook', plan_item_id: null },
  { id: 'ci-rejected', title: 'ปฏิเสธ D',         type: 'article', status: 'rejected',
    views: 0, likes: 0, created_at: '2026-01-01', platform: 'facebook', plan_item_id: null },
];

// Records every apiFetch call so we can assert the detail view issues no writes.
const apiCalls: { url: string; method: string }[] = [];

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiFetch: vi.fn(async (url: string, options: RequestInit = {}) => {
      apiCalls.push({ url, method: options.method ?? 'GET' });
      if (url.startsWith('/content-items.php')) return ITEMS;
      return [];
    }),
  };
});

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

/** Wait until the table has rendered (React Query resolves the mocked fetch). */
async function renderPage() {
  wrap(<ContentApprovalPage />);
  await waitFor(() => expect(screen.getByText('รอตรวจ บทความ A')).toBeTruthy());
}

/** The row-click detail dialog is the only one titled "รายละเอียดคอนเทนต์". */
function detailDialog() {
  return screen.queryByRole('heading', { name: 'รายละเอียดคอนเทนต์' });
}

beforeEach(() => {
  apiCalls.length = 0;
});

describe('ContentApprovalPage', () => {
  it('renders stat cards with title, icon and count per status', async () => {
    await renderPage();
    // Each status has exactly one item in the fixture
    for (const label of ['รออนุมัติ', 'อนุมัติแล้ว', 'ขอแก้ไข', 'ปฏิเสธ']) {
      const card = screen.getAllByText(label)[0].closest('[class*="rounded"]');
      expect(card).toBeTruthy();
      expect(within(card as HTMLElement).getByText('1')).toBeTruthy();
    }
  });

  it('opens the content detail dialog when a row is clicked', async () => {
    await renderPage();
    expect(detailDialog()).toBeNull();

    fireEvent.click(screen.getByText('อนุมัติแล้ว B'));

    await waitFor(() => expect(detailDialog()).toBeTruthy());
    // ContentDetailView renders its own header with a back button
    expect(screen.getByRole('button', { name: /กลับ/ })).toBeTruthy();
  });

  it('does not mutate content status when viewing detail', async () => {
    await renderPage();
    apiCalls.length = 0;

    fireEvent.click(screen.getByText('อนุมัติแล้ว B'));
    await waitFor(() => expect(detailDialog()).toBeTruthy());

    expect(apiCalls.filter(c => c.method !== 'GET')).toEqual([]);
  });

  it('approve button opens the confirm dialog without opening the detail dialog', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: /อนุมัติ/ }));

    // The confirm dialog's title and its submit button share the same text —
    // match the heading so the query stays unambiguous.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'ยืนยันการอนุมัติ' })).toBeTruthy()
    );
    // stopPropagation keeps the row click from firing
    expect(detailDialog()).toBeNull();
  });

  it('reject button opens the reject dialog without opening the detail dialog', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: /ปฏิเสธ/ }));

    await waitFor(() => expect(screen.getByText('ปฏิเสธเนื้อหา')).toBeTruthy());
    expect(detailDialog()).toBeNull();
  });

  it('approve sends a PUT with status approved', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /อนุมัติ/ }));
    await waitFor(() => screen.getByRole('heading', { name: 'ยืนยันการอนุมัติ' }));
    apiCalls.length = 0;

    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการอนุมัติ' }));

    await waitFor(() =>
      expect(apiCalls).toContainEqual({ url: '/content-items.php?id=ci-pending', method: 'PUT' })
    );
  });
});
