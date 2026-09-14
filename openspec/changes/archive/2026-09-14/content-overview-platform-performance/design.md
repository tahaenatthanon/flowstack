## Context

แท็บ "ภาพรวม" ของ `ContentDashboardPage` (`src/pages/ContentDashboardPage.tsx`) และแท็บ "วิเคราะห์" ใช้ endpoint คนละ action ของไฟล์เดียวกัน (`api/content-analytics.php`) โดยตั้งใจแยกเจตนาไว้ชัดเจน:

- `?action=overview` → snapshot ปัจจุบัน ไม่มีช่วงวันที่ ใช้กับ operational widget (คิว, ล้มเหลว, ค้างท่อ) — คำนวณเบา ไม่มี external dependency (มาจาก `content_items`/`content_publish_queue` ล้วนๆ)
- `?action=analytics` → ผูกช่วงวันที่ที่ผู้ใช้เลือก (`ReportDateFilter`) ใช้กับ deep-dive widget (throughput, lead time, SEO, social engagement) — พึ่งข้อมูล sync จากภายนอก (`content_post_metrics`, cron `content-metrics-sync`)

แท็บภาพรวมปัจจุบันไม่มีตัวเลขผลลัพธ์ (engagement) เลย ผู้ใช้ต้องสลับไปแท็บวิเคราะห์ > โซเชียลทุกครั้งเพื่อดู "แยกตามแพลตฟอร์ม" ที่มีอยู่แล้ว (`AnalyticsSocialTab.tsx`) การออกแบบนี้เพิ่มเวอร์ชันย่อของข้อมูลเดียวกันไว้ในภาพรวม โดยไม่ดึงทั้ง sub-tab มาไว้ตรงนั้น (ตามที่ตกลงระหว่าง explore session)

ข้อจำกัดสำคัญที่ต้องคำนึงถึง (จากของเดิมในระบบ):
- `content_post_metrics.views` สำหรับ Facebook feed post คืน `0` เสมอ (ข้อจำกัดของ Graph API ไม่ใช่บั๊ก — ดูคอมเมนต์ hint ใน `AnalyticsSocialTab.tsx`) ดังนั้น widget ใหม่ทั้งหมดในการเปลี่ยนแปลงนี้ **ไม่ใช้ views เป็นตัวหาร** (ไม่มี engagement rate)
- ข้อมูล engagement ทั้งหมดพึ่ง cron sync ที่ครอบคลุมเฉพาะ Facebook/Instagram ในเฟสนี้ — แพลตฟอร์มอื่นจะไม่มีข้อมูลเลย ไม่ใช่ 0

## Goals / Non-Goals

**Goals:**
- ให้แท็บภาพรวมตอบคำถาม "คอนเทนต์ที่ผลิตไปสร้างผลตอบรับบ้างไหม" ได้แบบเร็วๆ โดยไม่ต้องสลับแท็บ
- คงเส้นแบ่ง "overview เบา / analytics หนัก" ไว้ — ขยาย action เดิม ไม่สร้าง endpoint ใหม่
- ไม่แสดงตัวเลขที่อาจทำให้เข้าใจผิด (0 ปลอมจากการหารด้วย views, หรือแพลตฟอร์มที่ยังไม่เคย sync)

**Non-Goals:**
- Engagement rate (%), ตัวเลขเทียบ % จากช่วงก่อนหน้า (deferred — เก็บไว้เวอร์ชันถัดไป)
- Followers/Reach/Impressions ระดับเพจ (ยังไม่มี OAuth page insights integration — เฟสถัดไปของระบบ ไม่ใช่ของ change นี้)
- แก้ไข/รวมแท็บวิเคราะห์ > โซเชียล — คงอยู่แยกกันเหมือนเดิม ไม่ redirect หรือลบอะไรออก

## Decisions

### 1. ขยาย `?action=overview` เดิม แทนที่จะสร้าง action/endpoint ใหม่
เพิ่ม 3 กลุ่มข้อมูลใหม่ (`social_snapshot`, `engagement_trend`, `platform_performance`) เข้าไปใน response เดิมที่มี `queue`/`funnel`/`aging`/`assets` อยู่แล้ว เหตุผล: `useContentOverview()` มีอยู่แล้วเป็น 1 query ต่อการเปิดแท็บภาพรวม (ตาม pattern ที่ `useContentAnalytics()` ใช้กับแท็บวิเคราะห์) การเพิ่ม endpoint ใหม่จะทำให้แท็บภาพรวมยิง 2 query แทนที่จะเป็น 1 โดยไม่มีเหตุผลด้าน caching/staleTime ที่ต่างกันมากพอจะแยก — ทั้ง 3 กลุ่มใหม่ใช้ `staleTime: 60_000` เดียวกับกลุ่มเดิมของ action นี้ได้เลย

