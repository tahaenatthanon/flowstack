import { cn } from '@/lib/utils';
import {
  VIDEO_ASPECT_RATIO_OPTIONS, normalizeVideoAspect, normalizeVideoResolution, type VideoAspectRatio,
} from '@/components/content/types';

/**
 * badge อ่านอย่างเดียวของอัตราส่วน/ความละเอียดวิดีโอ เช่น ▯ 9:16 · 720p — ค่าถูกเลือกและล็อก
 * ตั้งแต่ตอนสร้างคอนเทนต์ (NULL → 9:16 · 720p) — spec: content-video-ui-section
 */
export function VideoSpecBadge({ aspectRatio, resolution, className }: {
  aspectRatio?: string | null; resolution?: string | null; className?: string;
}) {
  const ratio = normalizeVideoAspect(aspectRatio);
  const res = normalizeVideoResolution(resolution);
  return (
    <span
      data-testid="video-spec-badge"
      title="อัตราส่วนวิดีโอ · ความละเอียดวิดีโอ (กำหนดตอนสร้างคอนเทนต์)"
      className={cn('inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground', className)}
    >
      <span className="flex items-center justify-center w-3.5 h-3.5"><AspectRatioShape ratio={ratio} size={12} /></span>
      {ratio} · {res}
    </span>
  );
}

/**
 * รูปสี่เหลี่ยมวาดตามอัตราส่วนจริงด้วย CSS (กรอบเส้นขอบ) — ด้านยาวเท่ากับ `size` px
 * ใช้แทนไอคอนสำเร็จรูป เพื่อให้เห็นทรงวิดีโอจริง (spec: video-creation-options)
 */
export function AspectRatioShape({ ratio, size = 18, className }: { ratio: string; size?: number; className?: string }) {
  const [w, h] = ratio.split(':').map(Number);
  const landscape = (w || 1) >= (h || 1);
  const width = landscape ? size : Math.round((size * (w || 1)) / (h || 1));
  const height = landscape ? Math.round((size * (h || 1)) / (w || 1)) : size;
  return (
    <span
      aria-hidden
      data-testid={`aspect-shape-${ratio}`}
      className={cn('inline-block shrink-0 rounded-[3px] border-2 border-current', className)}
      style={{ width, height }}
    />
  );
}

/** กล่องเลือก "อัตราส่วนวิดีโอ" — รูปทรงจริง + ข้อความอัตราส่วน, tooltip แนวนอน/แนวตั้ง */
export default function AspectRatioPicker({
  value, onChange, compact = false,
}: {
  value: VideoAspectRatio;
  onChange: (v: VideoAspectRatio) => void;
  /** ขนาดกะทัดรัด สำหรับแถวตั้งค่าต่อหัวข้อใน BatchGenerate */
  compact?: boolean;
}) {
  return (
    <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="อัตราส่วนวิดีโอ">
      {VIDEO_ASPECT_RATIO_OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${opt.value} ${opt.label}`}
            title={`${opt.label} · ${opt.desc}`}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center rounded-lg border font-medium transition-all',
              compact ? 'gap-1.5 px-2 py-1 text-[11px]' : 'gap-2.5 px-4 py-2 text-sm',
              selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            <span className={cn('flex items-center justify-center', compact ? 'w-3.5 h-3.5' : 'w-5 h-5')}>
              <AspectRatioShape ratio={opt.value} size={compact ? 14 : 18} />
            </span>
            {opt.value}
          </button>
        );
      })}
    </div>
  );
}
