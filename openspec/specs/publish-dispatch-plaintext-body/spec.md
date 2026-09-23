# publish-dispatch-plaintext-body Specification

## Purpose

กำหนดว่าเนื้อหา (body) ที่ `dispatch_content()` (`api/lib/publish-dispatch.php`) ส่งให้ dispatcher ของแพลตฟอร์มโซเชียล (`facebook`, `instagram`, `tiktok`, `lineoa`, `linkedin`, `twitter`) ต้องเป็น **ข้อความล้วน** ไม่ใช่ HTML — ครอบลำดับแหล่งข้อมูล (ข้อความโพสต์ของ platform `article_content.scripts[platform]` → `content_items.caption` → `article_content.html` ที่แปลงเป็นข้อความ — แก้ไขโดย change `platform-post-text` ที่กำหนดหัวเรื่องโซเชียลเป็น `content_items.title`), กฎการแปลง HTML → ข้อความที่รักษาย่อหน้าและรายการ, การถอดรหัส HTML entity หลังการตัดแท็ก, การลบเนื้อใน `<script>`/`<style>` ทั้งก้อน, และการตัด `<h1>` ตัวแรกที่ซ้ำกับหัวเรื่องซึ่ง dispatcher เติมให้อยู่แล้ว พร้อมขีดเส้นชัดว่าแพลตฟอร์มเว็บ/CMS (`wordpress`, `lotusdomino`, `custom`) ยังได้รับ HTML เดิมทุกตัวอักษร

## Requirements

### Requirement: แพลตฟอร์มโซเชียลได้เนื้อหาเป็นข้อความล้วน
`dispatch_content()` SHALL ส่งเนื้อหาที่เป็นข้อความล้วนให้ dispatcher ของแพลตฟอร์มโซเชียลทั้งหมด — `facebook`, `instagram`, `tiktok`, `lineoa`, `linkedin`, `twitter` — เนื้อหาที่ส่งออกไป SHALL ไม่มี HTML tag และ SHALL ไม่มี HTML entity ที่ยังไม่ถูกถอดรหัส

#### Scenario: คอนเทนต์ที่มีบทความ HTML โพสต์ออกเป็นข้อความล้วน
- **WHEN** `dispatch_content()` ถูกเรียกด้วยแพลตฟอร์มโซเชียล และคอนเทนต์มี `article_content.html` ที่มี `<article>`, `<h1>`, `<p>`, `<li>`
- **THEN** เนื้อหาที่ dispatcher ได้รับ SHALL ไม่มีสตริงที่เป็น HTML tag เหลืออยู่
- **AND** SHALL ไม่มี entity เช่น `&#039;`, `&amp;`, `&lt;` เหลืออยู่ในรูปที่ยังไม่ถอดรหัส

#### Scenario: ครอบทุกแพลตฟอร์มโซเชียล ไม่ใช่แค่ facebook
- **WHEN** คอนเทนต์เดียวกันถูกเผยแพร่ไปยัง `instagram`, `tiktok`, `lineoa`, `linkedin` หรือ `twitter`
- **THEN** ทุกแพลตฟอร์มได้รับเนื้อหาข้อความล้วนชุดเดียวกัน

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

### Requirement: การแปลง HTML เป็นข้อความต้องรักษาย่อหน้าและรายการ
การแปลง HTML เป็นข้อความ SHALL แทนแท็กที่มีความหมายเชิงโครงสร้างด้วยตัวคั่นข้อความก่อนตัดแท็กที่เหลือ — รายการ (`<li>`) SHALL กลายเป็นบรรทัดที่นำด้วยสัญลักษณ์รายการ, `<br>` SHALL กลายเป็นการขึ้นบรรทัดใหม่, และการปิดบล็อก (`</p>`, `</h1>`–`</h6>`, `</div>`, `</ul>`, `</ol>`, `</blockquote>`) SHALL กลายเป็นการเว้นย่อหน้า — SHALL ไม่ใช้การตัดแท็กเพียว ๆ ที่ทำให้ทุกอย่างติดกันเป็นข้อความเดียว

#### Scenario: รายการยังคงเป็นรายการ
- **WHEN** เนื้อหา HTML มี `<ul><li>ก</li><li>ข</li></ul>`
- **THEN** ข้อความที่ได้ SHALL มี "ก" และ "ข" อยู่คนละบรรทัด และแต่ละบรรทัดนำด้วยสัญลักษณ์รายการ

#### Scenario: ย่อหน้าไม่ติดกัน
- **WHEN** เนื้อหา HTML มี `<p>ย่อหน้าแรก</p><p>ย่อหน้าที่สอง</p>`
- **THEN** ข้อความที่ได้ SHALL มีสองย่อหน้าที่แยกกันด้วยการขึ้นบรรทัด ไม่ใช่ "ย่อหน้าแรกย่อหน้าที่สอง"

