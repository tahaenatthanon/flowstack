import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SendToCampaignDialog from '@/components/content/dialogs/SendToCampaignDialog';
import type { ContentItem } from '@/components/content/types';

const mockItem: ContentItem = {
  id: 'ci-1', title: 'Test', type: 'article', status: 'draft',
  views: 0, likes: 0, created_at: '2026-01-01',
  platform: 'facebook', plan_item_id: null,
};

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('SendToCampaignDialog', () => {
  it('renders dialog with new/existing modes', () => {
    wrap(<SendToCampaignDialog open={true} onOpenChange={vi.fn()} contentItem={mockItem} />);
    expect(screen.getByText('สร้างแคมเปญใหม่')).toBeTruthy();
    expect(screen.getByText('เพิ่มในแคมเปญที่มีอยู่')).toBeTruthy();
  });

  it('renders submit button', () => {
    wrap(<SendToCampaignDialog open={true} onOpenChange={vi.fn()} contentItem={mockItem} />);
    expect(screen.getByText('ส่งเข้า Campaign')).toBeTruthy();
  });
});
