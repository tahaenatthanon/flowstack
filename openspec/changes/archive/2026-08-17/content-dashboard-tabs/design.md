## Context

หน้า `ContentDashboardPage` (แดชบอร์ดคอนเทนต์) ปัจจุบันรวมข้อมูลทุกอย่างไว้หน้าเดียว 8 section โดยใช้ master grid 2 คอลัมน์บนจอ `xl` (`xl:grid-cols-3`, ซ้าย `xl:col-span-2` ขวา `1/3`):

- **Stat Cards** 6 ใบ (เนื้อหาทั้งหมด, เผยแพร่แล้ว, รออนุมัติ, ฉบับร่าง, ยอดวิวรวม, ยอดไลก์รวม)
- **แจ้งเตือนเลยกำหนดส่ง** (Overdue)
- **คอลัมน์ซ้าย**: ภาพรวมสถานะคอนเทนต์ (Work Progress) + เนื้อหาล่าสุด (ตาราง)
- **คอลัมน์ขวา**: รออนุมัติ, กำหนดการโพสต์ถัดไป, แพลตฟอร์ม, สถานะช่องทาง

ข้อมูลทั้งหมดผสมกันระหว่าง "งานที่ต้องทำ/action" กับ "ผลลัพธ์/insight" ทำให้หน้าอ่านยากและยาว Infrastructure ที่ใช้สำหรับวิเคราะห์มีพร้อมใช้อยู่แล้ว:

- `content_items.views` / `content_items.likes` — ฟิลด์ engagement ต่อ item
- `content_posting_analytics` table + `usePostingAnalytics()` hook (`src/hooks/useContent.ts:135`)
- `BestTimeAnalyticsPanel` component (`src/components/content/BestTimeAnalyticsPanel.tsx`) ที่ใช้ใน `ContentPlannerPage` แล้ว
- `useRecalculateAnalytics()` mutation + action `analytics-recalculate` (มีอยู่แล้ว)
- `Tabs` primitive จาก `@/components/ui/tabs` (Radix)

## Goals / Non-Goals

**Goals:**
- แบ่งแดชบอร์ดเป็น 2 แท็บ "ภาพรวม" (overview, default) และ "วิเคราะห์" (analytics)
- แยกข้อมูลเชิง action (production/queue/schedule/channels) ออกจากข้อมูลเชิง insight (engagement/platform/top content/best time)
- ผูกสถานะแท็บกับ URL query parameter ให้ deep-link + refresh คงแท็บเดิม
- โหลดข้อมูลวิเคราะห์ (`usePostingAnalytics`) เฉพาะเมื่อเปิดแท็บวิเคราะห์

**Non-Goals:**
- ไม่แก้ logic การคำนวณ engagement/analytics บน backend
- ไม่เพิ่ม API endpoint หรือ field ใหม่ (ใช้ `views` + `likes` ที่มีอยู่)
- ไม่เปลี่ยนสไตล์ Stat Cards/header หรือ design system อื่น
- ไม่ย้าย "เนื้อหายอดนิยม" กลับเข้าแท็บภาพรวม — จะอยู่เฉพาะแท็บวิเคราะห์

## Decisions

### 1. ใช้ `Tabs` (Radix) ครอบทั้งหน้า และย้าย section ตามแท็บ
- แท็บ **ภาพรวม** (default): Stat Cards การผลิต 4 ใบ, แจ้งเตือนเลยกำหนดส่ง, ภาพรวมสถานะคอนเทนต์, เนื้อหาล่าสุด, คิวรออนุมัติ, กำหนดการโพสต์ถัดไป, สถานะช่องทาง
- แท็บ **วิเคราะห์**: Stat Cards ยอดวิวรวม/ยอดไลก์รวม, แพลตฟอร์ม (ย้ายมาจากภาพรวม), เนื้อหายอดนิยม, เวลาที่ดีที่สุดในการโพสต์
- **Rationale**: `Tabs` primitive มีอยู่แล้วใน project (`@/components/ui/tabs`), ไม่เพิ่ม dependency, และ `TabsContent` lazy-mount content ตามแท็บโดยธรรมชาติ
- **Alternative considered**: แยกเป็น 2 route (`/content-dashboard` + `/content-analytics`) — ปฏิเสธ เพราะต้องแก้ App.tsx, sidebar, และ permission แยกเพิ่ม; แท็บ single-page ง่ายกว่าและสอดคล้องกับ pattern `?tab=` ที่มีอยู่แล้ว

