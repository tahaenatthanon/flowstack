import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PullFromContentDialog from '@/components/content/dialogs/PullFromContentDialog';

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('PullFromContentDialog', () => {
  it('renders dialog title and search input', () => {
    wrap(<PullFromContentDialog open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('ดึงจาก Content')).toBeTruthy();
    expect(screen.getByPlaceholderText('ค้นหาบทความ...')).toBeTruthy();
  });
});
