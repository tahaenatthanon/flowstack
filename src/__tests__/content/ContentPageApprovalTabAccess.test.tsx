import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContentPage from '@/pages/ContentPage';

/**
 * Change: restrict-content-approval-tab
 * spec: content-approval-access — "แท็บรายการอนุมัติแสดงเฉพาะผู้มีสิทธิ์"
 */

// content_approval ใช้ hasRolePermission (ไม่ bypass ด้วย is_admin/is_superadmin — D1.5)
// hasPermission เดิมยัง mock ไว้เผื่อโค้ดอื่นในหน้านี้เรียกใช้ แต่ไม่เกี่ยวกับแท็บอนุมัติแล้ว
let mockHasRolePermission = (_key: string) => true;
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true, hasRolePermission: (k: string) => mockHasRolePermission(k) }),
}));
vi.mock('@/hooks/useContent', () => ({ useOverdueCount: () => ({ data: { count: 0 } }) }));
vi.mock('@/components/content/tabs/ContentListTab', () => ({ default: () => <div>เนื้อหาแท็บผลงาน</div> }));
vi.mock('@/components/content/tabs/ContentApprovalTab', () => ({ default: () => <div>เนื้อหาแท็บอนุมัติ</div> }));
vi.mock('@/components/content/tabs/SkillsTriggerTab', () => ({ default: () => null }));
vi.mock('@/components/content/tabs/AISettingsTab', () => ({ default: () => null }));
vi.mock('@/components/content/tabs/ScheduleOverviewPanel', () => ({ default: () => null }));
vi.mock('@/components/content/dialogs/BatchGenerateDialog', () => ({ BatchGenerateDialog: () => null }));
vi.mock('@/components/content/dialogs/QuickCreateDialog', () => ({ default: () => null }));

function renderPage(initialEntry = '/content') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ContentPage />
    </MemoryRouter>,
  );
}

describe('ContentPage — สิทธิ์เห็นแท็บ "รายการอนุมัติ" (content_approval)', () => {
  it('ไม่มีสิทธิ์ → ไม่มีปุ่มแท็บและไม่ render เนื้อหาแท็บอนุมัติ', () => {
    mockHasRolePermission = () => false;
    renderPage();
    expect(screen.queryByText('รายการอนุมัติ')).toBeNull();
    expect(screen.queryByText('เนื้อหาแท็บอนุมัติ')).toBeNull();
    expect(screen.getByText('เนื้อหาแท็บผลงาน')).toBeTruthy();
  });

  it('ไม่มีสิทธิ์ + เปิด ?tab=approval ตรงๆ → เปิดแท็บผลงานทั้งหมดแทน', () => {
    mockHasRolePermission = () => false;
    renderPage('/content?tab=approval');
    expect(screen.getByText('เนื้อหาแท็บผลงาน')).toBeTruthy();
    expect(screen.queryByText('เนื้อหาแท็บอนุมัติ')).toBeNull();
  });

  it('มีสิทธิ์ → เห็นแท็บและเปิด ?tab=approval ได้', () => {
    mockHasRolePermission = () => true;
    renderPage('/content?tab=approval');
    expect(screen.getByText('รายการอนุมัติ')).toBeTruthy();
    expect(screen.getByText('เนื้อหาแท็บอนุมัติ')).toBeTruthy();
  });
});
