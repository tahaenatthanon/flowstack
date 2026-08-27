<?php
// api/lib/cron-constants.php
//
// ค่าคงที่เรื่องเวลาของระบบ cron — แยกออกมาจาก api/lib/cron-runner.php เพื่อให้
// api/health.php อ่านค่าเดียวกันได้โดยไม่ต้อง require cron-runner.php
//
// ทำไมต้องแยก: cron-runner.php require config.php ซึ่ง exit 500 ทันทีเมื่อไม่มี JWT_SECRET
// และยัง require ops-alert.php ต่ออีกทอด ตัวตรวจสุขภาพที่ตายพร้อมสิ่งที่มันต้องตรวจ
// นั้นไร้ประโยชน์ (เหตุผลเดียวกับที่ health.php ไม่ require config.php — ดูหัวไฟล์นั้น)
// การคัดลอกเลข 120 ไปไว้ใน health.php อีกที่ก็ไม่ได้ เพราะจะเพี้ยนเงียบ ๆ เมื่อแก้ที่เดียว
//
// ⚠️ ไฟล์นี้ต้องไม่มี require และไม่มี side effect ใด ๆ — มีแค่ define ที่ป้องกันซ้ำแล้ว
// จึงปลอดภัยทั้งกับ health.php และกับงาน cron แบบ type='include' ที่โหลดหลายไฟล์
// เข้าโปรเซสเดียวกัน

// เพดานเวลาที่ถือว่างาน "ค้าง" — ใช้ค่าเดียวกันทั้งใน jobState() ของ cron-manager
// และในตัวเลือกงานของ tick.php ถ้าใช้ค่าต่างกัน หน้าแอดมินจะบอกว่า "running"
// ขณะที่ tick ยิงงานซ้อนไปแล้ว
if (!defined('CRON_STUCK_SECONDS')) define('CRON_STUCK_SECONDS', 600);

// เพดานการค้นหา next_run_at เป็นนาที (~366 วัน) กัน expression ที่ match ไม่ได้เลย
// เช่น '0 0 30 2 *' (30 กุมภาพันธ์) ทำให้ลูปไม่จบ
if (!defined('CRON_NEXT_RUN_MAX_MINUTES')) define('CRON_NEXT_RUN_MAX_MINUTES', 527040);

// ความล่าช้าที่ยอมรับได้ก่อนถือว่างาน "เลยกำหนด" — tick ถูกเรียกทุก 1 นาที
// จึงเผื่อไว้ 2 นาที ถ้า next_run_at เลยมานานกว่านี้แปลว่าไม่มีใครเรียก tick จริง
// (ตัวตั้งเวลาระดับ OS ไม่ได้ลงทะเบียน / ถูกปิด / เครื่องหลับ) — หน้าแอดมินและ
// api/health.php ต้องบอกให้เห็น
if (!defined('CRON_OVERDUE_SECONDS')) define('CRON_OVERDUE_SECONDS', 120);
