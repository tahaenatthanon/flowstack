## ADDED Requirements

### Requirement: Email Open Tracking
ระบบ SHALL embed tracking pixel (1×1 PNG) ในทุก email campaign และบันทึก open event เมื่อผู้รับเปิดอ่าน

#### Scenario: Tracking pixel embedded in email
- **WHEN** campaign email ถูกส่ง
- **THEN** email body มี `<img>` tag ที่ชี้ไปยัง `{APP_PUBLIC_URL}/api/email-track.php?type=open&token={unique_token}`

#### Scenario: Open event recorded
- **WHEN** ผู้รับเปิด email และ email client load image
- **THEN** ระบบบันทึก open event ใน `email_events` table พร้อม timestamp และ IP (ถ้ามี)

#### Scenario: No public URL configured
- **WHEN** `APP_PUBLIC_URL` ไม่ได้ตั้งค่าใน admin settings
- **THEN** ระบบส่ง email โดยไม่ embed pixel และแสดง warning ใน campaign dashboard

### Requirement: Email Click Tracking
ระบบ SHALL แทนที่ links ใน email ด้วย redirect proxy URL และบันทึก click event

#### Scenario: Link replaced with proxy
- **WHEN** campaign email ถูกส่ง
- **THEN** ทุก URL ใน email body ถูกแทนด้วย `{APP_PUBLIC_URL}/api/email-track.php?type=click&token={token}&url={encoded_original_url}`

#### Scenario: Click event recorded and redirect
- **WHEN** ผู้รับคลิก link ใน email
- **THEN** ระบบบันทึก click event และ redirect ผู้รับไปยัง original URL ทันที

### Requirement: Campaign Engagement Dashboard
ระบบ SHALL แสดง open rate, click rate, และ unsubscribe rate ต่อ campaign

#### Scenario: View campaign metrics
- **WHEN** user เปิด campaign detail
- **THEN** ระบบแสดง sent count, open count, open rate (%), click count, click rate (%), unsubscribe count
