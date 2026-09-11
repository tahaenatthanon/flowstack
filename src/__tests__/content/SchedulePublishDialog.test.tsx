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

function renderDialog() {
  return render(
    <SchedulePublishDialog
      open
      onOpenChange={() => {}}
      contentId="content-1"
      contentTitle="ทดสอบ"
      mode="send_now"
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
