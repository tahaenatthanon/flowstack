import { getPlatformLabel } from '@/lib/platformConfig';

/**
 * ค่าคงที่และตัวจัดรูปแบบของแท็บภาพรวม (spec content-overview-bi)
 * หลัก: ค่า null = "ไม่มีข้อมูล" → แสดง "—" เสมอ ห้ามแสดง 0 แทน
 * (แยกจาก shared.tsx ที่เป็น component เพื่อให้ fast refresh ทำงาน)
 */

/**
 * ลำดับสถานะคอนเทนต์ของกล่อง "สถานะคอนเทนต์" ในส่วนการผลิต
 */
export const CONTENT_STATUS_ORDER = ['published', 'approved', 'pending_approval', 'revision', 'draft', 'rejected'] as const;

export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('th-TH', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtPct(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${n.toLocaleString('th-TH', { maximumFractionDigits: 1 })}%`;
}

export function platformsLabel(platforms: string[]): string {
  return platforms.length ? platforms.map(p => getPlatformLabel(p)).join(', ') : '—';
}
