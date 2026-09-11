import { cn } from '@/lib/utils';
import { PlatformIcon } from './PlatformIcon';
import { getPlatformColorClass, getPlatformLabel } from '@/lib/platformConfig';

/**
 * Parse ค่า platforms ของ content item ให้เป็น array เดี่ยว lowercase ไม่ซ้ำ
 * ไม่มีค่าว่าง — รองรับทั้งรูปแบบ array ที่ parse แล้ว, JSON string
 * (`content_items.platforms`), และ comma-joined string เดิม
 * (`content_items.platform` เช่น "facebook,linkedin,twitter") ตรรกะเดียวกับที่
 * ContentDetailView.tsx และ ContentCardDialog.tsx เคยเขียนแยกกันเองมาก่อน —
 * ดู openspec/changes/platform-color-catalog
 */
export function parsePlatforms(raw: string[] | string | null | undefined): string[] {
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : raw.split(',');
    } catch {
      list = raw.split(',');
    }
  }
  return Array.from(new Set(list.map(p => String(p).trim().toLowerCase()).filter(Boolean)));
}

interface Props {
  /** ค่า platforms ของ content item — ยังไม่ต้อง parse มาก่อน ส่งดิบเข้ามาได้เลย */
  platforms: string[] | string | null | undefined;
  /** 'pill' = ไอคอน + label สี ต่อแพลตฟอร์ม — โหมดเดียวที่รองรับ (เดิมมี
   *  'icon-only' ด้วย แต่หลัง openspec/changes/content-type-badge-display ไม่มี
   *  ผู้เรียกใช้เหลืออยู่แล้ว จึงตัดออกเพื่อไม่ให้เป็น dead code) */
  variant: 'pill';
  size?: number;
  className?: string;
}

/**
 * แสดงแพลตฟอร์มของ content item แยกทีละอันพร้อมไอคอน/สีที่ถูกต้อง — แทนที่การ
 * เอาค่าดิบ (มักเป็นสตริงรวมหลายแพลตฟอร์มคั่นด้วย comma) ไป lookup เป็น
 * แพลตฟอร์มเดียวโดยตรงซึ่งพังเสมอเมื่อ content item มีมากกว่า 1 แพลตฟอร์ม
 * แสดงครบทุกแพลตฟอร์มที่มีจริง ไม่ตัดทอนเป็น "+N"
 */
export function PlatformBadgeList({ platforms, size = 12, className }: Props) {
  const list = parsePlatforms(platforms);
  if (list.length === 0) return null;

  return (
    <div className={cn('flex items-center flex-wrap gap-1.5', className)}>
      {list.map(platform => (
        <span
          key={platform}
          className={cn(
            'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium',
            getPlatformColorClass(platform)
          )}
        >
          <PlatformIcon platform={platform} size={size} className="shrink-0" />
          {getPlatformLabel(platform)}
        </span>
      ))}
    </div>
  );
}
