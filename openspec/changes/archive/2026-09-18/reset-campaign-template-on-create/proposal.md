## Why

เมื่อผู้ใช้สร้างแคมเปญสำเร็จ (เลือก template ไว้ด้วย) แล้วกดปุ่ม "สร้างแคมเปญ" อีกครั้งเพื่อสร้างแคมเปญใหม่ ระบบยังคงแสดง template เดิมจากแคมเปญก่อนหน้าเป็น "เลือกไว้" (มีเครื่องหมาย ✓ ติดอยู่ที่ template gallery) ทั้งที่กล่องเนื้อหาอีเมล (แท็บ "แก้ไข") ว่างเปล่าจริง — ยืนยันแล้วทั้งจากการไล่โค้ดและจากการใช้งานจริง (ภาพหน้าจอ): template "โปรเฟสชั่นแนลคลาสสิก" ยังติดเครื่องหมายถูกอยู่ ทั้งที่กล่องเนื้อหาแสดง placeholder "เริ่มพิมพ์เนื้อหาบทความ..." ว่างเปล่า

## What Changes

- แก้ `openCreateCampaign()` ใน `CampaignsPage.tsx` ให้ reset `selectedTemplate` กลับเป็นค่าว่าง (`''`) ทุกครั้งที่เปิด dialog สำหรับสร้างแคมเปญใหม่ — เหมือนกับตัวแปรอื่น (`campaignName`, `campaignBody`, `senderName` ฯลฯ) ที่ reset อยู่แล้วในฟังก์ชันนี้ แค่ `selectedTemplate` ตัวเดียวที่ตกหล่น
- แก้จุดเดียวกันที่ flow "ดึงคอนเทนต์จากบทความมาสร้างแคมเปญ" (fromContent navigation, `CampaignsPage.tsx` บรรทัด ~265-274) ซึ่งพบว่าตกหล่นการ reset `selectedTemplate` เช่นเดียวกัน
- ไม่แก้ dialog `onOpenChange` ที่มี reset ครบถ้วนอยู่แล้ว (ทำงานถูกต้องเวลาปิดด้วย X/Escape/คลิกนอกกรอบ) — ปัญหาอยู่ที่เส้นทางบันทึกสำเร็จ ซึ่งปิด dialog แบบ `setIsCampaignDialogOpen(false)` ตรงๆ ไม่ผ่าน `onOpenChange`

## Capabilities

### New Capabilities
(ไม่มี)

### Modified Capabilities
- `email-campaign-template-picker`: เพิ่ม requirement ใหม่ว่าการเปิด dialog สำหรับสร้างแคมเปญใหม่ (ไม่ใช่แก้ไขแคมเปญเดิม) ต้องไม่มี template ค้างจากแคมเปญก่อนหน้า

## Impact

- **Frontend**: `src/pages/CampaignsPage.tsx` เท่านั้น — แก้ 2 จุด (`openCreateCampaign()` และ fromContent flow) เพิ่ม `setSelectedTemplate('')` จุดละ 1 บรรทัด
- ไม่มีการเปลี่ยนแปลงฝั่ง backend, ฐานข้อมูล, หรือ API
- ไม่เกี่ยวข้องกับ change "campaign-recipient-combobox-chips" ที่ archive ไปแล้วก่อนหน้า — เป็นคนละ state/คนละ component กัน
