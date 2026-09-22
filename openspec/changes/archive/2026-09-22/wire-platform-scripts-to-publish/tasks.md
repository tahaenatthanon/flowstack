## 1. Utility: clean script text ต่อ platform

- [x] 1.1 เพิ่มฟังก์ชัน `stripScriptDirections(text, platform)` ใน `src/components/content/types.ts` (หรือไฟล์ util ที่เหมาะสม) — ตัดคำกำกับฉากต้นบรรทัด (`Hook N วิ:`, `Scene N:`, `Intro:`, `Outro:`, `Section N:`, `CTA:`) เฉพาะเมื่อ `platform` เป็น `tiktok`/`youtube`, platform อื่นคืนค่าเดิมไม่แก้ไข
- [x] 1.2 เพิ่มฟังก์ชัน `getPublishDefaultText(scripts, platform, caption)` — คืนค่า `stripScriptDirections(scripts[platform], platform)` ถ้ามี, ไม่งั้น fallback คืน `caption`

## 2. ส่ง `scripts` ลงไปเป็น prop ใหม่

- [x] 2.1 `ContentArticleView.tsx` — ดึง `art?.scripts` จาก `article_content` ที่ parse ไว้แล้ว ส่งเป็น prop `scripts` เข้า `<SchedulePublishDialog>`
- [x] 2.2 `ContentDetailView.tsx` — เพิ่ม parse `.scripts` ในจุดเดียวกับที่ parse `.html` (บรรทัด ~442) ส่งเป็น prop `scripts`
- [x] 2.3 `ContentListTab.tsx` — เพิ่ม `scripts` เข้า state `publishDialog` (ทั้ง 2 จุดที่ตั้งค่า: send_now และ schedule) และส่งต่อเป็น prop ให้ `<SchedulePublishDialog>`

## 3. แก้ `SchedulePublishDialog.tsx`

- [x] 3.1 เพิ่ม prop `scripts?: Record<string, string>` ใน `Props` interface
- [x] 3.2 เปลี่ยน state `socialCaption` (string เดียว) เป็น per-platform: `socialCaptions: Record<string, string>` (key = platform lowercase)
- [x] 3.3 ตอน `useEffect` ที่ reset state เมื่อ dialog เปิด — คำนวณค่าเริ่มต้นของ `socialCaptions` ต่อ platform ที่มีใน `activeChannels` ด้วย `getPublishDefaultText(scripts, platform, defaultCaption)` จาก task 1.2
- [x] 3.4 แก้ UI ส่วนกรอกข้อความ social — เปลี่ยนจาก textarea เดียวเป็น textarea แยกต่อ platform ที่ถูกเลือกไว้ (แสดงเฉพาะ platform ที่มี channel ถูกเลือกอยู่จริง)
- [x] 3.5 แก้ `buildOverrides()` — ใช้ `socialCaptions[ch.platform]` แทน `socialCaption` ตัวเดียว เมื่อ `ch.platform` อยู่ใน `SOCIAL_PLATFORMS`

## 4. แก้ `ContentVideoView.tsx` sub-tab

- [x] 4.1 เปลี่ยน platform sub-tab list จาก hardcode `(['tiktok','youtube','instagram','facebook'] as const)` เป็น `Object.keys(art.scripts ?? {})`
- [x] 4.2 ปรับ `activePlatform` state/type ให้เป็น `string` (ไม่ fix เป็น union 4 ค่า) และ default เป็น key แรกที่มีจริงใน `art.scripts` (หรือ platform ของ item ถ้าตรงกับ key ที่มี)
- [x] 4.3 เช็คว่า `PLATFORM_COLORS`/`platformLabel` ยังรองรับ key อื่นนอกเหนือ 4 ตัวเดิม (เช่น `linkedin`, `twitter`, `lineoa`) — เพิ่ม mapping ที่ขาดถ้าจำเป็น

## 5. ทดสอบ

- [x] 5.1 เขียน/แก้ test สำหรับ `stripScriptDirections` และ `getPublishDefaultText` (unit test — ครอบคลุม scenario ใน `specs/platform-script-publish-prefill/spec.md`)
- [x] 5.2 แก้ test ที่มีอยู่ของ `SchedulePublishDialog` (`src/__tests__/content/SchedulePublishDialog.test.tsx`) ให้ผ่านกับโครง state ใหม่
- [x] 5.3 เพิ่ม test สำหรับ `ContentVideoView` sub-tab ตาม scenario ใน `specs/content-video-ui-section/spec.md` (เลือก 2 platform เห็นแค่ 2 แท็บ, ไม่มี script ไม่มีแท็บ)
- [x] 5.4 รัน `pnpm test` และ `pnpm lint` ให้ผ่านทั้งหมดก่อนปิดงาน (0 errors; 2 pre-existing unrelated test failures ใน PullFromContentDialog.test.tsx ยืนยันแล้วว่ามีอยู่ก่อนงานนี้)
