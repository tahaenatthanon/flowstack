## ADDED Requirements

### Requirement: schema เก็บอายุ credentials ของช่องทางเผยแพร่
ตาราง `publish_channels` SHALL มีคอลัมน์สำหรับเก็บผลตรวจอายุ credentials อย่างน้อย: `token_expires_at DATETIME NULL`, `data_access_expires_at DATETIME NULL`, `token_checked_at DATETIME NULL`, `token_status VARCHAR(20) NULL`, `token_error VARCHAR(500) NULL`

ปัจจุบันตารางมีแต่ `credentials_encrypted` ทำให้ไม่มีทางรู้ว่า token จะหมดอายุเมื่อไรจนกว่าจะโพสต์ล้มเหลว — Facebook token หมดอายุไปแล้ว 3 ครั้งโดยไม่มีใครรู้ล่วงหน้า

`token_status` SHALL รับค่าเหล่านี้เท่านั้น: `valid`, `expiring`, `expired`, `invalid`, `unsupported` และเป็น NULL เมื่อยังไม่เคยตรวจ

#### Scenario: migration เพิ่มคอลัมน์สำเร็จ
- **WHEN** migration ของ change นี้รันสำเร็จ
- **THEN** `SHOW COLUMNS FROM publish_channels` มีคอลัมน์ `token_expires_at`, `data_access_expires_at`, `token_checked_at`, `token_status`, `token_error` ครบ
- **AND** ทุกแถวเดิมมี `token_status` เป็น NULL (ยังไม่เคยตรวจ) และไม่มีข้อมูลเดิมสูญหาย

### Requirement: ตรวจอายุ token ด้วย debug_token ของ Graph API
ระบบ SHALL ตรวจอายุ credentials ของช่องทาง `facebook` และ `instagram` ด้วย Graph API `debug_token` แล้วเขียนผลลง `publish_channels` — `debug_token` คืนทั้ง `expires_at`, `data_access_expires_at` และ `is_valid` ตรง ๆ จึงไม่ต้องเดาจากความล้มเหลวของการโพสต์

ค่า `expires_at = 0` SHALL ถูกเก็บเป็น NULL เพราะ 0 ในความหมายของ Graph API คือ "ไม่มีวันหมดอายุ" ไม่ใช่ Unix epoch ปี 1970 — Page token ที่ระบบใช้อยู่คืนค่า 0 การเก็บตรง ๆ จะทำให้ทุกช่องทางดูเหมือนหมดอายุมาแล้ว 56 ปี

`data_access_expires_at` SHALL ถูกเก็บและถือเป็นเดดไลน์คนละตัวจาก `token_expires_at` — token ที่ไม่มีวันหมดอายุยัง**หยุดเข้าถึงข้อมูล**ได้เมื่อพ้นหน้าต่าง data access ซึ่งของช่องทาง Facebook ปัจจุบันคือ 24 พ.ย. 2026 และเป็นเดดไลน์จริงที่ใกล้ที่สุด

`token_checked_at` SHALL บันทึกเวลาที่ตรวจครั้งล่าสุดทุกครั้งที่ตรวจ ไม่ว่าผลจะเป็นอย่างไร เพื่อให้แยก "ตรวจแล้วปกติ" ออกจาก "ไม่ได้ตรวจ" ได้

#### Scenario: token ที่ไม่มีวันหมดอายุเก็บเป็น NULL
- **WHEN** `debug_token` คืน `expires_at = 0` สำหรับ Page token
- **THEN** `publish_channels.token_expires_at` เป็น NULL
- **AND** `token_status` เป็น `valid` (ไม่ใช่ `expired`)

#### Scenario: เก็บหน้าต่าง data access แยกจากวันหมดอายุ token
- **WHEN** `debug_token` คืน `data_access_expires_at` เป็นเวลาในอนาคต
- **THEN** `publish_channels.data_access_expires_at` มีค่าเวลานั้น แม้ `token_expires_at` จะเป็น NULL

#### Scenario: token ใช้ไม่ได้แล้ว
- **WHEN** `debug_token` คืน `is_valid = false` หรือคืน error
- **THEN** `token_status` เป็น `invalid` และ `token_error` เก็บข้อความจาก API
- **AND** `token_checked_at` ยังถูกอัปเดต

#### Scenario: creds ไม่ครบไม่มี request ออกไป
- **WHEN** ช่องทางของ platform ที่รองรับไม่มี `access_token` ใน creds ที่ถอดรหัสได้
- **THEN** `token_status` เป็น `invalid` พร้อม `token_error` ที่ระบุว่า creds ไม่ครบ และไม่มี request ออกไปยัง Graph API

### Requirement: platform ที่ตรวจอายุไม่ได้ต้องแยกจากปกติ
ช่องทางที่ไม่ใช่ `facebook`/`instagram` SHALL ได้ `token_status = 'unsupported'` และ SHALL ไม่ถูกแสดงหรือรายงานว่าปกติ — `lotusdomino`, `wix`, `wordpress` และช่องทางอื่นไม่มี API บอกอายุ credentials การแสดงว่าปกติจะเป็นการรับประกันสิ่งที่ระบบไม่ได้ตรวจ