ทางเลือกที่พิจารณาแล้วไม่เลือก: เรียก `?action=analytics` ซ้ำ (มีข้อมูล `social.by_platform` อยู่แล้ว) — ปัดตกเพราะ `analytics` action คำนวณ throughput/lead_time/seo/plan_conversion ที่ภาพรวมไม่ใช้เลย เสียของโดยไม่จำเป็น และทำให้ขอบเขตความหมายของ `overview` (เบา, ไม่มี dependency ภายนอก) เพี้ยนไป

### 2. การ์ดสรุป 4 ใบเป็น all-time snapshot ไม่มี query param
ต่างจากกราฟและตารางที่มีตัวเลือกช่วงเวลา การ์ดสรุปคำนวณจากข้อมูลทั้งหมดที่เคย sync มา (ไม่กรองวันที่) เหตุผล: รักษาความเรียบง่ายของ "สิ่งแรกที่เห็น" ให้เป็นตัวเลขเดียวไม่มีตัวแปรผัน ต่างจากกราฟ/ตารางที่ผู้ใช้ต้องการเปรียบเทียบช่วงเวลาโดยเจตนา — และเลี่ยงมีตัวควบคุม 3 ชุด (การ์ด, กราฟ, ตาราง) ซ้อนกันในหน้าเดียวที่ทำงานคนละแบบ (ประเด็นที่พิจารณาระหว่าง explore session แล้วตัดสินใจแยกความรับผิดชอบของแต่ละตัวควบคุมให้ชัด)

### 3. กราฟแนวโน้ม Engagement: auto-bucket ตามช่วงที่เลือก ไม่มี granularity toggle แยก
Mapping ตายตัว: `7 วัน` → จุดรายวัน (7 จุด), `30 วัน` → จุดรายสัปดาห์ (~4-5 จุด), `90 วัน` → จุดรายเดือน (~3 จุด) เหตุผล: หลีกเลี่ยงคอมโบที่ไม่มีความหมาย (เช่น ช่วง 7 วัน + granularity เดือน จะเหลือแค่ 1 จุด) โดยไม่ต้องเขียน guard ฝั่ง UI คอยปิดตัวเลือกที่ไม่สมเหตุสมผล — ผูก mapping ไว้ที่ backend query โดยตรง เมตริกที่พล็อตคือ `engagement` (views+likes) เส้นเดียว **ไม่รวม views** เพื่อเลี่ยงกับดักข้อ Context ด้านบน

### 4. ตารางประสิทธิภาพแยกแพลตฟอร์ม: ตัวเลือกช่วงเวลาของตัวเอง ชื่อไม่ซ้ำกับกราฟ
ใช้ป้าย "วัน / สัปดาห์ / เดือน" (แทนที่จะเป็น "7/30/90 วัน" แบบกราฟ) แม้ทั้งคู่จะเป็น date-range control คล้ายกัน เหตุผล: ป้องกันความสับสนที่มี selector รูปแบบเดียวกัน 2 จุดในหน้าเดียวที่ query คนละคำ (คนละ SQL, คนละความหมาย) — ตั้งชื่อให้ต่างกันชัดเจนเพื่อสื่อว่าเป็นคนละตัวควบคุม นิยามช่วงเวลา: `วัน` = วันนี้ (00:00 ถึงปัจจุบัน), `สัปดาห์` = 7 วันล่าสุดนับจากวันนี้ย้อนหลัง (rolling), `เดือน` = 30 วันล่าสุด (rolling) — ไม่ใช้ปฏิทินสัปดาห์/เดือนตามปฏิทิน เพื่อให้สอดคล้องกับตัวเลือก "7/30/90 วัน" ของกราฟที่เป็น rolling window เช่นกัน (ความสม่ำเสมอของนิยาม แม้ป้ายชื่อจะต่างกัน)

### 5. Platform completeness: LEFT JOIN รายชื่อแพลตฟอร์มที่ตั้งค่าไว้ (`publish_channels`)
เพื่อให้แพลตฟอร์มที่ไม่มีโพสต์ในช่วงที่เลือกยังปรากฏแถวด้วยค่า `—` (ตามมติ explore session) query ของตารางต้องเริ่มจาก `SELECT DISTINCT platform FROM publish_channels WHERE tenant_id = ? AND is_active = 1` เป็น base list แล้ว `LEFT JOIN` ผลรวม engagement ของแต่ละแพลตฟอร์มในช่วงที่เลือกเข้าไป — ต่างจาก `by_platform` ของ action `analytics` เดิมที่สร้างจากแถวผลลัพธ์ที่มีข้อมูลจริงเท่านั้น (ไม่มี base list) ดู "Open Questions" สำหรับกรณีแพลตฟอร์มที่ถูกปิดใช้งาน (`is_active=0`) แต่เคยมีโพสต์ในอดีต

