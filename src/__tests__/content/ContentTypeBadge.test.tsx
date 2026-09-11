import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContentTypeBadge } from '@/components/content/ContentTypeBadge';

/**
 * openspec/changes/content-type-badge-display — badge/ไอคอนประเภทเนื้อหา
 * (บทความ/วีดีโอ) ที่แทนที่ไอคอนแพลตฟอร์มบน ContentPlannerCalendar chip และ
 * ContentItemList คอลัมน์ประเภท ดึงจาก TYPE_MAP/getCanonicalContentType()
 * เดียวกับที่ใช้อยู่แล้วในระบบ — ไม่มีสีที่ 3 สำหรับ 'image' เพราะ
 * getCanonicalContentType() ไม่รองรับ (บังคับเหลือแค่ article/video)
 */

describe('ContentTypeBadge — variant="pill"', () => {
  it('บทความ แสดง label "บทความ" สีฟ้า', () => {
    render(<ContentTypeBadge contentType="article" variant="pill" />);
    const el = screen.getByText('บทความ');
    expect(el.className).toMatch(/text-blue-500/);
    expect(el.querySelectorAll('svg')).toHaveLength(1);
  });

  it('วีดีโอ แสดง label "วีดีโอ" สีแดง', () => {
    render(<ContentTypeBadge contentType="video" variant="pill" />);
    const el = screen.getByText('วีดีโอ');
    expect(el.className).toMatch(/text-red-500/);
  });

  it('ค่าที่ไม่รู้จัก/ว่าง fallback เป็นบทความ (ตาม getCanonicalContentType)', () => {
    render(<ContentTypeBadge contentType={null} variant="pill" />);
    expect(screen.getByText('บทความ')).toBeInTheDocument();
  });

  it('ค่า "image" ก็ fallback เป็นบทความ (getCanonicalContentType ไม่รองรับ image)', () => {
    render(<ContentTypeBadge contentType="image" variant="pill" />);
    expect(screen.getByText('บทความ')).toBeInTheDocument();
  });
});

describe('ContentTypeBadge — variant="icon-only"', () => {
  it('แสดงไอคอนเดียว ไม่มี label ข้อความ', () => {
    const { container } = render(<ContentTypeBadge contentType="video" variant="icon-only" />);
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(screen.queryByText('วีดีโอ')).not.toBeInTheDocument();
  });

  it('สีไอคอนตรงกับประเภท (บทความ = ฟ้า)', () => {
    const { container } = render(<ContentTypeBadge contentType="article" variant="icon-only" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toMatch(/text-blue-500/);
  });
});
