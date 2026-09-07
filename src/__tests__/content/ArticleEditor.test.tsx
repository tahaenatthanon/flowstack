import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ArticleEditor from '@/components/content/ArticleEditor';
import { emptySeoFields } from '@/components/content/types';
import { apiFetch } from '@/lib/api';

// Mock apiFetch for AI tests
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// BubbleMenu requires a DOM selection model — mock it out to avoid tippy errors
vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="bubble-menu">{children}</div>,
}));

const defaultProps = {
  html: '<p>Hello world</p>',
  onChange: vi.fn(),
  seoFields: emptySeoFields(),
  onSeoChange: vi.fn(),
};

/**
 * SEO และ AEO เป็นสอง endpoint แยกกัน และแผงตรวจก็แยกกัน — mock ต้องแยก payload
 * ด้วย ไม่ใช่ตอบก้อนเดียวกันให้ทุก URL มิฉะนั้นกฎเดียวจะถูก render ซ้ำสองแผง
 */
function mockChecklists(seoRules: any[], seoOverrides: Record<string, any> = {}) {
  vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
    const u = String(url);
    if (u.includes('action=seo-checklist')) {
      return {
        score: 100,
        gate: 'passed',
        rules: seoRules,
        seo_gate_enabled: 1,
        seo_gate_min_score: 0,
        ...seoOverrides,
      } as any;
    }
    if (u.includes('action=aeo-checklist')) {
      return { score: 100, gate: 'passed', rules: [] } as any;
    }
    throw new Error('unexpected ' + u);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ArticleEditor', () => {
  it('renders editor with initial content', async () => {
    render(<ArticleEditor {...defaultProps} />);
    // Tiptap renders content asynchronously
    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeTruthy();
    });
  });

  it('shows toolbar buttons', async () => {
    render(<ArticleEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTitle('Bold')).toBeTruthy();
      expect(screen.getByTitle('Italic')).toBeTruthy();
      expect(screen.getByTitle('H1')).toBeTruthy();
      expect(screen.getByTitle('HTML Source')).toBeTruthy();
    });
  });

  it('toggles to HTML source mode', async () => {
    render(<ArticleEditor {...defaultProps} />);
    await waitFor(() => screen.getByTitle('HTML Source'));
    fireEvent.click(screen.getByTitle('HTML Source'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('<p>HTML ของบทความ...</p>')).toBeTruthy();
    });
  });

  it('renders AI generate panel with button', async () => {
    render(<ArticleEditor {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('สร้างเนื้อหา')).toBeTruthy();
    });
  });

  it('AI generate button is disabled when prompt is empty', async () => {
    render(<ArticleEditor {...defaultProps} />);
    await waitFor(() => screen.getByText('สร้างเนื้อหา'));
    const btn = screen.getByText('สร้างเนื้อหา').closest('button');
    expect(btn).toHaveProperty('disabled', true);
  });

  it('toggles SEO panel open', async () => {
    render(<ArticleEditor {...defaultProps} />);
    await waitFor(() => screen.getByText('SEO / AEO Metadata'));
    fireEvent.click(screen.getByText('SEO / AEO Metadata'));
    await waitFor(() => {
      // SEO title input should appear
      expect(screen.getByPlaceholderText(/หัวข้อ SEO/)).toBeTruthy();
    });
  });

  it('calls onSeoChange when SEO title is updated', async () => {
    const onSeoChange = vi.fn();
    render(<ArticleEditor {...defaultProps} onSeoChange={onSeoChange} />);
    await waitFor(() => screen.getByText('SEO / AEO Metadata'));
    fireEvent.click(screen.getByText('SEO / AEO Metadata'));
    await waitFor(() => screen.getByPlaceholderText(/หัวข้อ SEO/));
    fireEvent.change(screen.getByPlaceholderText(/หัวข้อ SEO/), { target: { value: 'My SEO Title' } });
    expect(onSeoChange).toHaveBeenCalledWith(expect.objectContaining({ seo_title: 'My SEO Title' }));
  });

  it('shows char counter warning when SEO title exceeds 60 chars', async () => {
    const longTitle = 'A'.repeat(65);
    render(<ArticleEditor {...defaultProps} seoFields={{ ...emptySeoFields(), seo_title: longTitle }} />);
    await waitFor(() => screen.getByText('SEO / AEO Metadata'));
    fireEvent.click(screen.getByText('SEO / AEO Metadata'));
    await waitFor(() => {
      expect(screen.getByText('65/60')).toBeTruthy();
    });
  });

  it('renders pending SEO rules without crashing the page', async () => {
    mockChecklists([{ key: 'seo_title', level: 'pending', message: 'ยังไม่ได้กรอก SEO title' }]);
    render(<ArticleEditor {...defaultProps} contentItemId="item-1" />);
    fireEvent.click(await screen.findByText('SEO / AEO Metadata'));
    await waitFor(() => {
      expect(screen.getByText('ยังไม่ได้กรอก SEO title')).toBeTruthy();
    });
  });

  it('uses a safe fallback for an unknown SEO rule level', async () => {
    mockChecklists(
      [{ key: 'future_rule', level: 'future_level', message: 'กฎใหม่จากระบบ' }],
      { seo_gate_enabled: 0 },
    );
    render(<ArticleEditor {...defaultProps} contentItemId="item-2" />);
    fireEvent.click(await screen.findByText('SEO / AEO Metadata'));
    await waitFor(() => {
      expect(screen.getByText('กฎใหม่จากระบบ')).toBeTruthy();
    });
  });
});
