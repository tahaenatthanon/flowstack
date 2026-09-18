## Context

State ของ dialog สร้าง/แก้ไขแคมเปญใน `CampaignsPage.tsx` ถูก reset จากหลายจุด: `openCreateCampaign()` (ปุ่ม "สร้างแคมเปญ"), `openEditCampaign()` (แก้ไขแคมเปญเดิม), fromContent flow (ดึงคอนเทนท์จากบทความ), และ `onOpenChange` ของ Dialog เอง (ตอนปิด)

Root cause ที่ยืนยันจากโค้ด: `openCreateCampaign()` ([CampaignsPage.tsx:347-353](../../../src/pages/CampaignsPage.tsx:347)) reset ตัวแปรเกือบทั้งหมด (`campaignName`, `campaignSubject`, `campaignBody`, `senderName`, `senderEmail`, `selectedCampaignGroups`, `enableTrackOpens`, `enableTrackClicks`) แต่ **ไม่ reset `selectedTemplate`**

สาเหตุที่ dialog's `onOpenChange` ([บรรทัด 1131](../../../src/pages/CampaignsPage.tsx:1131)) ซึ่งมี `setSelectedTemplate('')` อยู่แล้ว ไม่ได้ช่วยแก้ปัญหานี้: `onOpenChange` ของ Radix/shadcn `Dialog` ทำงานเฉพาะตอนที่ตัว Dialog เอง "ขอ" เปลี่ยนสถานะ (ผู้ใช้กด X/Escape/คลิกนอกกรอบ) — แต่ตอนบันทึกแคมเปญสำเร็จ โค้ดปิด dialog ด้วย `setIsCampaignDialogOpen(false)` ตรงๆ ([บรรทัด 410](../../../src/pages/CampaignsPage.tsx:410)) ซึ่งเป็น parent สั่งเปลี่ยน `open` prop เอง — Radix ไม่เรียก `onOpenChange` ในกรณีนี้ (พฤติกรรมมาตรฐานของ controlled component ใน Radix ทุกตัว) ทำให้ reset block ทั้งก้อนไม่ทำงาน แล้ว `openCreateCampaign()` ตอนเปิดรอบถัดไปก็ไม่ได้ reset ตัวนี้ซ้ำ — `selectedTemplate` จึงค้างข้ามแคมเปญ

## Goals / Non-Goals

**Goals:**
- เปิด dialog "สร้างแคมเปญ" (ไม่ใช่แก้ไข) ต้องไม่มี template ค้างจากแคมเปญก่อนหน้าเสมอ ไม่ว่าจะมาจาก path ไหน (ปุ่มตรง, fromContent)

**Non-Goals:**
- ไม่แตะ `onOpenChange` ของ Dialog (ทำงานถูกต้องอยู่แล้วสำหรับกรณีปิดด้วย X/Escape)
- ไม่เปลี่ยน state management pattern โดยรวมของ dialog นี้ (เช่น ไม่ refactor เป็น `useReducer`) — ขอบเขตจำกัดแค่แก้จุดที่ตกหล่น

## Decisions

**Decision: เพิ่ม `setSelectedTemplate('')` เข้าไปตรงๆ ใน `openCreateCampaign()` และ fromContent flow แทนการรวม reset logic เป็นจุดเดียว**

- ทางเลือกที่พิจารณา: รวม reset logic ทั้งหมดเป็นฟังก์ชันเดียว (เช่น `resetCampaignFormState()`) แล้วเรียกจากทั้ง 2 จุด (และจาก `onOpenChange` ด้วย) เพื่อกันปัญหาตกหล่นซ้ำในอนาคต — เป็นทางเลือกที่ดีกว่าระยะยาว แต่ต้อง refactor จุดเรียกใช้ที่มีอยู่ 3 จุด (`openCreateCampaign`, fromContent, `onOpenChange`) ซึ่งเกินขอบเขตของ bug fix เล็กๆ นี้
- **เลือกแก้แบบตรงจุด** (เพิ่มบรรทัดเดียวใน 2 จุดที่ตกหล่น) เพราะเป็น bug fix ที่ควร minimal และ scoped — การ refactor รวม logic เป็นเรื่องที่ทำแยกได้ทีหลังถ้าต้องการ ไม่ผูกกับการแก้บั๊กนี้

## Risks / Trade-offs

- [Risk] ถ้ามีจุด reset state เพิ่มในอนาคต (path ใหม่ที่เปิด dialog) อาจตกหล่น `selectedTemplate` ซ้ำอีกได้ เพราะไม่มี single source of truth สำหรับ reset logic → **การรับมือ**: ยอมรับความเสี่ยงนี้สำหรับตอนนี้ เนื่องจากมีแค่ 2 จุดที่เปิด dialog สำหรับ "สร้างใหม่" ในโค้ดปัจจุบัน (ปุ่มตรง กับ fromContent) — ถ้าจุดที่ 3 เกิดขึ้นในอนาคตควรพิจารณา refactor รวม logic ตอนนั้น

## Migration Plan

1. เพิ่ม `setSelectedTemplate('');` ใน `openCreateCampaign()` ([CampaignsPage.tsx:347-353](../../../src/pages/CampaignsPage.tsx:347))
2. เพิ่ม `setSelectedTemplate('');` ใน fromContent flow ([CampaignsPage.tsx:265-274](../../../src/pages/CampaignsPage.tsx:265))
3. ทดสอบด้วยมือ: สร้างแคมเปญ A เลือก template ใดก็ได้ บันทึกสำเร็จ → กด "สร้างแคมเปญ" อีกครั้ง → ยืนยันว่าไม่มี template ติดเครื่องหมายถูกค้างอยู่
4. ทดสอบ flow fromContent เช่นเดียวกัน (ถ้าทดสอบได้ในสภาพแวดล้อม local)
5. รัน `pnpm lint` และ `pnpm build`

Rollback: การเปลี่ยนแปลงจำกัดอยู่ 2 บรรทัดในไฟล์เดียว ไม่มี migration ฐานข้อมูล ย้อนกลับได้ด้วยการ revert commit เดียว

## Open Questions

- ไม่มี — root cause และทางแก้ยืนยันชัดเจนแล้วทั้งจากโค้ดและการทดสอบใช้งานจริง
