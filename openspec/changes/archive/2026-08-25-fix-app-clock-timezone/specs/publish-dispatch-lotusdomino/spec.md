## MODIFIED Requirements

### Requirement: dispatch_lotusdomino โพสต์ JSON ไปยัง Domino agent
`dispatch_lotusdomino()` SHALL โพสต์ JSON ไปยัง `channel.endpoint_url` ด้วย method POST พร้อม header `Content-Type: application/json` และ payload array ที่มีฟิลด์ `Date`, `Title`, `Body`, `Excerpt`, `Slug`, `SEOTitle`, `MetaDescription`, `Tags`, `AttachPhoto` — ค่าของฟิลด์ `Date` SHALL เป็นเวลาท้องถิ่นเดียวกับที่ฐานข้อมูลใช้ ไม่ใช่เวลาตาม `date.timezone` ของ PHP เพราะค่านี้แสดงเป็นวันที่ของบทความบนเว็บไซต์ลูกค้า และเมื่อไม่มีเวลาที่ตั้งไว้ (`seo['date']`, `scheduled_at`, `scheduled_date`) fallback SHALL มาจากนาฬิกาฐานข้อมูล

#### Scenario: payload มีฟิลด์ครบ
- **WHEN** `dispatch_lotusdomino()` ถูกเรียกพร้อม channel ที่มี `endpoint_url`
- **THEN** POST ไปยัง `endpoint_url` ด้วย JSON payload ที่มี key `Date`, `Title`, `Body`, `Excerpt`, `Slug`, `SEOTitle`, `MetaDescription`, `Tags`, `AttachPhoto`

#### Scenario: endpoint_url ว่างคืน error
- **WHEN** `dispatch_lotusdomino()` ถูกเรียกแต่ channel ไม่มี `endpoint_url`
- **THEN** คืน `['success' => false, 'error' => 'Lotus Domino endpoint_url missing']`

#### Scenario: ฟิลด์ Date ที่ไม่ได้ตั้งเวลาไว้ใช้นาฬิกาฐานข้อมูล
- **WHEN** เผยแพร่คอนเทนต์ไป `lotusdomino` โดยไม่มีเวลาที่ตั้งไว้ (`seo['date']`, `scheduled_at` และ `scheduled_date` ว่างทั้งหมด)
- **THEN** ฟิลด์ `Date` ใน payload ต่างจาก `SELECT NOW()` ของฐานข้อมูลไม่เกิน 2 วินาที

#### Scenario: ฟิลด์ Date ที่ตั้งเวลาไว้ถูกส่งตามเดิม
- **WHEN** เผยแพร่คอนเทนต์ที่มีเวลาตั้งไว้ (`seo['date']`, `scheduled_at` หรือ `scheduled_date` มีค่า)
- **THEN** ฟิลด์ `Date` ใน payload เป็นค่าที่ตั้งไว้นั้นตามลำดับความสำคัญเดิม ไม่ถูกแทนด้วยเวลาปัจจุบัน
