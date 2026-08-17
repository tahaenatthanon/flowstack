## Context

หน้า `ContentDashboardPage` มี master grid 2 คอลัมน์ (`xl:grid-cols-3`, ซ้าย `xl:col-span-2` ขวา `1/3`) โดย:

- **ซ้าย**: "ภาพรวมสถานะคอนเทนต์" (Work Progress) + "เนื้อหาล่าสุด" (ตาราง)
- **ขวา**: "รออนุมัติ", "กำหนดการโพสต์ถัดไป", "แพลตฟอร์ม", "สถานะช่องทาง"

ปัจจุบันหัวข้อ Card ทุกใบเป็นข้อความล้วนไม่มีไอคอน ตาราง "เนื้อหาล่าสุด" ไม่มี Thumbnail ปุ่มลัดไม่สม่ำเสมอ และคอลัมน์ซ้าย–ขวาสูงไม่เท่ากัน

## Goals / Non-Goals

**Goals:**
- เพิ่มไอคอนหัวข้อทั้ง 6 section อย่างสม่ำเสมอ
- แสดง Thumbnail ในตาราง "เนื้อหาล่าสุด"
- เพิ่มปุ่ม "ดูทั้งหมด" (เนื้อหาล่าสุด, รออนุมัติ) และ "จัดการ" (สถานะช่องทาง) ที่มุมขวาบนของ Card
- ปรับสมดุลความสูงรวมของคอลัมน์ซ้าย–ขวา

**Non-Goals:**
- ไม่แก้ logic การดึงข้อมูล (data fetching) หรือ endpoint ใด ๆ
- ไม่เพิ่มข้อมูล/เมตริกใหม่
- ไม่เปลี่ยน Stat cards หรือ header

## Decisions

### 1. ไอคอนหัวข้อใช้ lucide-react และจัดวางใน `CardHeader`
- เลือกไอคอนตามความหมาย: ภาพรวมสถานะคอนเทนต์ → `BarChart3`, เนื้อหาล่าสุด → `FileText`, รออนุมัติ → `Clock`, กำหนดการโพสต์ถัดไป → `CalendarClock`, แพลตฟอร์ม → `Share2`, สถานะช่องทาง → `Radio`
- วางเป็น `<Icon className="h-4 w-4 text-muted-foreground" />` ด้านหน้า `CardTitle` โดยใช้ flex
- **Rationale**: `lucide-react` มีอยู่แล้วในโปรเจกต์ ไม่เพิ่ม dependency

### 2. ปุ่ม action ที่มุมขวาบน ใช้ `Button variant="ghost" size="sm"`
- เพิ่มปุ่มใน `CardHeader` เป็น `flex items-center justify-between` โดย title+icon อยู่ซ้าย และปุ่มอยู่ขวา
- "เนื้อหาล่าสุด" → "ดูทั้งหมด" → `navigate('/content')`; "รออนุมัติ" → "ดูทั้งหมด" → `navigate('/content?tab=approval')`
- "สถานะช่องทาง" → "จัดการ" → `navigate('/content?tab=settings')` (การจัดการช่องทาง `ChannelManagementSection` อยู่ในแท็บ "ตั้งค่า AI"/`settings` — ไม่มีแท็บ `channels`)
- **หมายเหตุการแก้เพิ่มเติม**: `ContentPage` เดิมอ่าน query param เฉพาะ `?tab=approval` แล้ว fall back เป็น `content` — จึงแก้ให้รับค่า tab ที่ถูกต้องครบทุกค่า (`content`, `approval`, `schedule`, `skills`, `settings`) เพื่อให้ deep link `?tab=settings` เปิดแท็บได้จริง
- **Rationale**: ใช้ปุ่ม ghost ขนาดเล็กไม่รบกวน layout; ใช้แท็บที่มีอยู่แล้วโดยไม่สร้าง route/tab ปลอมที่นำไปหน้าผิด

### 3. Thumbnail ในตาราง "เนื้อหาล่าสุด"
- เพิ่มคอลัมน์แรก (ก่อนชื่อ) แสดงรูป `w-8 h-8 rounded overflow-hidden border shrink-0 bg-muted`
- ใช้ `item.generated_image_url` ถ้ามี มิฉะนั้นแสดงไอคอนตาม `TYPE_MAP[item.type]` เป็น fallback
- **Rationale**: สอดคล้องกับ pattern ใน `ContentItemList.tsx`

### 4. สมดุลความสูงคอลัมน์ซ้าย–ขวา
- คง master grid `xl:grid-cols-3` แต่ทำให้ทั้งสองคอลัมน์ใช้ `flex flex-col` และ Card ที่สองของฝั่งที่เหลือให้ `flex-1` เพื่อขยายเติมความสูง
- ใช้ `space-y-6` คงเดิม ระยะหัว Card (`pb-2`) คงเดิม
- **Rationale**: ให้ความสูงรวมของทั้งสองคอลัมน์เท่ากันโดยไม่ต้อง hard-code ความสูงตายตัว

## Risks / Trade-offs

- [ไอคอน/ปุ่มอาจเบียดชื่อเรื่องบนจอแคบ] → ใช้ `size="sm"` + `truncate`/`min-w-0` และให้ปุ่ม `shrink-0`
- [Thumbnail อาจโหลดช้าหรือ URL เสีย] → ใช้ `loading="lazy" decoding="async"` และ `bg-muted` เป็น placeholder; fallback เป็นไอคอนเมื่อไม่มี URL
- [การบังคับ `flex-1` อาจทำให้ Card ว่างดูสูงเกินจำเป็น] → ใช้เฉพาะเมื่อมีเนื้อหา และคง empty-state ให้สูงปกติ
