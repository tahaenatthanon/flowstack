import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Change: restrict-content-approval-tab
 * spec: content-approval-access — "หน้าผู้ดูแลระบบ SHALL แสดง 'อนุมัติคอนเทนต์' (content_approval)
 * ในรายการสิทธิ์ของ role ให้เลือกเปิด/ปิดได้"
 *
 * AdminPage.tsx มี dependency หนัก (query/dialog จำนวนมาก) การ render ทั้งหน้าจึงเปราะ —
 * ตรวจแบบ source-level ตามที่ tasks.md อนุญาตไว้ ("Vitest AdminPage หรือเช็ค ALL_MENUS")
 */
const source = readFileSync(resolve(__dirname, '../../pages/AdminPage.tsx'), 'utf-8');

describe('AdminPage — ALL_MENUS มีสิทธิ์ content_approval', () => {
  it('มี key content_approval พร้อม label ภาษาไทย', () => {
    const allMenusBlock = source.slice(source.indexOf('const ALL_MENUS'), source.indexOf('];', source.indexOf('const ALL_MENUS')));
    expect(allMenusBlock).toMatch(/key:\s*'content_approval'/);
    expect(allMenusBlock).toMatch(/label:\s*'อนุมัติคอนเทนต์'/);
  });
});
