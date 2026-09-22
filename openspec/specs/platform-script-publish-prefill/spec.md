# platform-script-publish-prefill Specification

## Purpose

กำหนดว่าข้อความเผยแพร่เริ่มต้นต่อ social channel ใน `SchedulePublishDialog` ต้องมาจาก `article_content.scripts[platform]` ของ platform ของ channel นั้นโดยเฉพาะ (ตัดคำกำกับฉากออกสำหรับ `tiktok`/`youtube` ที่เป็นรูปแบบ screenplay) แทนข้อความเดียวที่เคยใช้ร่วมกันทุก channel และ fallback ไป `content_items.caption` เมื่อไม่มี script ของ platform นั้น — Platform ที่ไม่มี script (`wordpress`, `wix`, `custom`, `website`) ไม่ได้รับผลกระทบ ยังใช้เนื้อหาบทความเหมือนเดิม

## Requirements

### Requirement: ข้อความเผยแพร่เริ่มต้นต่อ social channel มาจาก script ของ platform นั้น
`SchedulePublishDialog` SHALL prefill ข้อความที่จะเผยแพร่ (ค่าที่ส่งเป็น `channel_overrides[channelId]`) ของแต่ละ social channel (`facebook`, `instagram`, `tiktok`, `lineoa`, `linkedin`, `twitter`) ด้วยค่าจาก `article_content.scripts[platform]` ของ platform ของ channel นั้นโดยเฉพาะ — SHALL ไม่ใช้ข้อความเดียวกันซ้ำกับ channel ของ platform อื่น

#### Scenario: เลือก 2 platform ที่มี script ต่างกัน
- **WHEN** ผู้ใช้เปิด `SchedulePublishDialog` สำหรับ content ที่มี `article_content.scripts` = `{"facebook": "Post caption: A", "tiktok": "Hook 3 วิ: B"}` และเลือก channel ของทั้ง facebook และ tiktok
- **THEN** ข้อความเริ่มต้นของ channel facebook SHALL มาจาก `scripts.facebook`
- **AND** ข้อความเริ่มต้นของ channel tiktok SHALL มาจาก `scripts.tiktok`
- **AND** ข้อความเริ่มต้นทั้งสอง SHALL ไม่เหมือนกัน

#### Scenario: ผู้ใช้ยังแก้ไขข้อความก่อนส่งได้เหมือนเดิม
- **WHEN** ข้อความถูก prefill จาก `scripts[platform]` แล้ว
- **THEN** ผู้ใช้ SHALL แก้ไขข้อความนั้นได้ก่อนกด "ส่งทันที"/"ตั้งเวลา"
- **AND** ค่าที่แก้ไขแล้ว SHALL ถูกส่งเป็น `channel_overrides[channelId]` ตามที่ผู้ใช้แก้ ไม่ใช่ค่า prefill เดิม

### Requirement: คำกำกับฉากถูกตัดออกก่อนใช้เป็นข้อความเผยแพร่
เมื่อ prefill ข้อความจาก `scripts['tiktok']` หรือ `scripts['youtube']` (รูปแบบ screenplay ที่มีคำกำกับฉากต้นบรรทัด เช่น `Hook 3 วิ:`, `Scene 1:`, `Intro:`, `Outro:`, `Section 1:`, `CTA:`) ระบบ SHALL ตัดคำกำกับฉากเหล่านี้ออกจากต้นบรรทัด ก่อนนำไปแสดงเป็นค่าเริ่มต้นให้ผู้ใช้เห็น

#### Scenario: TikTok script ถูกตัดคำกำกับฉาก
- **WHEN** `scripts['tiktok']` = `"Hook 3 วิ: เฮ้ยรู้ไหม\nScene 1: แสดงสินค้า\nCTA: กดติดตาม"`
- **THEN** ข้อความเริ่มต้นที่แสดงให้ผู้ใช้เห็น SHALL ไม่มีคำว่า `"Hook 3 วิ:"`, `"Scene 1:"`, หรือ `"CTA:"` อยู่ต้นบรรทัด
- **AND** เนื้อความจริง ("เฮ้ยรู้ไหม", "แสดงสินค้า", "กดติดตาม") SHALL ยังอยู่ครบ

#### Scenario: platform อื่นไม่ต้องตัดคำกำกับฉาก
- **WHEN** `scripts['facebook']` = `"Post caption: สนใจไหม\nCTA: ทักแชท"`
- **THEN** ข้อความเริ่มต้นที่แสดงให้ผู้ใช้เห็น SHALL ใช้ข้อความนี้โดยไม่ต้องตัดคำใดออก

### Requirement: Fallback ไปใช้แคปชั่นเมื่อไม่มี script ของ platform นั้น
เมื่อ content item ไม่มี `article_content.scripts[platform]` สำหรับ platform ของ channel ที่เลือก (ไม่ว่าเพราะ content สร้างก่อนมี field นี้ หรือ AI ไม่ได้เขียนไว้) ระบบ SHALL prefill ข้อความเริ่มต้นด้วย `content_items.caption` แทน ตามพฤติกรรมเดิมก่อนการเปลี่ยนแปลงนี้ — SHALL ไม่แสดงข้อความว่างเปล่าและ SHALL ไม่ error

#### Scenario: content เก่าไม่มี scripts field
- **WHEN** content item มี `article_content` ที่ไม่มี key `scripts` เลย และมี `caption` ที่ไม่ว่าง
- **THEN** ข้อความเริ่มต้นของทุก social channel ที่เลือก SHALL เป็น `caption`

#### Scenario: มี scripts แต่ไม่มี key ของ platform ที่เลือก
- **WHEN** `article_content.scripts` = `{"facebook": "..."}` และผู้ใช้เลือก channel ของ `linkedin`
- **THEN** ข้อความเริ่มต้นของ channel linkedin SHALL เป็น `caption` ไม่ใช่ข้อความว่างเปล่า

### Requirement: Platform ที่ไม่มี script ไม่ได้รับผลกระทบ
`ARTICLE_PLATFORMS` (`wordpress`, `wix`, `custom`, `website`) SHALL ยังคง prefill จาก `articleBody` (HTML บทความ) เหมือนพฤติกรรมเดิมทุกประการ — การเปลี่ยนแปลงนี้ SHALL มีผลเฉพาะ social channel เท่านั้น

#### Scenario: WordPress channel ไม่เปลี่ยนพฤติกรรม
- **WHEN** ผู้ใช้เลือก channel ของ `wordpress`
- **THEN** ข้อความเริ่มต้นที่ prefill SHALL ยังคงเป็น `articleBody` เหมือนก่อนการเปลี่ยนแปลงนี้
