## Why

แดชบอร์ดคอนเทนต์ (`ContentDashboardPage`) รวมข้อมูลทุกอย่างไว้หน้าเดียว ทั้งข้อมูลเชิงปฏิบัติการ (production/action: สถานะผลิต, คิวรออนุมัติ, กำหนดการโพสต์) และข้อมูลเชิงวิเคราะห์ (analytics/insight: ยอดวิว, ไลก์, แพลตฟอร์ม) ทำให้หน้าเพจยาว ผู้ใช้ต้องเลื่อนเยอะเพื่อหา insight และ action item ปนกันไม่เป็นระเบียบ

## What Changes

- แบ่งแดชบอร์ดคอนเทนต์ออกเป็น 2 แท็บ: **"ภาพรวม"** (Overview, default) และ **"วิเคราะห์"** (Analytics)
- แท็บ **ภาพรวม** เก็บข้อมูลเชิงปฏิบัติการ/action: Stat Cards การผลิต (เนื้อหาทั้งหมด, เผยแพร่แล้ว, รออนุมัติ, ฉบับร่าง), แจ้งเตือนเลยกำหนดส่ง, ภาพรวมสถานะคอนเทนต์ (Work Progress), เนื้อหาล่าสุด, คิวรออนุมัติ, กำหนดการโพสต์ถัดไป, และสถานะช่องทาง
- แท็บ **วิเคราะห์** เก็บข้อมูลเชิง insight/engagement: Stat Cards ยอดวิวรวม/ยอดไลก์รวม, การกระจายแพลตฟอร์ม (ย้ายมาจากภาพรวม), เนื้อหายอดนิยม (Top Content จัดเรียงตาม views/likes), และเวลาที่ดีที่สุดในการโพสต์ (Best Time Analytics จาก `content_posting_analytics`)
- สถานะแท็บผูกกับ URL query parameter (`?tab=analytics`) เพื่อให้ refresh/แชร์ลิงก์แล้วคงแท็บเดิม และสอดคล้องกับ pattern `navigate('/content?tab=approval')` ที่ใช้อยู่แล้ว
- Data fetching แยกตามแท็บ: เปิดโหลด `usePostingAnalytics()` เฉพาะเมื่อเปิดแท็บวิเคราะห์ เพื่อไม่ดึงข้อมูลที่ไม่จำเป็นตอนเข้าแท็บภาพรวม

## Capabilities

### New Capabilities

- `content-dashboard-tabs`: โครงสร้างแท็บ (ภาพรวม/วิเคราะห์) บนแดชบอร์ดคอนเทนต์ พร้อมการผูกสถานะแท็บกับ URL query parameter
- `content-dashboard-analytics`: เนื้อหาในแท็บวิเคราะห์ — widget "เนื้อหายอดนิยม" (Top Content) และ "เวลาที่ดีที่สุดในการโพสต์" (Best Time Analytics)

### Modified Capabilities

- `content-dashboard-layout`: master layout เดิมเป็น 2 คอลัมน์เดียว เปลี่ยนเป็น layout แยกตามแท็บ (ภาพรวม vs วิเคราะห์) และกระจาย section ไปยังแท็บที่เกี่ยวข้อง
- `content-dashboard-stats`: Stat Cards ยอดวิวรวม/ยอดไลก์รวม ย้ายจากภาพรวมไปแสดงในแท็บวิเคราะห์
- `content-dashboard-schedule-channels`: widget "แพลตฟอร์ม" (การกระจายแพลตฟอร์ม) ย้ายจากภาพรวมไปแสดงในแท็บวิเคราะห์

## Impact

- `src/pages/ContentDashboardPage.tsx`: ไฟล์หลักที่ถูกแก้ (ครอบด้วย `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, ย้าย section ไปยังแท็บที่เกี่ยวข้อง, เพิ่ม `usePostingAnalytics()` และ `BestTimeAnalyticsPanel`)
- `src/components/ui/tabs.tsx`: ใช้ `Tabs` primitive ที่มีอยู่แล้ว (ไม่แก้)
- `src/components/content/BestTimeAnalyticsPanel.tsx`: ใช้ component ที่มีอยู่แล้ว (ไม่แก้)
- `src/hooks/useContent.ts`: เพิ่ม optional `enabled` parameter ให้ `usePostingAnalytics()` (ตาม pattern เดิมของ `useContentSkills`/`usePublishChannels`) เพื่อเปิดโหลดเฉพาะแท็บวิเคราะห์ — เป็นการแก้แบบ additive ไม่กระทบ call site อื่น
- `src/components/content/types.ts`: ใช้ `PostingAnalyticsResponse` type ที่มีอยู่แล้ว (ไม่แก้)
- ไม่กระทบ API, database schema, หรือ dependency
