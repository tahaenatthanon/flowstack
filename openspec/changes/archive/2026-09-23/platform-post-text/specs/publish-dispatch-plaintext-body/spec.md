## MODIFIED Requirements

### Requirement: ลำดับแหล่งเนื้อหาของโพสต์โซเชียล
เนื้อหา (ส่วนข้อความ ไม่รวมหัวข้อ) ของโพสต์โซเชียล SHALL มาจากตัวแรกที่ไม่ว่าง (พิจารณาหลัง `trim()`) ตามลำดับ: `content_override` ของคิวเดิม → `article_content.scripts[platform]` ที่ตัดคำกำกับแล้ว (capability `platform-post-text`) → `content_items.caption` → `article_content.html` ที่แปลงเป็นข้อความ — `caption` และ `content_override` ที่ถูกใช้ SHALL ไม่ถูกแปลงหรือดัดแปลงเนื้อหา

#### Scenario: มี script ของ platform, caption และบทความ
- **WHEN** คอนเทนต์มี `scripts.facebook`, `caption` และ `article_content.html` ครบ และเผยแพร่ไป facebook
- **THEN** เนื้อหาที่ส่งให้ dispatcher SHALL มาจาก `scripts.facebook`

#### Scenario: มีทั้ง caption และบทความ แต่ไม่มี script ของ platform
- **WHEN** คอนเทนต์มี `caption` ที่ไม่ว่างและ `article_content.html` แต่ไม่มี `scripts[platform]`
- **THEN** เนื้อหาที่ส่งให้ dispatcher โซเชียล SHALL เป็น `caption`

#### Scenario: มีแต่บทความ
- **WHEN** คอนเทนต์ไม่มี `scripts[platform]` และ `caption` ว่าง แต่มี `article_content.html`
- **THEN** เนื้อหาที่ส่งให้ dispatcher โซเชียล SHALL เป็นผลของการแปลง `article_content.html` เป็นข้อความ

#### Scenario: caption มีแต่ช่องว่าง
- **WHEN** ไม่มี `scripts[platform]`, `caption` มีแต่อักขระช่องว่าง และมี `article_content.html` ที่มีเนื้อหา
- **THEN** ระบบ SHALL ใช้เนื้อหาที่แปลงจาก `article_content.html`

#### Scenario: caption ถูกส่งไปตามที่ผู้ใช้พิมพ์
- **WHEN** `caption` ถูกเลือกเป็นแหล่งเนื้อหา
- **THEN** ข้อความที่ส่งออก SHALL ตรงกับค่าใน `caption` ทุกตัวอักษร (ยกเว้นการ `trim()` หัวท้าย)

#### Scenario: ไม่มีแหล่งใดเลย
- **WHEN** คอนเทนต์ไม่มี `scripts[platform]`, `caption` และ `article_content.html`
- **THEN** เนื้อหาที่ส่งให้ dispatcher SHALL เป็นสตริงว่าง และ SHALL ไม่ error

#### Scenario: คิวเดิมที่มีข้อความแทนที่
- **WHEN** คิวที่สร้างก่อน change นี้มี `content_override`
- **THEN** โพสต์ SHALL มีข้อความตรงตาม `content_override` ไม่ถูกแปลงเสียรูป

### Requirement: ตัดหัวเรื่องที่ซ้ำออกจากเนื้อหา
dispatcher โซเชียลทุกตัวประกอบข้อความเป็น `"{title}\n\n{body}"` อยู่แล้ว ดังนั้นเมื่อเนื้อหามาจากการแปลง HTML การแปลง SHALL ลบ element `<h1>` **ตัวแรก** ออกเมื่อข้อความข้างในตรงกับหัวเรื่องที่จะถูกเติม (`content_items.title`) **หรือ** ตรงกับ `article_content.title` (ชื่อบทความที่ AI ตั้ง ซึ่งเป็น `<h1>` ของบทความ) เพื่อไม่ให้หัวเรื่องปรากฏซ้ำ — SHALL เทียบแบบ normalize ทั้งสองฝั่ง (ตัดแท็กข้างใน, ถอดรหัส entity, `trim()`)

#### Scenario: h1 ที่ซ้ำกับหัวเรื่องถูกตัด
- **WHEN** `article_content.html` เริ่มด้วย `<h1>` ที่ข้อความข้างในตรงกับ `content_items.title`
- **THEN** ข้อความที่โพสต์ออกไป SHALL มีหัวเรื่องปรากฏเพียงครั้งเดียว

#### Scenario: h1 เป็นชื่อบทความที่ AI ตั้ง ต่างจากช่องหัวข้อ
- **WHEN** `<h1>` ตัวแรกตรงกับ `article_content.title` แต่ `content_items.title` ถูกแก้เป็นค่าอื่น
- **THEN** `<h1>` นั้น SHALL ถูกตัด และบรรทัดแรกของโพสต์ SHALL เป็น `content_items.title`

#### Scenario: h1 ที่ไม่ซ้ำไม่ถูกตัด
- **WHEN** ข้อความใน `<h1>` ตัวแรกไม่ตรงกับทั้งสองค่า
- **THEN** ข้อความใน `<h1>` นั้น SHALL ยังอยู่ในเนื้อหาในรูปข้อความล้วน

#### Scenario: ตัดเฉพาะตัวแรก
- **WHEN** เนื้อหามี `<h1>` มากกว่าหนึ่งตัว และตัวแรกตรงกับหัวเรื่อง
- **THEN** เฉพาะตัวแรก SHALL ถูกตัด

### Requirement: การประกอบหัวเรื่องและเพดานความยาวเดิมไม่เปลี่ยน
การประกอบข้อความโพสต์โซเชียล SHALL ยังเป็น `"{title}\n\n{body}"` โดย `{title}` ของ**แพลตฟอร์มโซเชียล**มาจาก `content_items.title` (ช่อง "หัวข้อ" ในฟอร์ม) — แพลตฟอร์มเว็บ/CMS SHALL ยังใช้ `article_content.title` ก่อนแล้ว fallback `content_items.title` ตามเดิม — เพดานความยาวต่อแพลตฟอร์ม (facebook 63206, instagram 2200, tiktok 2200, lineoa 5000, linkedin 3000, twitter 280) SHALL ไม่เปลี่ยน และ signature ของ dispatcher SHALL ไม่เปลี่ยน

#### Scenario: หัวเรื่องโซเชียลมาจากช่องหัวข้อ
- **WHEN** `content_items.title = "A"` และ `article_content.title = "B"` และเผยแพร่ไป facebook
- **THEN** ข้อความที่ส่งออก SHALL ขึ้นต้นด้วย `"A\n\n"`

#### Scenario: เว็บยังใช้ชื่อบทความ
- **WHEN** คอนเทนต์เดียวกันเผยแพร่ไป wordpress
- **THEN** title ที่ส่งให้ `dispatch_wordpress()` SHALL เป็น "B"

#### Scenario: เพดานความยาวยังบังคับใช้
- **WHEN** ข้อความยาวเกินเพดานของแพลตฟอร์ม
- **THEN** ข้อความ SHALL ถูกตัดที่เพดานเดิมของแพลตฟอร์มนั้นด้วยกลไกเดิม
