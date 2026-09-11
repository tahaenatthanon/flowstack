import { describe, it, expect } from 'vitest';
import { parsePlatforms } from '@/lib/contentPlatforms';

/**
 * openspec/changes/platform-color-catalog — content_items.platform เดิมเก็บ
 * แพลตฟอร์มที่เลือกไว้เป็นสตริง comma-joined เดียว (เช่น
 * "facebook,linkedin,twitter,instagram,lineoa,wordpress,wix") ส่วน
 * content_items.platforms เป็น JSON array ของค่าเดียวกัน — เอาค่าดิบไป lookup
 * เป็นแพลตฟอร์มเดียวตรงๆ พังเมื่อมีมากกว่า 1 แพลตฟอร์ม parsePlatforms() ต้อง
 * parse ให้เป็น array แยกทีละแพลตฟอร์มเสมอ ไม่ตัดทอน
 *
 * เดิมอยู่ใน src/__tests__/content/PlatformBadgeList.test.tsx — ย้ายมาที่นี่
 * ตอน parsePlatforms() ย้ายไป src/lib/contentPlatforms.ts (ดู
 * openspec/changes/content-platforms-parser-refactor)
 */

describe('parsePlatforms', () => {
  it('parse comma-joined string (รูปแบบ content_items.platform เดิม)', () => {
    expect(parsePlatforms('facebook,linkedin,twitter')).toEqual(['facebook', 'linkedin', 'twitter']);
  });

  it('parse JSON array string (รูปแบบ content_items.platforms จาก API)', () => {
    expect(parsePlatforms('["facebook","instagram"]')).toEqual(['facebook', 'instagram']);
  });

  it('รับ array ตรงๆ ได้เลยไม่ต้อง parse ซ้ำ', () => {
    expect(parsePlatforms(['facebook', 'instagram'])).toEqual(['facebook', 'instagram']);
  });

  it('trim + lowercase + dedupe ค่าที่ซ้ำกัน', () => {
    expect(parsePlatforms(' Facebook , facebook ,INSTAGRAM')).toEqual(['facebook', 'instagram']);
  });

  it('คืน array ว่างเมื่อ null/undefined/สตริงว่าง', () => {
    expect(parsePlatforms(null)).toEqual([]);
    expect(parsePlatforms(undefined)).toEqual([]);
    expect(parsePlatforms('')).toEqual([]);
  });

  it('ครบทั้ง 7 แพลตฟอร์มไม่หายแม้จะเยอะ', () => {
    const all7 = 'facebook,linkedin,twitter,instagram,lineoa,wordpress,wix';
    expect(parsePlatforms(all7)).toHaveLength(7);
  });

  it('split element ที่เป็น comma-joined ซ้อนอยู่ใน array อีกชั้น (พบจริงใน DB: content item เก่าที่ platforms เป็น NULL แต่ platform เป็น "facebook,youtube" — API ห่อเป็น JSON array ที่มี element เดียวคือสตริงนั้นทั้งก้อน)', () => {
    expect(parsePlatforms(['facebook,youtube'])).toEqual(['facebook', 'youtube']);
  });
});