#### Scenario: ไม่มีบรรทัดว่างซ้อนเกินจำเป็น
- **WHEN** HTML มีแท็กบล็อกซ้อนกันหลายชั้นจนเกิดตัวคั่นติดกันหลายตัว
- **THEN** ข้อความที่ได้ SHALL มีบรรทัดว่างติดกันไม่เกินหนึ่งบรรทัด (ขึ้นบรรทัดใหม่ไม่เกินสองครั้งติดกัน)
- **AND** SHALL ไม่มีช่องว่างหรือบรรทัดใหม่ค้างที่หัวหรือท้ายข้อความ

### Requirement: HTML entity ต้องถูกถอดรหัสหลังตัดแท็ก
การแปลง SHALL ถอดรหัส HTML entity ด้วยการรองรับทั้งอัญประกาศและ HTML5 (`ENT_QUOTES | ENT_HTML5`) และ SHALL ทำขั้นตอนนี้ **หลัง** การตัดแท็ก เพื่อไม่ให้ entity ที่ถอดรหัสแล้วกลายเป็นแท็กจริงที่ถูกตัดทิ้งในภายหลัง

#### Scenario: อัญประกาศเดี่ยวถูกถอดรหัส
- **WHEN** HTML มี `&#039;` หรือ `&quot;`
- **THEN** ข้อความที่ได้ SHALL มีอักขระ `'` หรือ `"` จริง ไม่ใช่โค้ด entity

#### Scenario: เครื่องหมายน้อยกว่าที่ถูก escape ไว้ไม่หาย
- **WHEN** HTML มีข้อความ `&lt;div&gt;` เป็นเนื้อหาที่ผู้เขียนต้องการให้แสดง
- **THEN** ข้อความที่ได้ SHALL ยังมี `<div>` เป็นข้อความอยู่ ไม่ถูกตัดหายไปเพราะถูกเข้าใจผิดว่าเป็นแท็ก

### Requirement: เนื้อใน script และ style ต้องถูกลบทิ้งทั้งก้อน
การแปลง SHALL ลบ element `<script>` และ `<style>` **พร้อมเนื้อหาข้างใน** ก่อนการตัดแท็ก — การตัดแท็กเพียงอย่างเดียว SHALL ไม่ถือว่าเพียงพอ เพราะจะเหลือโค้ด CSS/JS เป็นข้อความไปปรากฏบนโพสต์สาธารณะ

#### Scenario: CSS ไม่หลุดไปอยู่ในโพสต์
- **WHEN** HTML มี `<style>.a{color:red}</style>` อยู่ในเนื้อหา
- **THEN** ข้อความที่ได้ SHALL ไม่มี `.a{color:red}` อยู่

#### Scenario: JS ไม่หลุดไปอยู่ในโพสต์
- **WHEN** HTML มี `<script>alert(1)</script>` อยู่ในเนื้อหา
- **THEN** ข้อความที่ได้ SHALL ไม่มี `alert(1)` อยู่

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

### Requirement: แพลตฟอร์มเว็บและ CMS ยังได้รับ HTML เดิม
`dispatch_wordpress()`, `dispatch_lotusdomino()` และ `dispatch_custom()` SHALL ยังได้รับเนื้อหาเป็น HTML แบบเดียวกับก่อนการเปลี่ยนแปลงนี้ทุกตัวอักษร — การเพิ่มเนื้อหาข้อความล้วนสำหรับโซเชียล SHALL ไม่เปลี่ยนสิ่งที่แพลตฟอร์มเหล่านี้ได้รับ เพราะปลายทางเรนเดอร์ HTML เป็นบทความ

#### Scenario: wordpress ยังได้ HTML
- **WHEN** `dispatch_content('wordpress', ...)` ถูกเรียกด้วยคอนเทนต์ที่มี `article_content.html`
- **THEN** เนื้อหาที่ `dispatch_wordpress()` ได้รับ SHALL เท่ากับ `article_content.html` เหมือนพฤติกรรมเดิม

#### Scenario: lotusdomino และ custom ยังได้ HTML
- **WHEN** `dispatch_content('lotusdomino', ...)` หรือ `dispatch_content('custom', ...)` ถูกเรียก
- **THEN** เนื้อหาที่ dispatcher ได้รับ SHALL เป็น HTML เดิม ไม่ถูกแปลงเป็นข้อความล้วน

#### Scenario: การมี caption ไม่แย่งที่ HTML บนเส้นเว็บ
- **WHEN** คอนเทนต์มีทั้ง `caption` และ `article_content.html` และเผยแพร่ไปแพลตฟอร์มเว็บ/CMS
- **THEN** dispatcher SHALL ได้รับ `article_content.html` ไม่ใช่ `caption`

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
