import { cn } from '@/lib/utils';
import { TYPE_MAP, getCanonicalContentType } from '@/components/content/types';

interface Props {
  /** content_type ดิบของ content item (เช่น 'article', 'video') — ยังไม่ต้อง
   *  resolve มาก่อน component จะเรียก getCanonicalContentType() ให้เอง */
  contentType: string | null | undefined;
  /** 'icon-only' = ไอคอนสีอย่างเดียว ไม่มี label (พื้นที่แคบ เช่น chip ปฏิทิน) ·
   *  'pill' = ไอคอน + label สี (พื้นที่กว้าง เช่น คอลัมน์ตาราง) */
  variant: 'icon-only' | 'pill';
  size?: number;
  className?: string;
}

/**
 * แสดงประเภทเนื้อหา (บทความ/วีดีโอ) ของ content item ด้วยไอคอน/สีจาก TYPE_MAP
 * ที่มีอยู่แล้ว — ใช้แทนที่ PlatformBadgeList บน ContentPlannerCalendar chip และ
 * ContentItemList คอลัมน์ประเภท (เดิมแสดงไอคอนแพลตฟอร์ม) ดู
 * openspec/changes/content-type-badge-display
 */
export function ContentTypeBadge({ contentType, variant, size = 12, className }: Props) {
  const type = getCanonicalContentType({ content_type: contentType });
  const meta = TYPE_MAP[type];
  const Icon = meta.icon;

  if (variant === 'icon-only') {
    return <Icon className={cn('shrink-0', meta.color.split(' ')[0], className)} style={{ width: size, height: size }} />;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0',
        meta.color,
        className
      )}
    >
      <Icon className="shrink-0" style={{ width: size, height: size }} />
      {meta.label}
    </span>
  );
}
