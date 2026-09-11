/**
 * Parse ค่า platforms ของ content item ให้เป็น array เดี่ยว lowercase ไม่ซ้ำ
 * ไม่มีค่าว่าง — รองรับทั้งรูปแบบ array ที่ parse แล้ว, JSON string
 * (`content_items.platforms`), และ comma-joined string เดิม
 * (`content_items.platform` เช่น "facebook,linkedin,twitter") ตรรกะเดียวกับที่
 * ContentDetailView.tsx และ ContentCardDialog.tsx เคยเขียนแยกกันเองมาก่อน —
 * ดู openspec/changes/platform-color-catalog
 *
 * เดิมอยู่ที่ src/components/content/PlatformBadgeList.tsx และมี implementation
 * ซ้ำเกือบทั้งหมดใน ContentListTab.tsx (getItemPlatforms) — ย้ายมารวมเป็นที่เดียว
 * ที่นี่เพื่อไม่ให้ตรรกะดริฟท์ออกจากกันได้อีก ดู
 * openspec/changes/content-platforms-parser-refactor
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
  // แต่ละ element ใน list อาจยังเป็น comma-joined ซ้อนอยู่อีกชั้น — เช่น content
  // item เก่าที่ไม่มี `platforms` เลย (NULL/ว่าง) แต่มี `platform` เป็น
  // comma-joined ("facebook,youtube") จะถูก API ห่อเป็น JSON array ที่มี
  // element เดียวคือสตริงนั้นทั้งก้อน (ดู content-items.php:
  // COALESCE(NULLIF(ci.platforms,''), JSON_ARRAY(COALESCE(NULLIF(ci.platform,''), ...))))
  // JSON.parse ผ่านตรงนี้แล้ว (เป็น array จริง) จึงไม่เข้า branch split(',') ด้านบน
  // ต้อง split element แต่ละตัวซ้ำอีกชั้นเสมอกันพลาด
  return Array.from(new Set(
    list
      .flatMap(p => String(p).split(','))
      .map(p => p.trim().toLowerCase())
      .filter(Boolean),
  ));
}
