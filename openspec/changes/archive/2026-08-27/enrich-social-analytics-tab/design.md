## Context

sub-tab "โซเชียล" (`AnalyticsSocialTab.tsx`) ปัจจุบันแสดง stat card 4 ใบ โดย 3 ใบ (ผู้ติดตาม, Reach, Engagement Rate) เป็น em dash ตายตัว เพราะเป็นเมตริก**ระดับเพจ** ที่ต้องใช้ OAuth page insights + Facebook app review — ยังไม่มีแหล่งข้อมูลและไม่มีกำหนด ส่วนการ์ด "Engagement รวม" ใบเดียวที่ต่อข้อมูลจริงยุบ `content_post_metrics` ทั้งตารางเหลือเลขก้อนเดียว

ข้อมูลจริงที่มีในมือ (ยืนยันจาก DB วันที่ 27 ส.ค. 2026):
- `content_post_metrics`: **facebook 63 แถว / 5 โพสต์**, ไม่มี instagram, ซิงก์ล่าสุด 2026-08-27 10:32:55 — เป็น time-series (หลาย snapshot ต่อโพสต์)
- ทุกโพสต์ FB คืน **`views = 0`** ทุกแถว, `likes` = 2–3
- `content_items.published_url` มี permalink FB จริงครบทั้ง 5 โพสต์ (NULL สำหรับ lotusdomino)
- FB channel `is_active=1` / `token_status=valid` / `data_access_expires_at=2026-11-24`; IG channel `is_active=0`

backend `api/content-analytics.php` `?action=analytics` มี `social` block และ `throughput` (monthly series) เป็น pattern อ้างอิงอยู่แล้ว งานนี้เป็นชั้น presentation/aggregation ล้วน ไม่แตะ insights-fetch / cron / publish และไม่แตะ schema

## Goals / Non-Goals

**Goals:**
- ถอดการ์ด em dash ระดับเพจ 3 ใบออก แทนด้วย widget ที่คำนวณจากข้อมูลจริงล้วน
- ขยาย `social` block ให้คืน per-platform breakdown, monthly time-series และ top posts โดย **superset** ของ shape เดิม (ไม่ทำ frontend ที่ยังไม่อัปเดตพัง)
- label แพลตฟอร์มและ notice card สะท้อนความจริง (ปัจจุบันมีแค่ Facebook) ไม่ hardcode
- แสดง `views`/`likes` แยกกันอย่างตรงไปตรงมา จัดการกรณี `views=0` ไม่ให้สื่อผิด
- ไม่มี mock/hardcoded data ทุกจุด และมี empty state ที่ซื่อสัตย์

**Non-Goals:**
- เมตริกระดับเพจ (followers, reach, impressions, engagement rate), OAuth page insights, Facebook app review
- ต่อแพลตฟอร์มใหม่ (TikTok / LINE OA / LinkedIn / X) หรือ website analytics
- แก้ Facebook app Development mode หรือเปิด IG channel
- เพิ่ม chart library ใหม่ หรือแก้ schema / cron / insights-fetch / publish pipeline

## Decisions

### 1. ลบการ์ดระดับเพจ 3 ใบทิ้ง (ไม่ซ่อนไว้เฉย ๆ)
เลือก**ลบ**แทนคง placeholder ไว้ เพราะไม่มี ETA ของ FB app review + OAuth การคงช่องว่างสื่อผิดว่า "กำลังจะมา" และกินพื้นที่ครึ่งหน้า notice card จะอธิบายตรง ๆ ว่าเมตริกกลุ่มนี้เป็นงาน integration เฟสถัดไป — **ทางเลือกที่ไม่เลือก:** คงการ์ดพร้อม tooltip "เร็ว ๆ นี้" (สัญญาที่ยังไม่มีกำหนด = สื่อผิด)

### 2. `engagement = views + likes` แต่แสดง views/likes แยก และกำกับสูตร
คงนิยาม `engagement` เดิม (`views + likes`) เพื่อ backward-compatible กับการ์ด "Engagement รวม" ที่มีอยู่ แต่**แสดง views และ likes เป็นการ์ดแยก** และกำกับใต้ Engagement รวมว่าคือ `views + likes` เพราะ FB feed post คืน `views=0` ทุกแถว การยุบเป็น "วิว + ไลก์" ทำให้ผู้ใช้เข้าใจว่ามี view — **ไม่ตัด `views` ทิ้ง** เพราะ IG/วิดีโอในอนาคตมี view จริง shape เดียวรองรับได้โดยไม่ต้องแก้ backend อีก — **ทางเลือกที่ไม่เลือก:** เปลี่ยนนิยาม engagement เป็น likes อย่างเดียว (จะทำให้ค่าที่ frontend เดิมเคยแสดงเปลี่ยนเงียบ ๆ และตัดความสามารถรองรับ view จริงในอนาคต)

### 3. `platforms` และ `by_platform` มาจาก `DISTINCT` ของ cohort จริง ไม่ hardcode
เดิม `platforms` ถูกใส่เป็น `['facebook','instagram']` แบบตายตัว ทำให้ UI โชว์ Instagram ทั้งที่ channel ปิดและไม่มีข้อมูล เปลี่ยนเป็นอ่าน `DISTINCT platform` จากผลจริงใน cohort — UI แสดงเฉพาะแพลตฟอร์มที่มีข้อมูล เพิ่ม IG กลับมาเมื่อมีข้อมูลจริงโดยไม่ต้องแก้โค้ด — **ทางเลือกที่ไม่เลือก:** hardcode รายการที่ตั้งใจรองรับ (ต้องแก้โค้ดทุกครั้งที่สถานะแพลตฟอร์มเปลี่ยน และโกหก UI ระหว่างนั้น)

