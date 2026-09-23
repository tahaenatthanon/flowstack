import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SchedulePublishDialog } from '@/components/content/SchedulePublishDialog';
import { apiFetch } from '@/lib/api';

/**
 * Change: content-quality-recheck-action
 *
 * send_now คืนสถานะรายช่องทางได้ 4 แบบ (success/skipped/blocked/failed) แต่ dialog เคยรู้จัก
 * แค่ 3 แบบ — ผลจาก `blocked` (เช่น Quality gate ยังไม่ผ่าน) เคยหล่นไปโชว์ toast ทั่วไปที่ไม่มี
 * ประโยชน์ "ไม่มีช่องทางที่ถูกส่ง" เทสต์นี้ยืนยันว่า `blocked` ถูกจับแยกและแสดงเหตุผลจริงแล้ว
 */

const toast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

const mockSendNowMutateAsync = vi.fn();
vi.mock('@/hooks/useContent', () => ({
  usePublishChannels: () => ({ data: mockChannels.value }),
  useScheduleContent: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendNow: () => ({ mutateAsync: mockSendNowMutateAsync, isPending: false }),
}));

const mockChannels = {
  value: [] as Array<{ id: string; platform: string; name: string; is_active: number }>,
};

function renderDialog(extra: Partial<ComponentProps<typeof SchedulePublishDialog>> = {}) {
  return render(
    <SchedulePublishDialog
      open
      onOpenChange={() => {}}
      contentId="content-1"
      contentTitle="ทดสอบ"
      mode="send_now"
      {...extra}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiFetch).mockResolvedValue({ platforms: {} });
});

describe('SchedulePublishDialog — สถานะ blocked จาก send_now', () => {
  it('ถูกบล็อกช่องทางเดียว → แสดงเหตุผลจริงจาก backend ไม่ใช่ข้อความทั่วไป', async () => {
    mockChannels.value = [{ id: 'ch-fb', platform: 'facebook', name: 'Facebook เพจหลัก', is_active: 1 }];
    mockSendNowMutateAsync.mockResolvedValue({
      results: [{
        channel_id: 'ch-fb',
        platform: 'facebook',
        success: false,
        status: 'blocked',
        reason: 'Quality gate: Content นี้ยังไม่มีผล Quality ของเวอร์ชันปัจจุบัน กรุณาตรวจ Quality ใหม่ก่อนเผยแพร่/ตั้งเวลา',
      }],
    });

    renderDialog();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /ส่งเลย/ }));

    await waitFor(() => expect(mockSendNowMutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'ถูกบล็อกก่อนเผยแพร่',
      description: expect.stringContaining('Quality gate'),
      variant: 'destructive',
    })));
    // ต้องไม่ตกไปที่ข้อความทั่วไปเดิม
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'ไม่มีช่องทางที่ถูกส่ง' }));
  });

  it('ผลผสม สำเร็จ 1 + ถูกบล็อก 1 → แสดงจำนวนแยกกัน ไม่รวมเข้ากับ failed', async () => {
    mockChannels.value = [
      { id: 'ch-fb', platform: 'facebook', name: 'Facebook เพจหลัก', is_active: 1 },
      { id: 'ch-wp', platform: 'wordpress', name: 'เว็บไซต์บริษัท', is_active: 1 },
    ];
    mockSendNowMutateAsync.mockResolvedValue({
      results: [
        { channel_id: 'ch-fb', platform: 'facebook', success: true, status: 'success' },
        { channel_id: 'ch-wp', platform: 'wordpress', success: false, status: 'blocked', reason: 'Article SEO gate: ยังไม่ผ่านเกณฑ์ SEO' },
      ],
    });

    renderDialog();
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /ส่งเลย/ }));

    await waitFor(() => expect(mockSendNowMutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'ส่งบางส่วนไม่สำเร็จ',
      description: expect.stringContaining('ถูกบล็อก 1'),
      variant: 'destructive',
    })));
    const call = toast.mock.calls.find(([arg]) => arg.title === 'ส่งบางส่วนไม่สำเร็จ')?.[0];
    expect(call.description).toContain('สำเร็จ 1');
    expect(call.description).not.toContain('ล้มเหลว');
  });
});


/**
 * Change: platform-post-text (แทน wire-platform-scripts-to-publish)
 * spec: platform-script-publish-prefill — หน้าต่างเผยแพร่แสดงข้อความอย่างเดียว ไม่ส่ง channel_overrides
 */
describe('SchedulePublishDialog — ตัวอย่างข้อความโพสต์แบบอ่านอย่างเดียว', () => {
  it('2 platform ที่มีข้อความต่างกัน → ตัวอย่างต่างกัน ตัดคำกำกับทั้งคู่ (รวม facebook) และมีหัวข้อบรรทัดแรก', async () => {
    mockChannels.value = [
      { id: 'ch-fb', platform: 'facebook', name: 'Facebook เพจหลัก', is_active: 1 },
      { id: 'ch-tt', platform: 'tiktok', name: 'TikTok หลัก', is_active: 1 },
    ];
    renderDialog({ scripts: { facebook: 'Post caption: A\nCTA: ทักแชท', tiktok: 'Hook 3 วิ: B' } });
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const fb = screen.getByTestId('publish-preview-facebook');
    const tt = screen.getByTestId('publish-preview-tiktok');
    expect(fb.textContent).toContain('ทดสอบ'); // หัวข้อ (contentTitle)
    expect(fb.textContent).toContain('A\nทักแชท');
    expect(fb.textContent).not.toContain('Post caption:');
    expect(fb.textContent).not.toContain('CTA:');
    expect(tt.textContent).toContain('B');
    expect(tt.textContent).not.toContain('Hook 3 วิ:');
    expect(fb.textContent).toContain('ข้อความโพสต์(Facebook)');
  });

  it('ไม่มีช่องให้แก้ข้อความ และคำขอ send_now ไม่มี channel_overrides', async () => {
    mockChannels.value = [
      { id: 'ch-fb', platform: 'facebook', name: 'Facebook เพจหลัก', is_active: 1 },
      { id: 'ch-wp', platform: 'wordpress', name: 'เว็บไซต์บริษัท', is_active: 1 },
    ];
    mockSendNowMutateAsync.mockResolvedValue({ results: [{ channel_id: 'ch-fb', platform: 'facebook', success: true, status: 'success' }] });
    renderDialog({ scripts: { facebook: 'ข้อความ' } });
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByTestId('publish-preview-web').textContent).toContain('จะโพสต์เนื้อหาบทความของคอนเทนต์นี้');
    expect(screen.getByText(/แก้ที่ "ข้อความโพสต์แต่ละ Platform"/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /ส่งเลย/ }));
    await waitFor(() => expect(mockSendNowMutateAsync).toHaveBeenCalled());
    expect(mockSendNowMutateAsync.mock.calls[0][0]).toEqual({ content_id: 'content-1', channel_ids: ['ch-fb', 'ch-wp'] });
  });

  it('ไม่มีข้อความของ platform ที่เลือก → แสดงข้อความโพสต์สำรองพร้อมป้ายแหล่งที่มา', async () => {
    mockChannels.value = [{ id: 'ch-li', platform: 'linkedin', name: 'LinkedIn หลัก', is_active: 1 }];
    renderDialog({ defaultCaption: 'caption เดิม', scripts: { facebook: 'A' } });
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    const li = screen.getByTestId('publish-preview-linkedin');
    expect(li.textContent).toContain('caption เดิม');
    expect(li.textContent).toContain('จากข้อความโพสต์สำรอง');
  });
});
