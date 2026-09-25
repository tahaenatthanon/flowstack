import { Badge } from '@/components/ui/badge';

/** component ร่วมของแท็บภาพรวม — ค่าคงที่/ตัวจัดรูปแบบอยู่ที่ format.ts */

/** ป้ายบอกขอบเขตของกล่องที่ไม่ใช่ "ข้อมูลทั้งหมด" เช่น "ณ ตอนนี้", "วันนี้–พรุ่งนี้" */
export function ScopeTag({ children }: { children: React.ReactNode }) {
  return <Badge variant="outline" className="shrink-0 text-[11px] font-normal text-muted-foreground">{children}</Badge>;
}

/** หัวข้อของแต่ละส่วน (การผลิต / การเผยแพร่ / ผลลัพธ์ / งานที่ต้องจัดการ) */
export function SectionHeading({ index, title, hint }: { index?: number; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-base font-semibold">
        {index !== undefined && <span className="mr-1 text-muted-foreground">{index}.</span>}
        {title}
      </h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
