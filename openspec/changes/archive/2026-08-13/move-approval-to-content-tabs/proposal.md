## Why

เมนู "รายการอนุมัติ" ปัจจุบันเป็นรายการย่อยใน Sidebar ฝั่ง "การตลาด" แยกจากหน้า "ผลงานคอนเทนต์" ทั้งที่เกี่ยวข้องกันโดยตรง — ผู้อนุมัติต้องสลับหน้าไป-มาเพื่อดูผลงานและอนุมัติ ควรย้ายเข้าอยู่ใน Tab Menu ของหน้าผลงานคอนเทนต์เพื่อรวม workflow คอนเทนต์ไว้ที่เดียว

## What Changes

- ลบรายการเมนู "รายการอนุมัติ" ออกจาก Sidebar (`AppSidebar.tsx`)
- เพิ่ม Tab "รายการอนุมัติ" ใน `ContentPage` โดยวางถัดจาก Tab "ผลงานทั้งหมด" ทันที
- แยกเนื้อหารายการอนุมัติออกเป็นคอมโพเนนต์ `ContentApprovalTab` (ไม่มี PageShell) เพื่อให้ใช้ร่วมกันระหว่าง Tab (ใน `ContentPage`) และ route `/content-approval` (ถ้ายังคงไว้)
- ปรับ grid ของ TabsList จาก `grid-cols-4` เป็น `grid-cols-5` (รองรับ tab ใหม่)

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `content-approval-list`: รายการอนุมัติย้ายไปแสดงเป็น Tab ในหน้าผลงานคอนเทนต์ (ไม่ใช่หน้า/route แยกใน Sidebar)

## Impact

- **Frontend**:
  - `src/components/AppSidebar.tsx` — ลบรายการเมนู "รายการอนุมัติ"
  - `src/pages/ContentPage.tsx` — เพิ่ม Tab "รายการอนุมัติ" ถัดจาก "ผลงานทั้งหมด"
  - `src/components/content/tabs/ContentApprovalTab.tsx` — คอมโพเนนต์ใหม่ (เนื้อหาที่แยกจาก `ContentApprovalPage`)
  - `src/pages/ContentApprovalPage.tsx` — refactor ให้ใช้ `ContentApprovalTab` (ถ้าคง route `/content-approval`)
- **Backend**: ไม่มีการแก้ไข
- **Database**: ไม่มีการแก้ไข
