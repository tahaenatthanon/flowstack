## Why

AI สร้าง `article_content.scripts[platform]` แยกเนื้อหาต่อ platform ไว้ให้แล้วตามหลักการ "แต่ละ platform ต้องมีเนื้อหาที่ปรับให้เหมาะ ไม่ copy ข้ามแบบตรงๆ" ที่เขียนไว้ใน prompt (`platformScriptGuidance`, `api/lib/content-plan-prompt.php`) แต่ตรวจโค้ดจริงพบว่าเนื้อหานี้ไม่เคยถูกใช้เผยแพร่เลยสักที่ — `dispatch_content()` ใช้ `content_items.caption` ตัวเดียวกันยัดให้ทุก social platform เหมือนกันหมด (Facebook, Instagram, TikTok, LINE OA, LinkedIn, Twitter ได้ข้อความเดียวกันเป๊ะ) และฝั่ง UI (`SchedulePublishDialog`) ก็มี textarea เดียว (`socialCaption`) ที่ก็อปข้อความเดียวกันไปทุก channel ที่เลือกเช่นกัน (`buildOverrides()` วน assign ค่าเดียวกันให้ทุก social channel) — ขัดกับเจตนาเดิมของระบบเองที่ AI เขียนเนื้อหาแยกไว้ให้แล้วแท้ๆ

เพิ่มเติม: `ContentVideoView.tsx` มี sub-tab แสดง script รายแพลตฟอร์มที่ hardcode วนแสดง `tiktok/youtube/instagram/facebook` เสมอ ไม่ว่า content item จะเลือก platform อะไรไว้จริง — ทำให้เห็นแท็บของ platform ที่ไม่ได้เลือกและว่างเปล่าเมื่อกด ทั้งที่ backend กรอง `scripts` ให้ตรงกับ platform ที่เลือกไว้อย่างถูกต้องอยู่แล้ว (มี `array_intersect_key($mainData['scripts'], array_flip($scriptPlatforms))` ยืนยันถึง 4 จุดใน `api/brand-content.php`)

## What Changes

- เพิ่ม default prefill ของข้อความที่จะเผยแพร่ต่อ social channel ใน `SchedulePublishDialog` จาก `article_content.scripts[platform]` ของ channel นั้นแทนการใช้ `socialCaption` ตัวเดียวกันทุก channel — ผู้ใช้ยังแก้ไขข้อความต่อ channel ได้ก่อนส่งเหมือนเดิม (ไม่เปลี่ยน flow การกดส่ง)
- สำหรับ platform ที่ script เป็นรูปแบบ screenplay (`tiktok`, `youtube` — มีคำกำกับฉากเช่น "Hook 3 วิ:", "Scene 1:", "Intro:", "CTA:") ต้องตัดคำกำกับฉากออกก่อนใช้เป็นข้อความเผยแพร่ ไม่ให้คำกำกับฉากหลุดไปปรากฏในโพสต์จริง
- Fallback: ถ้าไม่มี `scripts[platform]` สำหรับ channel นั้น (เช่น content เก่าก่อนมี field นี้ หรือ AI ไม่ได้เขียนไว้) ให้ใช้ `caption` เหมือนพฤติกรรมเดิมทุกประการ — ไม่ error, ไม่ว่างเปล่า
- **ไม่แตะ backend (`dispatch_content()`, `publish_via_central_flow()`)** — กลไก `content_override` ที่มีอยู่แล้วรองรับการ override ต่อ channel ได้ตรงตามที่ต้องการอยู่แล้ว (เห็นจาก `publish_via_central_flow()` ที่ทับค่า `caption`/`article_content.html` เมื่อมี `contentOverride` ไม่ว่าง) การเปลี่ยนแปลงทั้งหมดจึงอยู่ที่ฝั่ง frontend เท่านั้น (ค่าเริ่มต้นที่ prefill ให้)
- แก้ `ContentVideoView.tsx` ให้ platform sub-tab วนแสดงตาม key ที่มีจริงใน `article_content.scripts` (ตรงกับ platform ที่เลือกไว้จริง) แทนการ hardcode รายชื่อ 4 platform ตายตัว — ให้ตรงกับวิธีที่ `ContentCardDialog.tsx` ทำอยู่แล้ว (`Object.entries(scripts)`)

## Capabilities

### New Capabilities
- `platform-script-publish-prefill`: กำหนดว่าข้อความเผยแพร่เริ่มต้นต่อ social channel ใน `SchedulePublishDialog` ต้องมาจาก `article_content.scripts[platform]` ของ channel นั้น (ตัดคำกำกับฉากออกสำหรับ tiktok/youtube) แทนข้อความเดียวที่ใช้ร่วมกันทุก channel และ fallback ไป `caption` เมื่อไม่มี script ของ platform นั้น

### Modified Capabilities
- `content-video-ui-section`: เพิ่ม requirement ว่า platform sub-tab ใน `ContentVideoView` ต้องแสดงเฉพาะ platform ที่มี script อยู่จริงใน `article_content.scripts` (ตรงกับ platform ที่เลือกไว้บน content item) ไม่ใช่รายชื่อ platform ที่ hardcode ไว้ตายตัว

## Impact

- Frontend: `src/components/content/SchedulePublishDialog.tsx` (`buildOverrides()`, state `socialCaption` → ต่อ channel/platform, รับ `scripts` เพิ่มจาก props)
- Frontend: `src/components/content/views/ContentArticleView.tsx`, `src/components/content/views/ContentDetailView.tsx`, `src/components/content/tabs/ContentListTab.tsx` (จุดที่เรียก `<SchedulePublishDialog>` — ต้องส่ง `scripts` ของ content item ลงไปเป็น prop เพิ่ม)
- Frontend: `src/components/content/views/ContentVideoView.tsx` (platform sub-tab)
- ไม่กระทบ Database schema — ไม่มี column/field ใหม่ ไม่มี migration
- ไม่กระทบ backend (`api/brand-content.php`, `api/lib/publish-dispatch.php`, `api/content-publish.php`) — ใช้กลไก `content_override`/`channel_overrides` ที่มีอยู่แล้วทั้งหมด
- ไม่กระทบ platform ที่ไม่มี script (`wordpress`, `wix`, `lotusdomino`, `custom`) — ยังใช้ `articleBody`/HTML เหมือนเดิมทุกประการ
- นอกสโคป (แยกไว้ทำทีหลังตามที่ตกลง): YouTube ไม่มี dispatch handler เลย (ต้องสร้างใหม่ทั้งฟังก์ชัน — งานคนละขนาด), TikTok publish ไม่มี `video_url` แนบ (ต้องแก้ dispatch_tiktok ให้ส่ง video), LINE OA ไม่แนบรูป, WordPress ไม่มี featured image, Instagram บังคับต้องมีรูปก่อนโพสต์ — ทั้งหมดนี้เป็นบั๊ก/ช่องว่างคนละเรื่องที่พบระหว่างตรวจโค้ด ไม่อยู่ใน scope ของงานนี้
