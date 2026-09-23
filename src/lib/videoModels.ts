/**
 * Model วิดีโอคือ model ที่ประกาศ capability ไว้ใน ai_models.features.video
 * (ตั้งค่าด้วย migration — ดู openspec/changes/kie-video-adapter) — ai-models.php
 * ไม่คืน model ที่ status = 'inactive' อยู่แล้ว จึงเช็คแค่ features.video
 */
export function isVideoModel(model: { features?: unknown }): boolean {
  const f = model.features;
  return !!f && typeof f === 'object' && !Array.isArray(f) && typeof (f as Record<string, unknown>).video === 'object';
}

/** ข้อความเตือน (ภาษาไทย) เมื่อ model วิดีโอที่ตั้งไว้ใช้สร้างวิดีโอไม่ได้ — null ถ้าไม่มีปัญหา */
export function videoModelWarning(selectedId: string | null, models: { id: string; features?: unknown }[]): string | null {
  if (!selectedId) return 'ยังไม่ได้เลือกโมเดลวิดีโอ — ระบบจะสร้างวิดีโอไม่ได้จนกว่าจะเลือก';
  const found = models.find(m => m.id === selectedId);
  if (!found || !isVideoModel(found)) return 'โมเดลที่ตั้งไว้ใช้สร้างวิดีโอไม่ได้ — กรุณาเลือกโมเดลวิดีโอ (Veo / Seedance) ใหม่';
  return null;
}
