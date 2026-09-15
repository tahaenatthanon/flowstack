## Why

`MarketingPage.tsx` (route `/marketing`) มีแท็บ "รายงาน" (analytics) ที่ไม่มีการระบุไว้ในเอกสาร ซึ่งคำนวณข้อมูลชุดเดียวกับที่หน้า `CampaignAnalyticsPage.tsx` (route `/campaign-analytics`) ทำอยู่แล้วซ้ำอีกรอบ — แต่คำนวณฝั่ง client แบบ all-time ไม่มีตัวกรองช่วงเวลา ในขณะที่หน้า `/campaign-analytics` คำนวณฝั่ง server พร้อมตัวกรองช่วงเวลาที่ถูกต้อง มีกราฟแนวโน้ม และมีอันดับแคมเปญยอดนิยม `docs/features.md` ระบุไว้ว่า `/marketing` มีหน้าที่แค่ "สร้าง & ส่งอีเมล" เท่านั้น — ไม่เคยกำหนด scope ให้มี analytics การมีข้อมูลซ้ำสองที่นี้ทำให้ค่าเดียวกัน (เช่น อัตราเปิดเฉลี่ย หรือ "แคมเปญที่ดีที่สุด") แสดงตัวเลขไม่ตรงกันได้ ทั้งที่แต่ละค่าถูกต้องในตัวมันเอง ซึ่งทำให้ผู้ใช้เข้าใจผิดว่าระบบมีบั๊กด้านข้อมูล

ต้นตอส่วนหนึ่งของความคลาดเคลื่อนนี้มาจากบั๊กจริง: ตัวกรองช่วงเวลาใน `campaign-analytics.php` กรองด้วย `created_at` แทนที่จะเป็น `sent_at` ทำให้แคมเปญที่ถูกส่งภายในช่วงเวลาที่เลือก แต่ถูกสร้างไว้ก่อนหน้านั้น ถูกตัดออกจากผลสรุปและอันดับแคมเปญยอดนิยมอย่างเงียบๆ (กราฟแนวโน้มกรองด้วย `sent_at` ถูกต้องอยู่แล้ว)

## What Changes

- **BREAKING (เฉพาะ UI ภายใน ไม่กระทบ API contract):** ตัดแท็บ "รายงาน" ออกจาก `MarketingPage.tsx` ทั้งหมด — ทั้ง TabsTrigger, TabsContent และ state/ค่าที่คำนวณไว้ซึ่งใช้เฉพาะแท็บนี้ (`sentCampaigns`, `totalOpens`, `totalClicks`, `avgOpenRate`, `avgClickRate`, `bestCampaigns`) การ์ดสรุปที่มีอยู่แล้วในแท็บ "แคมเปญ" (แบบ all-time ไม่กรองช่วงเวลา) ยังคงอยู่เป็นจุดดูข้อมูลเร็วๆ บนหน้านี้ ส่วน analytics แบบเต็ม (ตัวกรองช่วงเวลา, กราฟแนวโน้ม, สัดส่วนสถานะ, อันดับ top-5) อยู่ที่ `/campaign-analytics` เพียงที่เดียว ซึ่งเข้าถึงได้จากเมนูข้าง ("วิเคราะห์แคมเปญ") อยู่แล้ว
- แก้ตัวกรองช่วงเวลาใน `api/campaign-analytics.php` — เฉพาะ query การ์ดสรุปสถิติ และ query "5 แคมเปญยอดนิยม" — จาก `sent_at >= cutoff` แทนที่ `created_at >= cutoff` ให้ตรงกับ query กราฟแนวโน้มที่ทำถูกอยู่แล้ว แคมเปญที่สถานะเป็น `sending` และ `sent_at` ยังเป็น NULL จะถูกตัดออกจากผลลัพธ์ที่กรองตามช่วงเวลาจนกว่าจะส่งเสร็จ (ตั้งใจให้เป็นแบบนี้ ไม่ใช่ผลข้างเคียง เพราะสถิติระหว่างกำลังส่งยังไม่นิ่ง)
- แก้ breadcrumb ที่ค้างอยู่บน `/campaign-analytics` — จาก `{ label: 'การตลาด', href: '/marketing' }` เป็น `{ label: 'แคมเปญอีเมล', href: '/marketing' }` ให้ตรงกับชื่อหน้า `/marketing` ปัจจุบัน (เปลี่ยนชื่อไปแล้วในงานก่อนหน้านี้)

## Capabilities

### New Capabilities
- `email-campaign-analytics`: กำหนดว่า analytics ประสิทธิภาพแคมเปญ (สรุปสถิติ, ตัวกรองช่วงเวลา, อันดับแนวโน้ม/แคมเปญยอดนิยม) อยู่ที่เดียวเท่านั้น (`/campaign-analytics`) คำนวณฝั่ง server และกรองตามวันที่ส่งจริง โดย `/marketing` จะไม่แสดงข้อมูลชุดนี้ซ้ำอีก

### Modified Capabilities
(ไม่มี — ยังไม่มี spec เดิมที่ระบุพฤติกรรมนี้ไว้)

## Impact

- **Frontend:** `src/pages/MarketingPage.tsx` (ตัดแท็บ analytics และ state ที่ตายแล้วออก), `src/pages/CampaignAnalyticsPage.tsx` (แก้แค่ label ของ breadcrumb)
- **Backend:** `api/campaign-analytics.php` (แก้ query filter 2 จุด: query สรุปสถิติ, query 5 แคมเปญยอดนิยม)
- **ไม่มีการเปลี่ยนแปลง database schema** ไม่มีการเปลี่ยนรูปแบบ response ของ API (field เดิมทุกอย่าง แค่แก้ filter ให้ถูก) — ผู้ใช้งาน `campaign-analytics.php` เดิมจะได้ผลลัพธ์ที่แม่นยำขึ้น ไม่กระทบ contract
- **ไม่มีการเปลี่ยน route** — `/marketing` และ `/campaign-analytics` ยังใช้ URL เดิม มีแค่จำนวนแท็บบน `/marketing` ที่ลดลง 1 แท็บ
