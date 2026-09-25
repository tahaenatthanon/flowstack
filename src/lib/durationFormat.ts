/**
 * แปลงระยะเวลาหน่วยมิลลิวินาที (ที่ Facebook Graph API คืนมา เช่น page_video_view_time,
 * post_video_avg_time_watched) เป็นข้อความภาษาไทยที่อ่านง่าย ทศนิยม 1 ตำแหน่ง
 *   16265   → "16.3 วิ"
 *   292773  → "4.9 นาที"
 *   5400000 → "1.5 ชม."
 * null/undefined → "—" (ไม่มีข้อมูล ต่างจาก 0 ที่แสดง "0 วิ")
 */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
  const seconds = ms / 1000;
  if (seconds < 60) return `${trimZero(seconds)} วิ`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${trimZero(minutes)} นาที`;
  return `${trimZero(minutes / 60)} ชม.`;
}

/** ทศนิยม 1 ตำแหน่ง แต่ตัด ".0" ทิ้ง (0 → "0", 12.0 → "12") */
function trimZero(n: number): string {
  const fixed = n.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}
