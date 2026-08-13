## Context

`src/pages/ContentDashboardPage.tsx` ปัจจุบันแสดงการ์ดสถิติ 4 ใบ, แจ้งเตือนโพสต์เกินกำหนด, สัดส่วนแพลตฟอร์ม และรายการเนื้อหาล่าสุด (5 แถว) โดยดึงข้อมูลจาก `useContentItems()` (`GET /content-items.php`) และ `useOverdueCount()` (`content-publish.php?action=overdue_count`)

ข้อมูลที่ต้องการสำหรับ widget ใหม่ทั้งหมดมีอยู่ใน API เดิมแล้ว:
- `views` / `likes` — อยู่ใน SELECT ของ `GET /content-items.php` แล้ว (คอลัมน์ `COALESCE(ci.views, 0)`, `COALESCE(ci.likes, 0)`)
- `status`, `requested_at`, `reject_reason` — อยู่ใน `content_items` (แก้แล้วใน change ก่อนหน้า)
- `scheduled_date` — อยู่ใน `content_items` และ `content_plan_items`
- ช่องทางเชื่อมต่อ — `usePublishChannels()` → `brand-content.php?action=channels`
- กำหนดการ — `useAllSchedules()` → `brand-content.php?action=all-schedules`

อ้างอิง mockup: `mockup/index.php` (Work Progress, Recent Content, Platform Status, Platform Performance) — แต่ scope นี้ทำเฉพาะ widget ที่ใช้ข้อมูลจริงได้ ไม่รวม metric ประสิทธิภาพ (followers/reach/engagement) ที่เป็นข้อมูล mock

## Goals / Non-Goals

**Goals:**
- เพิ่ม widget ภาพรวมบน `ContentDashboardPage` โดยไม่แตะ API หรือ database
- ใช้ข้อมูลจาก `content_items` (`views`, `likes`, `status`, `requested_at`, `scheduled_date`) และ hook ที่มีอยู่แล้ว (`useAllSchedules`, `usePublishChannels`)
- จัด layout ใหม่ให้อ่านง่าย ยังคงโครงสร้าง `PageShell` + shadcn-ui ตามธีมโปรเจกต์

**Non-Goals:**
- ไม่สร้าง metric ประสิทธิภาพ (followers/reach/engagement/CTR/bounce) — ยังไม่มี backend รองรับ
- ไม่แก้ `api/content-items.php` หรือ schema
- ไม่ย้าย/ปรับ sidebar menu (เป็น change แยกต่างหาก)
- ไม่สร้างหน้า "วิเคราะห์คอนเทนต์" แยก

## Decisions

### 1. คำนวณ aggregation ฝั่ง client ทั้งหมด

**เลือก**: คำนวณยอดรวมวิว/ไลก์, จำนวนต่อสถานะ, และ sort top content ฝั่ง React จาก array ที่ `useContentItems()` คืนมา

**เหตุผล**: ข้อมูล `views`/`likes`/`status`/`requested_at` ถูกส่งกลับมาจาก `GET /content-items.php` แล้ว การนับฝั่ง client ไม่ต้องแก้ backend และข้อมูลชุดนี้ไม่ใหญ่พอที่จะต้อง aggregate ฝั่ง SQL

**Alternative considered**: เพิ่ม aggregation endpoint แยก — overkill สำหรับข้อมูลชุดเดียวที่ดึงมาอยู่แล้ว

### 2. กำหนดการโพสต์ถัดไป: ใช้ `useAllSchedules()` เป็นหลัก

**เลือก**: ใช้ `useAllSchedules()` (`brand-content.php?action=all-schedules`) ซึ่งคืน `ContentSchedule[]` พร้อม `scheduled_at` และ `channel_name`/`platform` สำหรับโชว์กำหนดการ และ filter เฉพาะ `scheduled_at` อยู่ในอนาคต

**เหตุผล**: schedules มีข้อมูลช่องทาง/เวลาจริงครบกว่า `content_items.scheduled_date` เพียงอย่างเดียว

**Alternative considered**: filter `content_items.scheduled_date` — ข้อมูลน้อยกว่าและไม่มี channel info

### 3. สถานะช่องทาง: ใช้ `usePublishChannels()`

**เลือก**: ใช้ `usePublishChannels()` ซึ่งคืน `PublishChannel[]` พร้อม `is_active` และ `platform`

**เหตุผล**: endpoint นี้มีอยู่แล้วและตรงกับ "Platform Status" ใน mockup หลัก

