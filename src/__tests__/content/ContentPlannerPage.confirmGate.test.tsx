import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentPlannerPage from '@/pages/ContentPlannerPage';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { apiFetch } from '@/lib/api';

/**
 * Change: confirm-before-content-create
 *
 * Content Planner AI panel ("สร้างแผนด้วย AI") ต้องแสดงกล่องยืนยันก่อนเรียก
 * generate-plan จริง — ต่างจาก ContentPlannerPage.researchSeed.test.tsx ที่
 * mock ทั้ง useConfirm (ให้ resolve true) และ ContentPlannerAI ทั้ง component
 * เพื่อทดสอบ researchSeedTopic() เทสต์นี้ใช้ <ConfirmProvider> จริงและปล่อยให้
 * ContentPlannerAI เป็น component จริง เพื่อคลิกปุ่ม "สร้างแผนด้วย AI" ผ่าน UI
 * จริง — apiFetch ยัง mock เต็มรูปแบบเหมือนเดิม ไม่มี request ไหนแตะ
 * backend/AI provider จริง ไม่เสีย credit
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

// mock เฉพาะ child component ที่ไม่เกี่ยวกับ AI panel เพื่อลดความซับซ้อนของ render
vi.mock('@/components/content/BestTimeAnalyticsPanel', () => ({ BestTimeAnalyticsPanel: () => null }));
vi.mock('@/components/content/ContentPlannerCalendar', () => ({ ContentPlannerCalendar: () => null }));
vi.mock('@/components/content/ContentItemList', () => ({ ContentItemList: () => null }));
vi.mock('@/components/content/ContentCardDialog', () => ({ ContentCardDialog: () => null }));

function mockApi() {
  vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
    const u = String(url);
    if (u.includes('action=plans')) return [];
    if (u.includes('action=skills') || u.includes('action=contexts') || u.includes('action=triggers') || u.includes('action=channels')) return [];
    if (u.includes('ai-settings.php')) return {};
    if (u.includes('action=analytics-posting-times')) return { has_data: false, by_day: {}, by_hour: {}, recommendations: [] };
    if (u.includes('action=generate-plan')) return { id: 'plan-new', title: 'แผนใหม่', items: [] };
    return {};
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConfirmProvider>
        <ContentPlannerPage />
      </ConfirmProvider>
    </QueryClientProvider>,
  );
}

const generatePlanCalled = () =>
  vi.mocked(apiFetch).mock.calls.some(([u]) => String(u).includes('action=generate-plan'));

async function fillCommandAndClickGenerate() {
  const cmdInput = await screen.findByPlaceholderText(/แผนคอนเทนต์เดือนนี้/);
  fireEvent.change(cmdInput, { target: { value: 'แผนคอนเทนต์เดือนนี้' } });
  fireEvent.click(screen.getByRole('button', { name: /สร้างแผนด้วย AI/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ContentPlannerPage — Content Planner AI panel confirm gate ก่อนสร้าง', () => {
  it('กดปุ่ม "สร้างแผนด้วย AI" ต้องเห็นกล่องยืนยันก่อน ไม่เรียก generate-plan ทันที', async () => {
    mockApi();
    renderPage();

    await fillCommandAndClickGenerate();

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/ยืนยันสร้างแผนคอนเทนต์ด้วย AI/)).toBeTruthy();
    expect(generatePlanCalled()).toBe(false);
  });

  it('กดยกเลิกในกล่องยืนยัน — ไม่เรียก generate-plan', async () => {
    mockApi();
    renderPage();

    await fillCommandAndClickGenerate();
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยกเลิก' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(generatePlanCalled()).toBe(false);
  });

  it('กดยืนยันในกล่อง — เรียก generate-plan ตามปกติ', async () => {
    mockApi();
    renderPage();

    await fillCommandAndClickGenerate();
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยืนยันและสร้างแผน' }));

    await waitFor(() => expect(generatePlanCalled()).toBe(true));
  });
});
