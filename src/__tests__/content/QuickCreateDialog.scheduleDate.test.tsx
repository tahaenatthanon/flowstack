import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuickCreateDialog from '@/components/content/dialogs/QuickCreateDialog';
import { apiFetch } from '@/lib/api';

/**
 * Regression: QuickCreateDialog ไม่เคยเรียก action=plan-item-date เลย ต่างจาก
 * BatchGenerateDialog.tsx ที่ตั้ง scheduled_date ให้ทุก item หลัง generate-plan
 * สำเร็จ — ทำให้ item ที่สร้างผ่าน Quick Create ไม่มีวันที่กำหนดตั้งแต่ต้น
 * (ต้องพึ่ง unscheduled bucket ใน ContentPlannerCalendar เป็นทางแสดงผลสำรอง
 * อย่างเดียว) เปลี่ยนพฤติกรรม: ตั้ง scheduled_date เป็นวันปัจจุบันอัตโนมัติ
 * แบบ best-effort ก่อนเริ่ม Research เสมอ ไม่มี date picker ใหม่ในฟอร์ม
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
// QuickCreateDialog เรียก useConfirm() ตรงๆ ไม่มี <ConfirmProvider> ครอบในเทสต์นี้ —
// mock ให้ confirm() resolve true เพื่อคง flow เดิม (ดู change confirm-before-content-create)
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <QuickCreateDialog open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

async function gotoFormAndCreate() {
  fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
  const topicInput = await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/);
  fireEvent.change(topicInput, { target: { value: 'หัวข้อทดสอบ' } });
  fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));
}

/** mock ทุก endpoint ที่ dialog เรียก และเก็บ body ไว้ตรวจ (เรียงตามลำดับที่ยิงจริง) */
function mockApi(opts: { failPlanItemDate?: boolean } = {}) {
  const bodies: Record<string, any>[] = [];
  vi.mocked(apiFetch).mockImplementation(async (url: unknown, init?: any) => {
    const u = String(url);
    if (init?.body) bodies.push({ url: u, body: JSON.parse(init.body as string) });
    if (u.includes('action=skills') || u.includes('action=contexts') || u.includes('action=triggers')) return [];
    if (u.includes('action=generate-plan')) return { items: [{ id: 'item-1', topic: 'หัวข้อทดสอบ' }] };
    if (u.includes('action=plan-item-date')) {
      if (opts.failPlanItemDate) throw new Error('ตั้งวันที่ไม่สำเร็จ');
      return { updated: true };
    }
    if (u.includes('action=fetch')) return { job_id: 'job-1', status: 'done' };
    if (u.includes('action=analyze')) return { job_id: 'job-1', status: 'done', analysis: {} };
    if (u.includes('action=generate-article')) return { article: { title: 'ok' } };
    throw new Error('unexpected ' + u);
  });
  return bodies;
}

const findBody = (bodies: Record<string, any>[], fragment: string) =>
  bodies.find(b => b.url.includes(fragment))?.body;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuickCreateDialog — ตั้ง scheduled_date อัตโนมัติหลัง generate-plan', () => {
  it('เรียก plan-item-date ด้วย item_id ถูกต้องและ scheduled_date เป็นวันปัจจุบัน (local date, ไม่ใช้ toISOString)', async () => {
    // สอดส่อง toISOString() แทนการ fake ทั้ง clock (fake timers ชนกับ waitFor
    // ของ RTL ที่พึ่ง real timer ภายใน) — ยืนยันว่า path การคำนวณวันที่ของ
    // QuickCreateDialog ไม่เรียก toISOString() เลย (ต่างจาก BatchGenerateDialog
    // ที่ยังมี pattern นี้หลงเหลืออยู่)
    const isoSpy = vi.spyOn(Date.prototype, 'toISOString');
    const bodies = mockApi();
    renderDialog();

    await gotoFormAndCreate();

    await waitFor(() => expect(findBody(bodies, 'action=plan-item-date')).toBeTruthy());
    const dateBody = findBody(bodies, 'action=plan-item-date')!;
    expect(dateBody.item_id).toBe('item-1');

    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(dateBody.scheduled_date).toBe(expected);
    expect(isoSpy).not.toHaveBeenCalled();

    isoSpy.mockRestore();
  });

  it('เรียก plan-item-date ก่อน research fetch เสมอ', async () => {
    const bodies = mockApi();
    renderDialog();

    await gotoFormAndCreate();

    await waitFor(() => expect(findBody(bodies, 'action=fetch')).toBeTruthy());
    const dateIndex = bodies.findIndex(b => b.url.includes('action=plan-item-date'));
    const fetchIndex = bodies.findIndex(b => b.url.includes('action=fetch'));
    expect(dateIndex).toBeGreaterThanOrEqual(0);
    expect(dateIndex).toBeLessThan(fetchIndex);
  });

  it('plan-item-date ล้มเหลว — Research/Generate ยังทำงานต่อตามปกติ ไม่ throw กลับ form', async () => {
    mockApi({ failPlanItemDate: true });
    renderDialog();

    await gotoFormAndCreate();

    // ต้องยังไปถึง generate-article ได้ตามปกติ (ไม่ตกกลับไป step 'form')
    await waitFor(() => expect(screen.getByText(/สร้างสำเร็จ/)).toBeInTheDocument());
  });

  it('plan-item-date ล้มเหลว — แจ้ง toast แยกเฉพาะเรื่องวันที่ ไม่ใช่ toast ล้มเหลวหลัก', async () => {
    mockApi({ failPlanItemDate: true });
    renderDialog();

    await gotoFormAndCreate();

    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('ยังไม่ได้กำหนดวันที่'),
        variant: 'destructive',
      }),
    ));
    // ไม่ใช่ toast ล้มเหลวหลักของการสร้าง content (ซึ่งจะมี title "สร้างไม่สำเร็จ")
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'สร้างไม่สำเร็จ' }));
  });

  it('plan-item-date สำเร็จ — ไม่มี toast แจ้งเตือนเรื่องวันที่', async () => {
    const bodies = mockApi();
    renderDialog();

    await gotoFormAndCreate();

    await waitFor(() => expect(findBody(bodies, 'action=generate-article')).toBeTruthy());
    expect(toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('ยังไม่ได้กำหนดวันที่') }),
    );
  });
});
