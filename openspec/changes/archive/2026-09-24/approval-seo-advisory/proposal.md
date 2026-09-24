## Why

ตอนนี้ SEO/AEO Quality Gate บล็อกทั้งตอน "ขออนุมัติ" และตอน "เผยแพร่จริง" (2 จุดอิสระ ประเมินใหม่ทุกครั้ง) ทำให้ manager ไม่มีสิทธิ์ตัดสินใจเองว่าจะอนุมัติคอนเทนต์ที่ SEO ยังไม่ผ่านครบทุกข้อหรือไม่ — ทั้งที่ควรเป็นดุลยพินิจของ manager ตอนเห็นเนื้อหาจริง ไม่ใช่กฎที่ระบบตัดสินแทน นอกจากนี้ผล SEO/AEO ในหน้ารายการอนุมัติก็ถูกซ่อนไว้จนกว่าจะกด "อนุมัติ" ก่อน (เปิด popup ถึงจะเห็น) ทำให้ manager ตัดสินใจโดยไม่เห็นข้อมูลตั้งแต่แรก และคอลัมน์ปุ่มจัดการในตารางรายการก็ทำให้กดอนุมัติได้โดยไม่เปิดดูเนื้อหาเลย

## What Changes

- **ตัด SEO/AEO Quality Gate ออกจากจุดขออนุมัติ**: `content_quality_gate_check()` ไม่ถูกเรียกจาก `api/approvals.php` และ `PUT api/content-items.php` (ตั้ง `status=pending_approval`) อีกต่อไป — ขออนุมัติได้เสมอไม่ว่าผล SEO/AEO จะเป็นอย่างไร (ยังเช็ค Approval gate/Platform gate อื่นตามเดิม)
- **ตัด SEO/AEO Quality Gate ออกจากจุดเผยแพร่จริง**: `final_publish_gate_check()` ไม่เรียก `quality_required_gate()` อีกต่อไป — เผยแพร่ได้ทันทีที่ผ่าน Approval gate + Platform gate โดยไม่สนผล SEO/AEO ไม่ว่า manager จะอนุมัติคอนเทนต์ที่ SEO ผ่านหรือไม่ผ่านก็ตาม
- **Generate ไม่เปลี่ยน**: ยัง evaluate SEO/AEO + AI repair สูงสุด 1 รอบเหมือนเดิมทุกอย่าง (เป้าหมายคุณภาพตอนสร้างยังคงอยู่ แค่ไม่ใช้ตัดสิน block/allow ที่ขั้นอนุมัติ/เผยแพร่อีกต่อไป)
- **ย้ายจุดแสดงผล SEO/AEO ในฝั่งอนุมัติ**: `ContentDetailView` (`context='approval'`) ดึงและแสดงผล SEO/AEO **ทันทีที่เปิดดูเนื้อหา** (ไม่ต้องรอกดปุ่ม "อนุมัติ" ก่อน) — ส่วน dialog ยืนยันอนุมัติ (ทั้งใน `ContentDetailView` และเดิมใน `ContentApprovalTab`) **ไม่แสดง** SEO/AEO checklist ซ้ำอีก (เห็นไปแล้วตอนเปิดดู)
- **BREAKING (UI)**: ตัดคอลัมน์ "จัดการ" และปุ่ม อนุมัติ/ขอแก้ไข/ปฏิเสธ ออกจากแถวตารางในแท็บ "รายการอนุมัติ" ทั้งหมด — การอนุมัติ/ขอแก้ไข/ปฏิเสธ ทำได้จากหน้ารายละเอียดเนื้อหา (คลิกแถว → เปิดดู) เท่านั้น บังคับให้ manager เปิดดูเนื้อหา (และเห็น SEO/AEO) ก่อนตัดสินใจเสมอ

## Capabilities

### New Capabilities
- `approval-detail-quality-display`: การแสดงผล SEO/AEO ในหน้ารายละเอียดฝั่งอนุมัติ — ดึงและแสดงทันทีตอนเปิดดู เป็นข้อมูลประกอบการตัดสินใจเท่านั้น ไม่บล็อกปุ่มอนุมัติ และไม่แสดงซ้ำใน dialog ยืนยัน

### Modified Capabilities
- `quality-required-gate`: `quality_required_gate()` เลิกถูกเรียกจากเส้นทางขออนุมัติและเผยแพร่ (`content_quality_gate_check()`, `final_publish_gate_check()`, cron `publish-scheduler.php`) — ยังใช้ที่ Generate เหมือนเดิม
- `content-approval-list`: ตัดคอลัมน์ "จัดการ" และปุ่ม 3 ปุ่มในแถวตารางออกทั้งหมด (ไม่มี action ในตารางอีกต่อไป)

## Impact

- **Backend**: `api/lib/publish-dispatch.php` (`content_quality_gate_check()`, `final_publish_gate_check()`), `api/approvals.php`, `api/content-items.php`, `api/cron/publish-scheduler.php` — เอาการเรียก quality gate ออกจากจุดขออนุมัติ/เผยแพร่ (ฟังก์ชัน `quality_required_status()`/`quality_required_gate()` เองไม่เปลี่ยน ยังใช้ตอน Generate)
- **Frontend**: `src/components/content/tabs/ContentApprovalTab.tsx` (ตัดคอลัมน์/ปุ่มในตาราง, ตัด SEO/AEO ออกจาก approve-confirm dialog), `src/components/content/views/ContentDetailView.tsx` (ย้าย fetch SEO/AEO จาก trigger ด้วยปุ่มอนุมัติ เป็น trigger ตอนเปิด view, ตัดออกจาก approve-confirm step)
- **ไม่มี migration**: ไม่มีการเปลี่ยนโครงสร้างตาราง
- **ไม่อยู่ในขอบเขต**: Quality Gate ตอน Generate (ยังคงเดิมทุกอย่าง รวม AI repair 1 รอบ), Approval gate/Platform gate (ยังบล็อกเหมือนเดิม — แค่ SEO/AEO เท่านั้นที่เปลี่ยนจากบล็อกเป็นข้อมูลประกอบ), การเชื่อมต่อ credential platform อื่นนอกจาก Facebook, ระบบ KPI target + feedback loop (คนละเรื่อง คนละ change)