### 6. สูตรคำนวณ
- `engagement` = `views + likes` (คงสูตรเดิมจาก `content-analytics.php` ทั้งระบบ)
- `engagement เฉลี่ย/โพสต์` = `engagement / posts` เมื่อ `posts > 0` มิฉะนั้นเป็น `null` (frontend แสดง `—`)
- ไม่มี migration — ทุกฟิลด์คำนวณจากตารางที่มีอยู่แล้ว (`content_post_metrics`, `content_items`, `publish_channels`)

## Risks / Trade-offs

- **[ความเสี่ยง] ข้อมูล engagement พึ่ง cron sync ภายนอก (Facebook/Instagram) — ถ้า sync ค้างหรือแอป Facebook ติด permission/mode issue เลขที่เห็น "แรกสุด" ตอนเปิดภาพรวมทุกวันจะนิ่ง/ผิด โดยไม่มีสัญญาณเตือนในตัว widget เอง** → Mitigation: ใช้ pattern `has_data`/`last_fetched_at` เดียวกับที่ `AnalyticsSocialTab.tsx` มีอยู่แล้ว (แสดง "—" ไม่ใช่ "0" เมื่อยังไม่เคย sync) และพิจารณาใส่ label เวลาที่ sync ล่าสุดไว้ในการ์ด/กราฟด้วยเพื่อความโปร่งใส
- **[ความเสี่ยง] การวางการ์ด+กราฟไว้เหนือ "ต้องดำเนินการ" (เผยแพร่ล้มเหลว/ค้างท่อ) เปลี่ยน priority ของหน้าที่ตั้งใจไว้แต่แรกว่าเป็น triage tool** → Mitigation: เป็นการตัดสินใจโดยเจตนาที่ยืนยันชัดเจนระหว่าง explore session ไม่ใช่ผลข้างเคียง — บันทึกไว้ตรงนี้เพื่อให้ผู้ทดสอบ/ผู้ใช้ทราบว่าเป็นการเปลี่ยน priority หน้าจริง หากพบว่าใช้งานแล้วพลาดงานด่วนบ่อยขึ้น ให้พิจารณาย้อนกลับเป็นตัวเลือกที่เคยพิจารณาไว้ (วางไว้ใต้แถว action-item แทน)
- **[ความเสี่ยง] payload ของ `?action=overview` โตขึ้น (4 → 7 กลุ่ม) ทุกครั้งที่เปิดแท็บภาพรวม แม้ผู้ใช้จะไม่ได้ scroll ลงไปดูตารางท้ายหน้า** → Mitigation: ยังเป็น 1 query round-trip เท่าเดิม (ไม่ได้แย่ลงเชิงจำนวน request) และ query ใหม่ทั้ง 3 กลุ่มเป็น aggregate query แบบเดียวกับที่มีอยู่แล้วใน action `analytics` (ไม่ใช่ pattern ใหม่ที่ไม่เคย profile) ถ้าพบว่าหน่วงจริงค่อยพิจารณา lazy-load ตารางแยกทีหลัง

## Migration Plan

ไม่มี DB migration ทุกฟิลด์เป็น additive บน response JSON เดิม (ไม่ลบ/เปลี่ยนชื่อ key เดิม) จึง deploy ได้แบบปกติ (backend ก่อนหรือพร้อมกับ frontend ก็ได้ เพราะ frontend เดิมไม่อ่าน key ใหม่จึงไม่พัง) Rollback: revert commit ฝั่ง frontend/backend ตามปกติ ไม่ต้องย้อน schema

## Open Questions

- **Base platform list สำหรับ LEFT JOIN**: ใช้ `publish_channels` ที่ `is_active=1` เท่านั้น (ตามข้อ 5) หรือควรรวมแพลตฟอร์มที่เคย sync มาแล้วในอดีตแต่ถูกปิดใช้งานไปด้วย (`DISTINCT platform FROM content_post_metrics`)? ส่งผลต่อว่าแพลตฟอร์มที่เลิกใช้จะหายไปจากตารางทันทีหรือค้างอยู่จนกว่าจะพ้นทุกช่วงเวลาที่มีข้อมูล
- **ชื่อ component/ตำแหน่งไฟล์ที่แน่นอน** ของ 3 widget ใหม่ (เช่นจะรวมเป็นไฟล์เดียวหรือแยก 3 ไฟล์ใต้ `src/components/content/`) ปล่อยให้ tasks.md/การ implement ตัดสินใจตามความสะดวกของโครงสร้างไฟล์ที่มีอยู่
