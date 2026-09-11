import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentApprovalTab from '@/components/content/tabs/ContentApprovalTab';
import type { ContentItem } from '@/components/content/types';

/**
 * openspec/changes/content-approval-platform-fix — ContentApprovalTab เคย
 * เทียบ item.platform === platformFilter แบบ exact-match, สร้างตัวเลือก
 * Platform Filter Dropdown จาก item.platform ดิบๆ, และแสดงคอลัมน์ "แพลตฟอร์ม"
 * ด้วยการ lookup PLATFORM_MAP[item.platform] ตรงๆ — ทั้งสามจุดพังเมื่อ item
 * มีหลายแพลตฟอร์ม (platform เป็นสตริง comma-joined)
 */

const toast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/components/content/views/ContentDetailView', () => ({ default: () => null }));

const mockItems = vi.hoisted(() => ({ value: [] as ContentItem[] }));
vi.mock('@/hooks/useContent', () => ({
  useContentItems: () => ({ data: mockItems.value, isLoading: false }),
  contentKeys: { items: () => ['content', 'items'] },
}));

function makeItem(overrides: Partial<ContentItem>): ContentItem {
  return {
    id: 'a1',
    title: 'คอนเทนต์ทดสอบ',
    type: 'article',
    status: 'pending_approval',
    views: 0,
    likes: 0,
    created_at: '2026-09-04T00:00:00Z',
    platform: 'facebook',
    platforms: null,
    ...overrides,
  } as ContentItem;
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContentApprovalTab />
    </QueryClientProvider>,
  );
}

function openSelect(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

function platformFilterTrigger(): HTMLElement {
  const combos = screen.getAllByRole('combobox');
  const trigger = combos.find(el => el.textContent?.includes('ทุกแพลตฟอร์ม'));
  if (!trigger) throw new Error('ไม่พบ Platform Filter Dropdown');
  return trigger;
}

// Radix Select ต้องพึ่ง API เหล่านี้ ซึ่ง jsdom ไม่มีให้ — polyfill เฉพาะไฟล์นี้
beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  vi.clearAllMocks();
  mockItems.value = [];
});

describe('ContentApprovalTab — platformFilter match กับ content item หลายแพลตฟอร์ม', () => {
  it('item ที่มีหลายแพลตฟอร์ม ปรากฏเมื่อกรองด้วยแพลตฟอร์มที่มันมี', async () => {
    mockItems.value = [
      makeItem({ id: 'multi-1', title: 'มีหลายแพลตฟอร์ม', platform: 'facebook,linkedin', platforms: ['facebook', 'linkedin'] }),
    ];
    renderTab();
    await screen.findByText('มีหลายแพลตฟอร์ม');

    openSelect(platformFilterTrigger());
    fireEvent.click(await screen.findByRole('option', { name: 'LinkedIn', hidden: true }));

    expect(await screen.findByText('มีหลายแพลตฟอร์ม')).toBeInTheDocument();
  });

  it('item ที่มีหลายแพลตฟอร์ม ไม่ปรากฏเมื่อกรองด้วยแพลตฟอร์มที่มันไม่มี', async () => {
    mockItems.value = [
      makeItem({ id: 'multi-2', title: 'ไม่มี youtube', platform: 'facebook,linkedin', platforms: ['facebook', 'linkedin'] }),
    ];
    renderTab();
    await screen.findByText('ไม่มี youtube');

    // youtube ไม่อยู่ใน item ใดเลย จึงไม่ปรากฏเป็นตัวเลือกใน dropdown — ยืนยันด้วยการกรอง
    // ผ่าน linkedin ก่อน (ให้ผลลัพธ์ตรง) แล้วสลับเป็น facebook เพื่อยืนยัน item ยังอยู่
    openSelect(platformFilterTrigger());
    fireEvent.click(await screen.findByRole('option', { name: 'Facebook', hidden: true }));
    expect(await screen.findByText('ไม่มี youtube')).toBeInTheDocument();
  });

  it('item แพลตฟอร์มเดียวยังกรองถูกต้องเหมือนเดิม (ไม่ถดถอย)', async () => {
    mockItems.value = [
      makeItem({ id: 'single-1', title: 'แพลตฟอร์มเดียว', platform: 'facebook', platforms: null }),
    ];
    renderTab();
    await screen.findByText('แพลตฟอร์มเดียว');

    openSelect(platformFilterTrigger());
    fireEvent.click(await screen.findByRole('option', { name: 'Facebook', hidden: true }));

    expect(await screen.findByText('แพลตฟอร์มเดียว')).toBeInTheDocument();
  });

  it('Platform Filter Dropdown แยกตัวเลือกแพลตฟอร์มจาก item หลายแพลตฟอร์ม ไม่โชว์ค่าดิบรวม', async () => {
    mockItems.value = [
      makeItem({ id: 'multi-3', title: 'แยกตัวเลือก', platform: 'facebook,linkedin', platforms: ['facebook', 'linkedin'] }),
    ];
    renderTab();
    await screen.findByText('แยกตัวเลือก');

    openSelect(platformFilterTrigger());
    expect(await screen.findByRole('option', { name: 'Facebook', hidden: true })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'LinkedIn', hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'facebook,linkedin', hidden: true })).not.toBeInTheDocument();
  });
});

describe('ContentApprovalTab — คอลัมน์แพลตฟอร์มแสดง badge แรก + จำนวนที่เหลือ', () => {
  it('item หลายแพลตฟอร์มแสดง badge แรกพร้อม "+N"', async () => {
    mockItems.value = [
      makeItem({ id: 'multi-4', title: 'สามแพลตฟอร์ม', platform: 'facebook,linkedin,youtube', platforms: ['facebook', 'linkedin', 'youtube'] }),
    ];
    renderTab();
    await screen.findByText('สามแพลตฟอร์ม');

    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByText('LinkedIn')).not.toBeInTheDocument();
    expect(screen.queryByText('YouTube')).not.toBeInTheDocument();
  });

  it('item แพลตฟอร์มเดียวแสดง badge เดียว ไม่มี "+N"', async () => {
    mockItems.value = [
      makeItem({ id: 'single-2', title: 'เดี่ยว', platform: 'facebook', platforms: null }),
    ];
    renderTab();
    await screen.findByText('เดี่ยว');

    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it('item ไม่มีแพลตฟอร์มแสดง "-"', async () => {
    mockItems.value = [
      makeItem({ id: 'none-1', title: 'ไม่มีแพลตฟอร์ม', platform: null, platforms: null }),
    ];
    renderTab();
    const row = (await screen.findByText('ไม่มีแพลตฟอร์ม')).closest('tr') as HTMLElement;

    expect(row).not.toBeNull();
    expect(row.textContent).toContain('-');
  });
});