### 4. Widget คิวรออนุมัติ: filter + sort จาก `useContentItems()`

**เลือก**: filter `items` ที่ `status === 'pending_approval'` แล้ว sort ตาม `requested_at` ascending พร้อมปุ่มลัด `/content-approval`

**เหตุผล**: `requested_at` ถูกเพิ่มใน change ก่อนหน้าแล้วและถูกส่งกลับมาใน SELECT แล้ว

### 5. Layout: จัด grid เป็นหลายแถวตามลำดับความสำคัญ

**เลือก**: เรียง widget ตามนี้ (บน→ล่าง):
1. Stat Cards (ขยายเป็น 6 ใบ: เนื้อหาทั้งหมด, เผยแพร่แล้ว, รออนุมัติ, ฉบับร่าง, ยอดวิวรวม, ยอดไลก์รวม)
2. แจ้งเตือนเกินกำหนด (คงเดิม)
3. Work Progress (full width)
4. Top Content + คิวรออนุมัติ (2 คอลัมน์)
5. กำหนดการโพสต์ถัดไป + สถานะช่องทาง (2 คอลัมน์)

**เหตุผล**: ภาพรวมสำคัญ (ตัวเลข + ความคืบหน้า) อยู่บนสุด, รายละเอียดย่อยอยู่ล่าง สอดคล้องกับลำดับใน `mockup/index.php`

### 6. UI consistency: ใช้ Design System เดิม

**เลือก**: สร้าง widget ใหม่ทั้งหมดโดยใช้ shadcn-ui primitives ที่มีอยู่แล้วใน `src/components/ui/` และค่าคงที่จาก `src/components/content/types.ts` โดยไม่สร้าง component UI, token สี, หรือรูปแบบ Typography ใหม่

- การ์ด: `Card`, `CardHeader`, `CardTitle`, `CardContent` (จาก `@/components/ui/card`)
- ป้ายสถานะ/แพลตฟอร์ม/ประเภท: `Badge` (จาก `@/components/ui/badge`) + `STATUS_MAP`/`PLATFORM_MAP`/`TYPE_MAP`
- รายการ/ตาราง: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` (จาก `@/components/ui/table`)
- แถบความคืบหน้า: `Progress` (จาก `@/components/ui/progress`)
- ปุ่ม: `Button` (จาก `@/components/ui/button`) ใช้ `variant`/`size` ที่มีอยู่
- Typography/Spacing: Tailwind tokens + `cn()` จาก `@/lib/utils.ts`

**เหตุผล**: ตรงตาม `theme-and-structure-guidelines` — หน้าใหม่ต้องสอดคล้องกับธีม/โครงสร้างของระบบ และ reuse component เดิมแทนการสร้างใหม่ การ reuse ลด maintenance และคงความสม่ำเสมอของ UX

**Alternative considered**: เขียน markup/CSS ใหม่เอง — ผิด Design System เสี่ยง rework และไม่สอดคล้องกับหน้าเดิม

## Risks / Trade-offs

- **[Risk] จำนวน widget เยอะทำให้หน้าโหลดช้า** → Mitigation: ทุก widget ใช้ query ที่มีอยู่แล้ว ใช้ React Query caching (`staleTime`) ไม่เพิ่ม request ใหม่ที่ไม่มี cache
- **[Risk] `useAllSchedules()` และ `usePublishChannels()` เป็น request เพิ่มเติม** → Mitigation: ทั้งคู่มี staleTime และ refetch interval ที่สมเหตุสมผลอยู่แล้วใน `useContent.ts`
- **[Risk] ค่า `views`/`likes` อาจเป็น 0/null ถ้าเนื้อหายังไม่ได้เผยแพร่** → Mitigation: ใช้ `COALESCE(..., 0)` ฝั่ง API แล้ว และ type `views: number` ใช้ `?? 0` กันกรณี undefined ฝั่ง client
- **[Risk] `requested_at` เป็น null สำหรับรายการเก่า** → Mitigation: sort เอา null ไว้ท้าย (fallback ใช้ `updated_at`/`created_at`)

## Migration Plan

1. Deploy พร้อมกันทั้งไฟล์ `ContentDashboardPage.tsx` (และ component ย่อยถ้าแยก)
2. ไม่ต้องมี database migration — ใช้ API และ tables เดิม
3. Rollback: revert commit — ไม่มี data change
