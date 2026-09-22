import { describe, it, expect } from 'vitest';
import { stripScriptDirections, getPublishDefaultText } from '@/components/content/types';

/**
 * Change: wire-platform-scripts-to-publish
 *
 * spec: platform-script-publish-prefill
 *   - "คำกำกับฉากถูกตัดออกก่อนใช้เป็นข้อความเผยแพร่"
 *   - "Fallback ไปใช้แคปชั่นเมื่อไม่มี script ของ platform นั้น"
 */

describe('stripScriptDirections', () => {
  it('ตัดคำกำกับฉากของ tiktok ออกจากต้นบรรทัด เก็บเนื้อความไว้ครบ', () => {
    const text = 'Hook 3 วิ: เฮ้ยรู้ไหม\nScene 1: แสดงสินค้า\nCTA: กดติดตาม';
    const result = stripScriptDirections(text, 'tiktok');
    expect(result).not.toContain('Hook 3 วิ:');
    expect(result).not.toContain('Scene 1:');
    expect(result).not.toContain('CTA:');
    expect(result).toContain('เฮ้ยรู้ไหม');
    expect(result).toContain('แสดงสินค้า');
    expect(result).toContain('กดติดตาม');
  });

  it('ตัดคำกำกับฉากของ youtube ออกจากต้นบรรทัด', () => {
    const text = 'Intro: สวัสดีครับ\nSection 1: เนื้อหาหลัก\nOutro: ขอบคุณที่รับชม';
    const result = stripScriptDirections(text, 'youtube');
    expect(result).not.toContain('Intro:');
    expect(result).not.toContain('Section 1:');
    expect(result).not.toContain('Outro:');
    expect(result).toContain('สวัสดีครับ');
  });

  it('platform อื่นไม่ต้องตัดคำกำกับฉาก คืนค่าเดิมทุกตัวอักษร', () => {
    const text = 'Post caption: สนใจไหม\nCTA: ทักแชท';
    expect(stripScriptDirections(text, 'facebook')).toBe(text);
  });
});

describe('getPublishDefaultText', () => {
  it('เลือก 2 platform ที่มี script ต่างกัน — ได้ข้อความไม่เหมือนกัน', () => {
    const scripts = { facebook: 'Post caption: A', tiktok: 'Hook 3 วิ: B' };
    const fb = getPublishDefaultText(scripts, 'facebook', 'caption เดิม');
    const tt = getPublishDefaultText(scripts, 'tiktok', 'caption เดิม');
    expect(fb).toBe('Post caption: A');
    expect(tt).toBe('B');
    expect(fb).not.toBe(tt);
  });

  it('content เก่าไม่มี scripts field เลย — fallback เป็น caption', () => {
    expect(getPublishDefaultText(undefined, 'facebook', 'caption เดิม')).toBe('caption เดิม');
  });

  it('มี scripts แต่ไม่มี key ของ platform ที่เลือก — fallback เป็น caption ไม่ใช่ว่างเปล่า', () => {
    const scripts = { facebook: 'Post caption: A' };
    expect(getPublishDefaultText(scripts, 'linkedin', 'caption เดิม')).toBe('caption เดิม');
  });
});
