## 1. Backend — api/campaign-analytics.php

- [x] 1.1 เพิ่มการคำนวณ CTOR (`total_clicks ÷ total_opens × 100`, ปัดเศษ 1 ตำแหน่ง) ในส่วนสรุปสถิติ พร้อมป้องกันหารด้วยศูนย์เมื่อ `total_opens = 0`
- [x] 1.2 เพิ่มการอ่าน query param `top_sort` (ค่าที่รับ: `opens`, `clicks`, `open_rate`, `click_rate`; default `opens`) และปรับ `ORDER BY` ของ query "Top 5 แคมเปญ" ให้ใช้คอลัมน์ตามค่านั้น
- [x] 1.3 เพิ่ม subquery `(SELECT COUNT(*) FROM email_tracking WHERE campaign_id = ec.id AND status = 'failed') AS total_failed` ในคำสั่ง SELECT ของตาราง "แคมเปญทั้งหมด" (all campaigns, paginated)
- [x] 1.4 อัปเดตส่วน cast ชนิดข้อมูลของ response ให้ครอบคลุมฟิลด์ใหม่ (`ctor`, `total_failed`) เป็นตัวเลขก่อนส่ง JSON กลับ

## 2. Frontend — src/pages/CampaignAnalyticsPage.tsx

- [x] 2.1 เปลี่ยนป้ายชื่อการ์ด `avg_open_rate` จาก "อัตราเปิดเฉลี่ย" เป็น "อัตราเปิดรวม"
- [x] 2.2 เพิ่มการ์ดสรุปสถิติใหม่แสดงค่า CTOR ต่อจากการ์ดอัตราคลิกเฉลี่ย
- [x] 2.3 เปลี่ยน `<LineChart>` แนวโน้มให้ใช้ `dataKey="open_rate"`/`dataKey="click_rate"` แทน `opens`/`clicks` ปรับแกน Y เป็น % และปรับ `<Tooltip>` ให้แสดงจำนวนดิบ (`sent`, `opens`, `clicks`) ควบคู่กับเปอร์เซ็นต์
- [x] 2.4 เพิ่ม `<Select>` dropdown เหนือการ์ด "5 แคมเปญยอดนิยม" ให้เลือกจัดอันดับได้ 4 แบบ (จำนวนเปิด/จำนวนคลิก/อัตราเปิด/อัตราคลิก) และส่งค่า `top_sort` เป็นส่วนหนึ่งของ query key + query string เมื่อดึงข้อมูล
- [x] 2.5 เพิ่มคอลัมน์ "ส่งไม่สำเร็จ" ในตาราง "แคมเปญทั้งหมด" ทั้ง mobile card และ desktop `<Table>`
- [x] 2.6 เพิ่มส่วน summary funnel แสดง 3 ขั้นตอน (ส่ง → เปิด → คลิก) พร้อม % ของแต่ละขั้นเทียบกับยอดส่งทั้งหมด วางไว้ในตำแหน่งที่เหมาะสมของหน้า (เช่น ใต้การ์ดสรุปสถิติ ก่อนกราฟ)

## 3. Verification

- [x] 3.1 ทดสอบ manual บนเบราว์เซอร์: เปิดหน้า `/campaign-analytics` ครบทั้ง 3 ช่วงเวลา (30 วัน/90 วัน/12 เดือน) ตรวจว่า label, กราฟ %, การ์ด CTOR, dropdown จัดอันดับ Top Campaign, คอลัมน์ส่งไม่สำเร็จ, และ funnel แสดงผลถูกต้องตรงกับข้อมูลจริง
- [x] 3.2 ทดสอบกรณีช่วงเวลาที่ไม่มีแคมเปญถูกส่งเลย (`total_sent = 0`) ว่าทุกตัวเลข/กราฟ/funnel แสดง 0 โดยไม่มี error จากการหารด้วยศูนย์
- [x] 3.3 ทดสอบสลับตัวเลือก `top_sort` ทั้ง 4 แบบ ว่าลำดับแคมเปญในการ์ด "Top Campaign" เปลี่ยนตามจริง
- [x] 3.4 รัน `pnpm lint` และ `pnpm build` ให้ผ่านก่อนปิดงาน ตาม Development Rules ข้อ "VERIFY BEFORE DONE"
