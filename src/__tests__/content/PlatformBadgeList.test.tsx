import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformBadgeList } from '@/components/content/PlatformBadgeList';

/**
 * openspec/changes/platform-color-catalog — content_items.platform เดิมเก็บ
 * แพลตฟอร์มที่เลือกไว้เป็นสตริง comma-joined เดียว (เช่น
 * "facebook,linkedin,twitter,instagram,lineoa,wordpress,wix") ส่วน
 * content_items.platforms เป็น JSON array ของค่าเดียวกัน — เอาค่าดิบไป lookup
 * เป็นแพลตฟอร์มเดียวตรงๆ พังเมื่อมีมากกว่า 1 แพลตฟอร์ม PlatformBadgeList ต้อง
 * parse แล้วแสดงแยกทีละแพลตฟอร์มเสมอ ไม่ตัดทอน — ปัจจุบันเหลือผู้ใช้แค่
 * ContentCardDialog กับ ContentDetailView (ดู
 * openspec/changes/content-type-badge-display สำหรับเหตุผลที่
 * ContentPlannerCalendar/ContentItemList เปลี่ยนไปใช้ ContentTypeBadge แทน)
 *
 * Test ของ parsePlatforms() เองย้ายไป src/lib/__tests__/contentPlatforms.test.ts
 * แล้ว (ดู openspec/changes/content-platforms-parser-refactor) — ไฟล์นี้เหลือ
 * เฉพาะ test ของ component PlatformBadgeList
 */

describe('PlatformBadgeList — variant="pill"', () => {
  it('แสดง label แยกทีละแพลตฟอร์ม ไม่ใช่สตริงดิบก้อนเดียว', () => {
    render(<PlatformBadgeList platforms="facebook,linkedin,twitter" variant="pill" />);

    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('Twitter / X')).toBeInTheDocument();
    expect(screen.queryByText('facebook,linkedin,twitter')).not.toBeInTheDocument();
  });

  it('แสดงครบทั้ง 7 แพลตฟอร์มไม่ตัดทอนเป็น +N', () => {
    render(
      <PlatformBadgeList
        platforms="facebook,linkedin,twitter,instagram,lineoa,wordpress,wix"
        variant="pill"
      />
    );

    for (const label of ['Facebook', 'LinkedIn', 'Twitter / X', 'Instagram', 'Line OA', 'WordPress', 'Wix']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it('แพลตฟอร์มที่ไม่รู้จัก fallback เป็น key เดิม ไม่ใช่ค่าว่าง', () => {
    render(<PlatformBadgeList platforms="some-unknown-platform" variant="pill" />);

    expect(screen.getByText('some-unknown-platform')).toBeInTheDocument();
  });

  it('ไม่ render อะไรเลยเมื่อไม่มีแพลตฟอร์ม', () => {
    const { container } = render(<PlatformBadgeList platforms={null} variant="pill" />);
    expect(container).toBeEmptyDOMElement();
  });
});

// variant="icon-only" ถูกลบออกจาก PlatformBadgeList แล้ว (ดู
// openspec/changes/content-type-badge-display) — ไม่มีผู้เรียกใช้เหลืออยู่
// เพราะ ContentPlannerCalendar/ContentItemList เปลี่ยนไปแสดงประเภทเนื้อหาผ่าน
// ContentTypeBadge แทน ดู ContentTypeBadge.test.tsx สำหรับ coverage โหมด icon-only