### 4. Aggregate จาก snapshot ล่าสุดต่อโพสต์ต่อช่องทาง (ไม่ SUM ข้าม time-series)
`content_post_metrics` เป็น time-series (63 แถว/5 โพสต์) การ SUM ตรง ๆ จะนับซ้ำทุก snapshot จึงต้อง **dedupe เอาแถว `fetched_at` ล่าสุดต่อ (`content_item_id`, `channel_id`)** ก่อน แล้วค่อยรวม — ใช้กติกาเดียวกับที่ `social` block เดิมใช้อยู่ (aggregate ปัจจุบันก็ต้อง dedupe อยู่แล้ว) เพื่อให้ตัวเลขรวมทุกระดับ (การ์ด, by_platform, monthly, top_posts) มาจากฐานเดียวกัน — **ทางเลือกที่ไม่เลือก:** SUM ทั้งตาราง (นับซ้ำ), หรือ AVG (ไม่สื่อความหมายกับ engagement สะสม)

### 5. cohort และ monthly grouping ยึด `content_items.published_at` (ให้ตรง `throughput`)
`monthly` จัดกลุ่มด้วยเดือนของ `published_at` ตลอดช่วงที่เลือก เดือนที่ไม่มีข้อมูล = 0 (เติมให้ครบทุกเดือน) ให้แกนเวลาตรงกับ `throughput` ที่ frontend คุ้นอยู่แล้ว **ความหมายที่ต้องระบุให้ชัด:** กราฟคือ "engagement ปัจจุบันของโพสต์ที่เผยแพร่ในเดือนนั้น" ไม่ใช่การเติบโตของ snapshot ตามเวลา — ยอมรับได้เพราะสอดคล้องกับ throughput และตอบคำถาม "เดือนไหนคอนเทนต์เวิร์ก" — **ทางเลือกที่ไม่เลือก:** group ตาม `fetched_at` (จะกลายเป็นกราฟรอบซิงก์ ไม่ใช่ผลงานคอนเทนต์ และสับสนกับ throughput)

### 6. permalink ของ top_posts มาจาก `content_items.published_url`
ใช้ `content_items.published_url` เป็นแหล่ง permalink (มีครบทั้ง 5 โพสต์ FB) แทน `content_publish_queue.published_url` ที่กระจัดกระจายกว่า ค่า NULL → ไม่แสดงลิงก์ (ไม่เดา URL) — **ทางเลือกที่ไม่เลือก:** ประกอบ URL เองจาก `platform_post_id` (เปราะ ต่างรูปแบบราย platform เสี่ยงลิงก์เสีย)

### 7. ใช้ chart pattern ที่มีอยู่ ไม่เพิ่ม dependency
กราฟแนวโน้มและ bar breakdown ใช้ pattern เดียวกับ `throughput` / `BestTimeAnalyticsPanel` (แท่ง/เส้นที่มีอยู่แล้วในโปรเจกต์) ไม่เพิ่ม chart library ใหม่ — ลดพื้นที่ผิวและคงสไตล์เดิม

## Risks / Trade-offs

- **ข้อมูลน้อย (5 โพสต์, ทุกโพสต์เผยแพร่ 25–26 ส.ค.)** → กราฟ 12 เดือนจะมีข้อมูลเดือนเดียว ดูโล่ง — *Mitigation:* นี่คือความจริงของข้อมูล ไม่ใช่บั๊ก; empty/near-empty state ต้องสื่อสารตรง ๆ ไม่เติมตัวเลขปลอม
- **`views=0` ทำให้ engagement ≈ likes** อาจดูเหมือนเมตริกซ้ำซ้อน → *Mitigation:* กำกับสูตรใต้การ์ด และแยกการ์ด views/likes ให้เห็นที่มา; คง views ไว้รองรับ IG/วิดีโออนาคต
- **monthly ยึด published_at ไม่ใช่ growth ตามเวลา** อาจถูกตีความผิดว่าเป็นการเติบโตของโพสต์ → *Mitigation:* ระบุความหมายในหัวข้อกราฟ/คำอธิบาย และให้สอดคล้องกับ throughput ที่ใช้ตรรกะเดียวกัน
- **superset shape** ถ้าคำนวณ aggregate ใหม่ไม่ตรงกับ field รวมเดิม จะขัดแย้งในหน้าเดียว → *Mitigation:* aggregate ทุกระดับต้องมาจาก dedupe ฐานเดียวกัน (Decision 4) และ `engagement = views + likes` จุดเดียว (Decision 2); เพิ่ม field ใหม่เท่านั้น ไม่แก้ความหมาย field เดิม
- **IG channel ปิดอยู่** ถ้าเปิดภายหลังโดยไม่มีข้อมูล → `DISTINCT` จาก cohort กันไว้แล้ว UI จะไม่โชว์ IG จนกว่าจะมีแถวจริง
