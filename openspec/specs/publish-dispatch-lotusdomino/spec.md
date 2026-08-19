# publish-dispatch-lotusdomino Specification

## Purpose

เพิ่มการรองรับ platform `lotusdomino` ใน `dispatch_content()` (`api/lib/publish-dispatch.php`) เพื่อให้ cron queue และ `send_now` เผยแพร่คอนเทนต์ไปยัง Lotus Domino agent endpoint ได้ แทนที่จะคืน `Unknown platform: lotusdomino`

## Requirements

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
