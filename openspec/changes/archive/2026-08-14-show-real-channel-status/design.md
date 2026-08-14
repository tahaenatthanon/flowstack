## Context

Widget "สถานะช่องทาง" ใน `ContentDashboardPage.tsx` ปัจจุบัน:

```tsx
{channels.map(ch => {
  const platform = PLATFORM_MAP[ch.platform];
  const active = ch.is_active === 1;
  return (
    <div key={ch.id} className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`} />
        <span className="text-sm">{ch.name}</span>
      </div>
      {platform ? (
        <Badge variant="outline" className={platform.color}>{platform.label}</Badge>
      ) : null}
    </div>
  );
})}
```

แสดงเฉพาะจุดสี (เขียว/เทา) + ชื่อ channel + badge platform — ไม่มีข้อความสถานะชัดเจน

`PublishChannel` type:
```ts
export interface PublishChannel {
  id: string; name: string;
  platform: '...';
  endpoint_url: string; is_active: number; created_at: string;
}
```

ข้อมูลมาจาก `usePublishChannels()` → `GET /brand-content.php?action=channels` ซึ่งคืน `is_active` (0/1) จริงจากตาราง `publish_channels`

## Goals / Non-Goals

**Goals:**
- เอา Status Badge รูปแบบเดิม (จุดสี) ออก
- ย้าย Status ไปแสดงไว้ด้านหลังข้อมูลของแต่ละช่องทาง (หลังชื่อ/แพลตฟอร์ม)
- ตรวจสอบสถานะการเชื่อมต่อจากการเชื่อมต่อจริง (ไม่ใช้เพียง `is_active`)
- แสดง label + สีตามผลจริง: "เชื่อมต่อแล้ว" (เขียว) เมื่อยืนยันได้ว่าทำงานจริง, "ไม่เชื่อมต่อ" (แดง) เมื่อเชื่อมต่อไม่ได้/ไม่สมบูรณ์

**Non-Goals:**
- ไม่เปลี่ยนโครงสร้าง `publish_channels` / DB
- ไม่แตะ widget อื่น
- ไม่เปลี่ยน `is_active` ในฝั่ง backend (แต่ไม่ใช้เป็นตัวบอกสถานะเพียงอย่างเดียว)

## Decisions

**1. เอา Status Badge เดิม (จุดสี) ออก + ย้าย Status ไปด้านหลังข้อมูล**
- ลบจุดสี indicator เดิมออก
- ย้าย Status ไปแสดงด้านหลังข้อมูลของ channel

**2. ตรวจสอบการเชื่อมต่อจริงจาก backend**
- Reuse logic ของ `test-channel` (cURL/API call จริงต่อแพลตฟอร์ม) โดย refactor เป็น helper `testChannelConnection($db, $channel)` คืน `['ok' => bool, 'message' => string]`
- เพิ่ม action `channels-connection-status` (GET) ที่ loop ทุก channel ของ tenant แล้วรัน helper คืน array `[{ id, name, ok, message }]`
- `is_active === 0` → ถือว่า "ไม่เชื่อมต่อ" ทันที (disabled); `is_active === 1` → ตรวจสอบจริงผ่าน helper

**3. แสดงสถานะด้วย "จุดสี + ข้อความ" (ไม่มีพื้นหลัง/Status Badge)**
- `ok === true` → จุดสีเขียว (`bg-green-500`) + ข้อความ "เชื่อมต่อแล้ว"
- `ok === false` → จุดสีแดง (`bg-red-500`) + ข้อความ "ไม่เชื่อมต่อ"
- แสดงเป็น `<span>` ธรรมดา (จุดสี + ข้อความ) โดยไม่มีพื้นหลังหรือ Status Badge — ให้สอดคล้องกับ UI ของระบบ

**4. ไม่ใช้ hardcode status**
- สถานะอิงจากผลการเชื่อมต่อจริงเสมอ ไม่มีค่า default ตายตัวใน frontend

## Risks / Trade-offs

- [การตรวจสอบจริงต้องทำ network call ต่อ channel] → รวมเป็น single batch endpoint ฝั่ง server; ยอมรับ latency เล็กน้อยเพื่อให้สถานะถูกต้องจริง
- [บางแพลตฟอร์ม (instagram/tiktok/twitter) ไม่มี verify API ตรง] → คืน `ok: false` + message "ไม่รองรับการทดสอบโดยตรง" → แสดง "ไม่เชื่อมต่อ" (แดง) จนกว่าจะตั้งค่า/ทดสอบได้

## Migration Plan

- เพิ่ม action ใหม่ใน `api/brand-content.php` + hook ใน frontend — ไม่มี DB migration
- Rollback: กลับไปแสดงตาม `is_active` อย่างเดียว
- Rollback: revert เป็นจุดสีอย่างเดียว
