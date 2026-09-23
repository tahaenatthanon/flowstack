## MODIFIED Requirements

### Requirement: ข้อความเผยแพร่เริ่มต้นต่อ social channel มาจาก script ของ platform นั้น
`SchedulePublishDialog` SHALL แสดงข้อความที่จะโพสต์ของแต่ละ social channel (`facebook`, `instagram`, `tiktok`, `lineoa`, `linkedin`, `twitter`) เป็น**ตัวอย่างแบบอ่านอย่างเดียว** ในรูปแบบเดียวกับที่ backend จะโพสต์ คือหัวข้อ (`content_items.title`) + ข้อความจาก `article_content.scripts[platform]` ของ platform ของ channel นั้นโดยเฉพาะ — SHALL ไม่ใช้ข้อความเดียวกันซ้ำกับ channel ของ platform อื่น — SHALL ไม่มีช่องแก้ไข และคำขอ "ส่งเดี๋ยวนี้"/"ตั้งเวลา" SHALL ไม่ส่ง `channel_overrides` — ถ้าต้องการแก้ข้อความ ผู้ใช้ SHALL แก้ใน `ContentCardDialog` (ซึ่งทำให้ต้องขออนุมัติใหม่) และหน้าต่าง SHALL แสดงคำแนะนำนี้

#### Scenario: เลือก 2 platform ที่มี script ต่างกัน
- **WHEN** ผู้ใช้เปิด `SchedulePublishDialog` สำหรับ content ที่มี `article_content.scripts` = `{"facebook": "A", "tiktok": "B"}` และเลือก channel ของทั้ง facebook และ tiktok
- **THEN** ตัวอย่างข้อความของ channel facebook SHALL มาจาก `scripts.facebook`
- **AND** ตัวอย่างข้อความของ channel tiktok SHALL มาจาก `scripts.tiktok`
- **AND** ตัวอย่างทั้งสอง SHALL ไม่เหมือนกัน

#### Scenario: แก้ข้อความในหน้าต่างเผยแพร่ไม่ได้
- **WHEN** ผู้ใช้เปิด `SchedulePublishDialog`
- **THEN** ข้อความของแต่ละ channel SHALL แสดงแบบอ่านอย่างเดียวพร้อมคำแนะนำให้แก้ใน dialog แก้ไขคอนเทนต์
- **AND** เมื่อกด "ส่งเลย"/"ตั้งเวลา" คำขอ SHALL ไม่มี `channel_overrides`

### Requirement: คำกำกับฉากถูกตัดออกก่อนใช้เป็นข้อความเผยแพร่
ตัวอย่างข้อความในหน้าต่างเผยแพร่ SHALL ตัดคำกำกับต้นบรรทัดตามกฎชุดเดียวกับ backend (capability `platform-post-text`) สำหรับ**ทุก social platform** — ไม่ใช่เฉพาะ `tiktok`/`youtube`

#### Scenario: TikTok script ถูกตัดคำกำกับฉาก
- **WHEN** `scripts['tiktok']` = `"Hook 3 วิ: เฮ้ยรู้ไหม\nScene 1: แสดงสินค้า\nCTA: กดติดตาม"`
- **THEN** ตัวอย่างที่แสดง SHALL ไม่มี `"Hook 3 วิ:"`, `"Scene 1:"`, `"CTA:"` อยู่ต้นบรรทัด
- **AND** เนื้อความ ("เฮ้ยรู้ไหม", "แสดงสินค้า", "กดติดตาม") SHALL ยังอยู่ครบ

#### Scenario: Facebook script ถูกตัดคำกำกับด้วย
- **WHEN** `scripts['facebook']` = `"Post caption: สนใจไหม\nCTA: ทักแชท"`
- **THEN** ตัวอย่างที่แสดง SHALL เป็น `"สนใจไหม\nทักแชท"` (ต่อจากบรรทัดหัวข้อ)

### Requirement: Platform ที่ไม่มี script ไม่ได้รับผลกระทบ
`ARTICLE_PLATFORMS` (`wordpress`, `wix`, `custom`, `website`) SHALL ยังคงโพสต์เนื้อหาบทความ (HTML) เหมือนเดิม — หน้าต่างเผยแพร่ SHALL แสดงแค่ข้อความว่าจะใช้ "เนื้อหาบทความ" ของคอนเทนต์ และ SHALL ไม่มีช่องให้พิมพ์เนื้อหาแทนที่

#### Scenario: WordPress channel ใช้เนื้อหาบทความ
- **WHEN** ผู้ใช้เลือก channel ของ `wordpress`
- **THEN** หน้าต่าง SHALL แสดงว่าจะโพสต์เนื้อหาบทความของคอนเทนต์ และ SHALL ไม่มีช่อง "เนื้อหา" ให้แก้
- **AND** เนื้อหาที่โพสต์ SHALL เป็น `article_content.html` เดิม
