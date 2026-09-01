## ADDED Requirements

### Requirement: Research API analyzes completed jobs
Research API SHALL มี action `analyze` ที่รับ Research job ของ tenant เดียวกันและสถานะ `done` แล้วคืน Research brief ที่บันทึกใน job

#### Scenario: Analyze request succeeds
- **WHEN** authenticated user เรียก `analyze` ด้วย job id ที่เป็นของ tenant และสถานะ `done`
- **THEN** API เรียก AI analysis และคืน job id, brief, source metadata และเวลาวิเคราะห์

#### Scenario: Analyze request is not allowed
- **WHEN** job id ไม่พบ, อยู่คนละ tenant หรือสถานะไม่ใช่ `done`
- **THEN** API คืน error ที่เหมาะสมและไม่ส่งข้อมูล job เข้า AI prompt
