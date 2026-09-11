import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentListTab from '@/components/content/tabs/ContentListTab';
import type { ContentItem } from '@/components/content/types';

/**
 * openspec/changes/content-platforms-parser-refactor — characterization test
 * สำหรับ getItemPlatforms() ใน ContentListTab.tsx ที่ก่อนหน้านี้ไม่เคยมี test
 * คลุมเลยแม้แต่ตัวเดียว (platform chip counts, การกรองด้วยแพลตฟอร์ม, ไอคอน
 * แพลตฟอร์มต่อ item) เพิ่มไว้ล็อกพฤติกรรมเดิมก่อน/หลัง refactor
 * getItemPlatforms() ให้ delegate ไป parsePlatforms() ใน @/lib/contentPlatforms
 */

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));
vi.mock('@/components/content/SchedulePublishDialog', () => ({ SchedulePublishDialog: () => null }));
vi.mock('@/components/content/ContentCardDialog', () => ({ ContentCardDialog: () => null }));

const mockItems = vi.hoisted(() => ({ value: [] as ContentItem[] }));
vi.mock('@/hooks/useContent', () => ({
  useContentItems: () => ({ data: mockItems.value, isLoading: false }),
}));

function makeItem(overrides: Partial<ContentItem>): ContentItem {
  return {
    id: 'a1',
    title: 'Test Content',
    type: 'article',
    status: 'draft',
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
      <ContentListTab />
    </QueryClientProvider>,
  );
}

/** แถวของ item หนึ่งรายการในลิสต์ — สโคป query ให้อยู่ในแถวนั้น ไม่ปนกับแถวอื่น */
function getItemRow(title: string): HTMLElement {
  const titleEl = screen.getByText(title);
  return titleEl.closest('.cursor-pointer') as HTMLElement;
}

/** toolbar filter แพลตฟอร์ม (chip ทั้งหมด+ต่อแพลตฟอร์ม) — แยกสโคปจากไอคอนแพลตฟอร์ม
 *  ที่ซ้ำ title กันในแถวของแต่ละ item */
function getPlatformToolbar(): HTMLElement {
  return screen.getByText('แพลตฟอร์ม:').closest('div') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockItems.value = [];
});

describe('ContentListTab — platform chip counts นับแยกทีละแพลตฟอร์ม', () => {
  it('item ที่มีหลายแพลตฟอร์ม ถูกนับแยกเข้าแต่ละ chip ไม่ใช่นับเป็นก้อนเดียว', async () => {
    mockItems.value = [
      makeItem({ id: 'a', title: 'มีหลายแพลตฟอร์ม', platform: 'facebook,linkedin', platforms: ['facebook', 'linkedin'] }),
      makeItem({ id: 'b', title: 'facebook อย่างเดียว', platform: 'facebook', platforms: null }),
    ];
    renderTab();
    await screen.findByText('มีหลายแพลตฟอร์ม');

    const toolbar = getPlatformToolbar();
    expect(within(toolbar).getByTitle('Facebook')).toHaveTextContent('2');
    expect(within(toolbar).getByTitle('LinkedIn')).toHaveTextContent('1');
  });
});

describe('ContentListTab — กรองด้วยแพลตฟอร์มเจอ item ที่มีหลายแพลตฟอร์ม', () => {
  it('เลือก chip LinkedIn เจอ item ที่มี facebook+linkedin แต่ไม่เจอ item ที่มีแค่ twitter', async () => {
    mockItems.value = [
      makeItem({ id: 'a', title: 'มีหลายแพลตฟอร์ม', platform: 'facebook,linkedin', platforms: ['facebook', 'linkedin'] }),
      makeItem({ id: 'b', title: 'ทวิตเตอร์อย่างเดียว', platform: 'twitter', platforms: null }),
    ];
    renderTab();
    await screen.findByText('มีหลายแพลตฟอร์ม');

    fireEvent.click(within(getPlatformToolbar()).getByTitle('LinkedIn'));

    expect(screen.getByText('มีหลายแพลตฟอร์ม')).toBeInTheDocument();
    expect(screen.queryByText('ทวิตเตอร์อย่างเดียว')).not.toBeInTheDocument();
  });
});

describe('ContentListTab — ไอคอนแพลตฟอร์มต่อ item แสดงครบไม่ตัดทอน', () => {
  it('item ที่มี 3 แพลตฟอร์ม แสดงไอคอนครบทั้ง 3 ในแถวของตัวเอง', async () => {
    mockItems.value = [
      makeItem({ id: 'c', title: 'สามแพลตฟอร์ม', platform: 'facebook,linkedin,twitter', platforms: ['facebook', 'linkedin', 'twitter'] }),
    ];
    renderTab();
    await screen.findByText('สามแพลตฟอร์ม');

    const row = getItemRow('สามแพลตฟอร์ม');
    expect(within(row).getByTitle('Facebook')).toBeInTheDocument();
    expect(within(row).getByTitle('LinkedIn')).toBeInTheDocument();
    expect(within(row).getByTitle('Twitter / X')).toBeInTheDocument();
  });
});
