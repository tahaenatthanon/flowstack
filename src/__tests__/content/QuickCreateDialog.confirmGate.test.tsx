import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuickCreateDialog from '@/components/content/dialogs/QuickCreateDialog';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { apiFetch } from '@/lib/api';

/**
 * Change: confirm-before-content-create
 *
 * Quick Create ต้องแสดงกล่องยืนยันก่อนเรียก generate-plan จริง — เทสต์นี้ใช้
 * <ConfirmProvider> จริง (ไม่ mock useConfirm) เพื่อยืนยันพฤติกรรมกล่องยืนยัน
 * เอง ต่างจากเทสต์อื่นของ QuickCreateDialog ที่ mock useConfirm ให้ resolve
 * true เพื่อทดสอบ behavior หลัง confirm แทน — apiFetch ยัง mock เต็มรูปแบบ
 * เหมือนเดิม ไม่มี request ไหนแตะ backend/AI provider จริง ไม่เสีย credit
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConfirmProvider>
        <QuickCreateDialog open onOpenChange={() => {}} />
      </ConfirmProvider>
    </QueryClientProvider>,
  );
}

function mockApi() {
  vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
    const u = String(url);
    if (u.includes('action=skills') || u.includes('action=contexts') || u.includes('action=triggers')) return [];
    if (u.includes('action=generate-plan')) return { items: [] };
    throw new Error('unexpected ' + u);
  });
}

async function gotoFormAndFill(topic = 'หัวข้อทดสอบ confirm gate') {
  fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
  const topicInput = await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/);
  fireEvent.change(topicInput, { target: { value: topic } });
  return topicInput;
}

const generatePlanCalled = () =>
  vi.mocked(apiFetch).mock.calls.some(([u]) => String(u).includes('action=generate-plan'));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuickCreateDialog — confirm gate ก่อนสร้าง', () => {
  it('กดปุ่มสร้าง ต้องเห็นกล่องยืนยันก่อน ไม่เรียก generate-plan ทันที', async () => {
    mockApi();
    renderDialog();
    const topic = 'หัวข้อทดสอบ confirm gate';
    await gotoFormAndFill(topic);

    fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/ยืนยันสร้างบทความ/)).toBeTruthy();
    expect(within(dialog).getByText(new RegExp(topic))).toBeTruthy();
    expect(generatePlanCalled()).toBe(false);
  });

  it('กดยกเลิกในกล่องยืนยัน — ไม่เรียก generate-plan และฟอร์มยังอยู่ครบ', async () => {
    mockApi();
    renderDialog();
    const topic = 'หัวข้อทดสอบ confirm gate';
    const topicInput = await gotoFormAndFill(topic);

    fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยกเลิก' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(generatePlanCalled()).toBe(false);
    // ฟอร์มยังอยู่ที่ step 'form' พร้อมค่าที่กรอกไว้เดิม
    expect((topicInput as HTMLInputElement).value).toBe(topic);
  });

  it('กดยืนยันในกล่อง — เรียก generate-plan ตามปกติ', async () => {
    mockApi();
    renderDialog();
    await gotoFormAndFill();

    fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยืนยันและสร้าง' }));

    await waitFor(() => expect(generatePlanCalled()).toBe(true));
  });
});
