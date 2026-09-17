## Why

ในไดอะล็อก "สร้าง/แก้ไขแคมเปญ" (`CampaignsPage.tsx`) เมื่อผู้ใช้พิมพ์เนื้อหาอีเมลใน section "เนื้อหาอีเมล" แล้วคลิกแท็บ "👁 ตัวอย่าง" ทันทีหลังพิมพ์ตัวอักษรสุดท้าย (พฤติกรรมทั่วไปมาก) เนื้อหาที่เพิ่งพิมพ์จะหายไปทั้งหมด — ไม่ใช่แค่ preview ไม่แสดง แต่สลับกลับไปแท็บ "แก้ไข" ก็เจอกล่องข้อความว่างเปล่าเช่นกัน ยืนยันแล้วด้วยการรีโปรดิวซ์จริงในเบราว์เซอร์ นี่คือบั๊กที่ทำให้ข้อมูลผู้ใช้สูญหายจริง ไม่ใช่แค่การแสดงผลผิดพลาด จึงต้องแก้ก่อนบั๊ก preview อื่นๆ ที่เกี่ยวข้อง

## What Changes

- แก้ `ArticleEditor.tsx` ไม่ให้การอัปเดตเนื้อหากลับไปยัง parent (`onChange`) สูญหายเมื่อ component ถูก unmount ก่อนที่ `requestAnimationFrame` ที่ค้างอยู่จะทำงาน — ปัจจุบัน `onUpdate` เรียก `onChange(editor.getHTML())` แบบ deferred ผ่าน `requestAnimationFrame`; ถ้า editor ถูก destroy ก่อนเฟรมถัดไปมาถึง (เช่นตอน Radix Tabs unmount panel ที่ไม่ active) การอัปเดตนั้นจะหายไปเงียบๆ
- แก้ไดอะล็อกสร้าง/แก้ไขแคมเปญไม่ให้ Radix `Tabs` unmount `ArticleEditor` ออกจาก DOM ระหว่างสลับแท็บ "แก้ไข"/"ตัวอย่าง" (เช่น คง mount ไว้เสมอแล้วซ่อนด้วย CSS แทนการ unmount) เพื่อตัดปัญหาการแข่งกันของ timing ที่ต้นเหตุ แทนที่จะพยายามไล่ปิดทุก race condition ที่อาจเกิดจากการ unmount กะทันหัน

## Capabilities

### New Capabilities

- `email-campaign-body-editor-sync`: กำหนดพฤติกรรมว่าเนื้อหาที่ผู้ใช้พิมพ์ใน section "เนื้อหาอีเมล" ของไดอะล็อกสร้าง/แก้ไขแคมเปญ ต้องไม่สูญหายเมื่อสลับไปมาระหว่างแท็บ "แก้ไข" และ "ตัวอย่าง" ไม่ว่าจะสลับเร็วแค่ไหนหลังพิมพ์

### Modified Capabilities

(ไม่มี — บั๊กนี้ไม่กระทบ requirement ที่มีอยู่ของ `email-campaign-template-picker`)

## Impact

- **ไฟล์ที่คาดว่าต้องแก้:** `src/components/content/ArticleEditor.tsx` (จุด `onUpdate`/`onChange` sync), `src/pages/CampaignsPage.tsx` (โครงสร้าง `Tabs`/`TabsContent` ของ section เนื้อหาอีเมล)
- **ผลกระทบ:** ทุกจุดที่ใช้ `ArticleEditor` ภายใน `Tabs` ที่สลับ mount/unmount ได้ — ชัดเจนที่สุดคือไดอะล็อกสร้าง/แก้ไขแคมเปญอีเมล อาจกระทบหน้าเขียนคอนเทนต์อื่นที่ใช้ `ArticleEditor` ร่วมกับ `Tabs` ลักษณะเดียวกันด้วย (ต้องตรวจสอบระหว่าง implement)
- ไม่มี database migration, ไม่มี breaking change ต่อ API