### 2. สถานะแท็บผูกกับ URL query parameter
- ใช้ `useSearchParams` จาก `react-router-dom`: `?tab=analytics` → แท็บวิเคราะห์, ไม่มี param หรือ `?tab=overview` → แท็บภาพรวม
- **Rationale**: สอดคล้องกับ `navigate('/content?tab=approval')` ที่ใช้ในคิวรออนุมัติ; refresh/แชร์ลิงก์คงแท็บเดิม
- **Alternative considered**: `useState` ล้วน — ปฏิเสธเพราะเสีย deep-link และ state หายเมื่อ refresh

### 3. Data fetching แยกตามแท็บ
- เพิ่ม optional `enabled` parameter ให้ `usePostingAnalytics(enabled: boolean)` ตาม pattern เดิมของ `useContentSkills`/`usePublishChannels`
- เรียก `usePostingAnalytics(tab === 'analytics')` และ `useRecalculateAnalytics()` สำหรับปุ่มคำนวณใหม่ใน `BestTimeAnalyticsPanel`
- `useContentItems`, `useOverdueCount`, `useAllSchedules`, `usePublishChannels`, `useChannelConnectionStatus` ยังโหลดที่ top-level เพราะแท็บภาพรวมต้องการทั้งหมด และ engagement stat cards (ยอดวิว/ไลก์) ยังคำนวณจาก `items` ที่มีอยู่แล้ว
- **Rationale**: ไม่เสีย request ไปที่ `analytics-posting-times` เมื่อผู้ใช้ไม่เปิดแท็บวิเคราะห์

### 4. "เนื้อหายอดนิยม" ในแท็บวิเคราะห์
- คำนวณ top content จาก `items` โดยเรียงตาม `views` แล้ว `likes` (ใช้ `Number(views) + Number(likes)*2` เป็น engagement score เดียวกับที่ `brand-content.php` ใช้) ตัด 5 รายการ
- **Rationale**: `ContentItem` มีแค่ `views`/`likes` — ใช้ score เดียวกับ backend เพื่อให้ตัวเลขสอดคล้องกับ `avg_engagement` ใน `content_posting_analytics`
- **Alternative considered**: เพิ่ม field `shares`/`comments` — ปฏิเสธ (เกิน scope, ต้อง migration + API)

### 5. "เวลาที่ดีที่สุดในการโพสต์" ใช้ `BestTimeAnalyticsPanel` ที่มีอยู่
- ใช้ `<BestTimeAnalyticsPanel analytics={postingAnalytics} isLoading={...} onRecalculate={...} isRecalculating={...} />` โดย wire `onRecalculate` ผ่าน `useRecalculateAnalytics()` mutation (pattern เดียวกับ `ContentPlannerPage.handleRecalculate`)
- **Rationale**: component มี UI + empty-state + recalculate ครบแล้ว ไม่ต้องสร้างใหม่

## Risks / Trade-offs

- [แท็บวิเคราะห์อาจว่างถ้ายังไม่มีข้อมูล posting analytics] → `BestTimeAnalyticsPanel` มี empty-state "รออย่างน้อย 10 โพสต์" + ปุ่ม "คำนวณตอนนี้" อยู่แล้ว
- [Top content คำนวณจาก views/likes เท่านั้น อาจไม่สะท้อน engagement จริง] → ระบุใน proposal ว่าใช้ `views + likes*2` สอดคล้องกับ backend; การเพิ่ม metric ละเอียดเป็นงานแยก
- [การย้าย section อาจกระทบ spec ที่มีอยู่ (`content-dashboard-layout`, `content-dashboard-stats`, `content-dashboard-schedule-channels`)] → สร้าง delta spec MODIFIED ครบทุก capability ที่กระทบ เพื่อให้ archive ได้โดยไม่เสียข้อมูล
- [มี drift ระหว่าง spec กับ implementation ปัจจุบัน (เช่น Stat Cards ยังเป็น style แนวนอนเก่าในโค้ด)] → งานนี้ไม่แก้ drift เดิม; scoped เฉพาะการแบ่งแท็บเท่านั้น (อิงโครงสร้าง implementation ปัจจุบัน)
