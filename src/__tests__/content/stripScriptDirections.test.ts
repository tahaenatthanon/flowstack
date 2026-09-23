import { describe, it, expect } from 'vitest';
import { stripScriptDirections, getPublishDefaultText, socialPostPlatforms } from '@/components/content/types';
import fixtures from '../../../api/tests/fixtures/post-text-directions.json';

/**
 * Change: platform-post-text
 * ตัดคำกำกับต้นบรรทัดให้ทุก platform — fixture ชุดเดียวกับ api/tests/platform-post-text-test.php
 * (publish_strip_directions ฝั่ง PHP) เพื่อให้หน้าจอกับ backend ตัดเหมือนกันทุกตัวอักษร
 */

describe('stripScriptDirections — fixture ร่วมกับ PHP', () => {
  for (const f of fixtures as Array<{ name: string; input: string; expected: string }>) {
    it(f.name, () => {
      expect(stripScriptDirections(f.input)).toBe(f.expected);
    });
  }
});

describe('getPublishDefaultText', () => {
  const scripts = { facebook: 'Post caption: A', tiktok: 'Hook 3 วิ: B' };

  it('ใช้ข้อความของ platform นั้น (ตัดคำกำกับ) — 2 platform ได้ข้อความต่างกัน', () => {
    expect(getPublishDefaultText(scripts, 'facebook', 'cap')).toEqual({ text: 'A', source: 'script' });
    expect(getPublishDefaultText(scripts, 'tiktok', 'cap')).toEqual({ text: 'B', source: 'script' });
  });

  it('ไม่มี scripts / ไม่มี key ของ platform → ข้อความโพสต์สำรอง (caption)', () => {
    expect(getPublishDefaultText(undefined, 'facebook', 'caption เดิม')).toEqual({ text: 'caption เดิม', source: 'caption' });
    expect(getPublishDefaultText(scripts, 'linkedin', 'caption เดิม')).toEqual({ text: 'caption เดิม', source: 'caption' });
  });

  it('script มีแต่คำกำกับ และไม่มี caption → เนื้อหาบทความ', () => {
    expect(getPublishDefaultText({ facebook: 'Post caption:' }, 'facebook', '  ')).toEqual({ text: '', source: 'article' });
  });
});

describe('socialPostPlatforms', () => {
  it('เฉพาะ platform โซเชียลที่เลือก เรียงตามลำดับแท็บ ไม่มีเว็บ/CMS', () => {
    expect(socialPostPlatforms(['wix', 'Twitter', 'facebook', 'wordpress', 'lineoa', 'youtube', 'lotusdomino']))
      .toEqual(['facebook', 'youtube', 'lineoa', 'twitter']);
  });
});