#### Scenario: ช่องทางที่ไม่รองรับได้สถานะ unsupported
- **WHEN** ระบบตรวจอายุ token ของช่องทาง `lotusdomino`
- **THEN** `token_status` เป็น `unsupported` และ `token_expires_at` เป็น NULL
- **AND** ไม่มี request ออกไปยัง Graph API

#### Scenario: unsupported ไม่ถูกนับเป็น error ของรอบรัน
- **WHEN** รอบตรวจพบช่องทาง `unsupported` หลายช่องทาง
- **THEN** จำนวน error ของรอบรันไม่เพิ่มขึ้นจากช่องทางเหล่านั้น

### Requirement: แจ้งเตือนล่วงหน้าก่อน credentials หมดอายุ
ระบบ SHALL ส่งแจ้งเตือนแบบด่วน (มีอีเมล) เมื่อช่องทางหนึ่งเหลือเวลาน้อยกว่า 7 วันก่อน `token_expires_at` **หรือ** `data_access_expires_at` หรือเมื่อ `token_status` เป็น `invalid`/`expired` โดยใช้ `alert_key` แยกตามช่องทาง เพื่อให้มีเวลาต่ออายุก่อนที่การเผยแพร่และการซิงก์เมตริกจะหยุด

การเปรียบเทียบวันหมดอายุ SHALL คำนวณจากฐานข้อมูล (`TIMESTAMPDIFF` เทียบ `NOW()`) ไม่ใช่ `time()` ของ PHP ตามข้อกำหนดเรื่องนาฬิกาของเส้นทาง cron

#### Scenario: เหลือน้อยกว่า 7 วันแล้วแจ้งเตือน
- **WHEN** รอบตรวจพบช่องทางที่ `data_access_expires_at` เหลือน้อยกว่า 7 วัน
- **THEN** มีแจ้งเตือนแบบด่วนพร้อมอีเมลที่ระบุชื่อช่องทาง, platform และวันหมดอายุ
- **AND** `token_status` ของช่องทางนั้นเป็น `expiring`

#### Scenario: token ใช้ไม่ได้แล้วแจ้งทันที
- **WHEN** รอบตรวจพบ `token_status = 'invalid'`
- **THEN** มีแจ้งเตือนแบบด่วนพร้อมอีเมลที่ระบุชื่อช่องทางและข้อความ error

#### Scenario: ยังเหลือเวลามากไม่รบกวน
- **WHEN** รอบตรวจพบช่องทางที่วันหมดอายุทั้งสองค่าเหลือมากกว่า 7 วันและ `is_valid = true`
- **THEN** `token_status` เป็น `valid` และไม่มีแจ้งเตือนถูกส่ง

#### Scenario: แจ้งซ้ำถูกจำกัดตามเพดานของตัวแจ้งเตือน
- **WHEN** รอบตรวจของ cron รันซ้ำหลายรอบขณะที่ช่องทางเดิมยังใกล้หมดอายุ
- **THEN** แจ้งเตือนถูกส่งไม่เกิน 1 ครั้งต่อชั่วโมงต่อช่องทาง

### Requirement: หน้าจัดการช่องทางแสดงอายุ credentials
`src/components/content/tabs/ChannelManagementSection.tsx` SHALL แสดงวันหมดอายุและสถานะ credentials ของแต่ละช่องทาง โดยข้อความที่ผู้ใช้เห็นทั้งหมดเป็นภาษาไทย และ SHALL แสดง `unsupported` เป็น "ตรวจสอบอายุไม่ได้" ไม่ใช่แสดงเป็นสถานะปกติ

หน้าจอ SHALL แยก "ยังไม่เคยตรวจ" (`token_status` เป็น NULL) ออกจาก "ตรวจแล้วปกติ" ให้ผู้ใช้เห็น

#### Scenario: แสดงวันหมดอายุและสถานะเป็นภาษาไทย
- **WHEN** แอดมินเปิดหน้าจัดการช่องทางหลังรอบตรวจทำงานแล้ว
- **THEN** ช่องทาง Facebook แสดงวันหมดอายุการเข้าถึงข้อมูลและป้ายสถานะภาษาไทย

#### Scenario: ช่องทางที่ตรวจไม่ได้แสดงตามความจริง
- **WHEN** แอดมินดูช่องทาง `lotusdomino` ในหน้าเดียวกัน
- **THEN** แสดงว่า "ตรวจสอบอายุไม่ได้" ไม่ใช่ป้ายว่าปกติ

#### Scenario: ยังไม่เคยตรวจแสดงต่างจากปกติ
- **WHEN** แอดมินดูช่องทางที่ `token_status` เป็น NULL
- **THEN** แสดงว่ายังไม่เคยตรวจ ไม่ใช่ป้ายว่าปกติ
