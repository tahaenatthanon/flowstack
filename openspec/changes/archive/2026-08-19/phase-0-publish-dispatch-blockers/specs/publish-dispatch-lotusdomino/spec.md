## ADDED Requirements

### Requirement: dispatch_content รองรับ platform lotusdomino
`dispatch_content()` ใน `api/lib/publish-dispatch.php` SHALL รองรับ platform `lotusdomino` โดยมีฟังก์ชัน `dispatch_lotusdomino()` และ arm ใน `match($platform)` เพื่อให้ cron queue (`publish-scheduler.php`) และ `send_now` (`content-publish.php`) เผยแพร่คอนเทนต์ไปยัง Lotus Domino agent endpoint ได้แทนที่จะคืน `Unknown platform: lotusdomino`

#### Scenario: cron queue เผยแพร่ไป lotusdomino ได้
- **WHEN** `publish-scheduler.php` ประมวลผลแถว pending ที่ channel มี `platform='lotusdomino'` และเรียก `dispatch_content('lotusdomino', ...)`
- **THEN** ไม่คืน error `Unknown platform: lotusdomino` และเรียก `dispatch_lotusdomino()` แทน

#### Scenario: send_now เผยแพร่ไป lotusdomino ได้
- **WHEN** ผู้ใช้เรียก `send_now` กับ channel `lotusdomino`
- **THEN** `dispatch_content('lotusdomino', ...)` คืนผลจาก `dispatch_lotusdomino()` (ไม่ใช่ error unknown platform)

### Requirement: dispatch_lotusdomino โพสต์ JSON ไปยัง Domino agent
`dispatch_lotusdomino()` SHALL โพสต์ JSON ไปยัง `channel.endpoint_url` ด้วย method POST พร้อม header `Content-Type: application/json` และ payload array ที่มีฟิลด์ `Date`, `Title`, `Body`, `Excerpt`, `Slug`, `SEOTitle`, `MetaDescription`, `Tags`, `AttachPhoto`

#### Scenario: payload มีฟิลด์ครบ
- **WHEN** `dispatch_lotusdomino()` ถูกเรียกพร้อม channel ที่มี `endpoint_url`
- **THEN** POST ไปยัง `endpoint_url` ด้วย JSON payload ที่มี key `Date`, `Title`, `Body`, `Excerpt`, `Slug`, `SEOTitle`, `MetaDescription`, `Tags`, `AttachPhoto`

#### Scenario: endpoint_url ว่างคืน error
- **WHEN** `dispatch_lotusdomino()` ถูกเรียกแต่ channel ไม่มี `endpoint_url`
- **THEN** คืน `['success' => false, 'error' => 'Lotus Domino endpoint_url missing']`

### Requirement: dispatch_lotusdomino assume สำเร็จเมื่อไม่มี curl error
`dispatch_lotusdomino()` SHALL คืน `success=true` เมื่อการโพสต์ไม่มี curl error (Domino agent เป็น black-box ไม่คืน HTTP error ที่เชื่อถือได้) — สอดคล้องกับ inline handler เดิมใน `api/brand-content.php`

#### Scenario: curl ไม่มี error ถือว่าสำเร็จ
- **WHEN** `dispatch_lotusdomino()` POST สำเร็จโดยไม่มี curl error
- **THEN** คืน `['success' => true, ...]`

#### Scenario: curl error คืน failure
- **WHEN** `dispatch_lotusdomino()` เจอ curl error
- **THEN** คืน `['success' => false, 'error' => ...]`
