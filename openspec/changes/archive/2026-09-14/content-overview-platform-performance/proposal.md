## Why

แท็บ "ภาพรวม" ของแดชบอร์ดคอนเทนต์ในปัจจุบันเป็น operational snapshot ล้วนๆ (คิวเผยแพร่, เผยแพร่ล้มเหลว, คอนเทนต์ค้างท่อ, เนื้อหาล่าสุด, สถานะ, กำหนดการ) — ตอบได้แค่ "ต้องทำอะไรวันนี้" แต่ไม่มีตัวเลขผลลัพธ์ (engagement) เลยแม้แต่ตัวเดียว ผู้ใช้ที่อยากรู้ว่าคอนเทนต์ที่ผลิตไปสร้างผลตอบรับบ้างไหม หรือแพลตฟอร์มไหนทำงานดีกว่ากัน ต้องสลับไปแท็บ "วิเคราะห์" ทุกครั้ง ทั้งที่เป็นคำถามที่ถามพร้อมกับงาน operational ในหน้าเดียวกันบ่อยครั้ง

## What Changes

- เพิ่มแถบสรุป 4 การ์ด (Engagement รวม, โพสต์ที่วัดได้, ไลก์รวม, Engagement เฉลี่ย/โพสต์) แบบ all-time snapshot ไว้บนสุดของแท็บภาพรวม — ไม่ผูกช่วงเวลา
- เพิ่มกราฟ "แนวโน้ม Engagement" (เส้นเดียว) เป็นแถวใหม่ใต้การ์ด ควบคุมด้วยตัวเลือกช่วงเวลา 7/30/90 วัน โดย granularity ของแกน x ปรับอัตโนมัติตามช่วงที่เลือก (7 วัน = รายวัน, 30 วัน = รายสัปดาห์, 90 วัน = รายเดือน)
- เพิ่มตาราง "ประสิทธิภาพแต่ละแพลตฟอร์ม" (Platform, Posts, Engagement รวม, Engagement เฉลี่ย/โพสต์ เรียงมาก→น้อยตามคอลัมน์หลัง) เป็น widget ใหม่ที่ล่างสุดของหน้า ควบคุมด้วยตัวเลือกช่วงเวลาของตัวเอง (วัน = วันนี้, สัปดาห์ = 7 วันล่าสุด, เดือน = 30 วันล่าสุด) แยกอิสระจากตัวเลือกของกราฟด้านบน แพลตฟอร์มที่ไม่มีโพสต์ในช่วงที่เลือกยังคงแสดงแถวไว้ (ไม่ซ่อน) โดยคอลัมน์ Engagement เฉลี่ย/โพสต์ แสดง "—"
- ขยาย `api/content-analytics.php?action=overview` ให้คืนข้อมูลเพิ่ม 3 กลุ่มใหม่สำหรับ 3 widget ข้างต้น โดยไม่แก้ไขโครงสร้าง `queue`/`funnel`/`aging`/`assets` เดิม
- ปรับลำดับ section ของแท็บภาพรวม (ดูหัวข้อ Capabilities → `content-dashboard-layout`)
- ยังไม่รวม: engagement rate (%), ตัวเลขเทียบ % จากช่วงก่อนหน้า (เก็บไว้เวอร์ชันถัดไป)

## Capabilities

### New Capabilities
- `content-overview-social-performance`: 3 widget ใหม่ในแท็บภาพรวม (การ์ดสรุป Engagement all-time, กราฟแนวโน้ม Engagement ตามช่วงเวลา, ตารางประสิทธิภาพแยกแพลตฟอร์ม) รวมถึง endpoint fields ที่รองรับ

### Modified Capabilities
- `content-dashboard-layout`: ลำดับ section ของแท็บภาพรวมเปลี่ยนจาก 3 แถว (เผยแพร่ล้มเหลว+ค้าง / เนื้อหาล่าสุด+สถานะ / คิว+กำหนดการ) เป็น 5 ส่วน: การ์ดสรุป Engagement → กราฟแนวโน้ม Engagement → 3 แถวเดิม (ไม่เปลี่ยนลำดับภายใน) → ตารางประสิทธิภาพแยกแพลตฟอร์ม
- `content-dashboard-bi-widgets`: `?action=overview` คืน JSON เพิ่มจาก 4 กลุ่มเดิม (`queue`, `funnel`, `aging`, `assets`) เป็น 7 กลุ่ม โดยเพิ่ม `social_snapshot`, `engagement_trend`, `platform_performance`

## Impact

- **Backend**: `api/content-analytics.php` — เพิ่ม query สำหรับ 3 กลุ่มใหม่ใน action `overview` (aggregate จาก `content_post_metrics`, ต้อง LEFT JOIN รายชื่อแพลตฟอร์มทั้งหมดเพื่อให้แพลตฟอร์มที่ไม่มีโพสต์ในช่วงยังปรากฏแถวได้)
- **Frontend**: `src/pages/ContentDashboardPage.tsx` (จัดลำดับ section ใหม่), component ใหม่สำหรับการ์ดสรุป/กราฟแนวโน้ม/ตารางประสิทธิภาพ (ภายใต้ `src/components/content/`), `src/hooks/useContent.ts` (ขยาย type ของ `useContentOverview`), `src/components/content/types.ts` (เพิ่ม type สำหรับ response กลุ่มใหม่)
- **ไม่มี DB migration** — ข้อมูลทั้งหมดมาจากตารางที่มีอยู่แล้ว (`content_post_metrics`, `content_items`, `publish_channels`)
- ไม่กระทบแท็บ "วิเคราะห์" หรือ endpoint `?action=analytics` เดิม
