## Why

การเปิดใช้ SEO gate ในปัจจุบันจะทำให้คอนเทนต์ที่มีอยู่เผยแพร่ไม่ได้ทั้งหมด เพราะ generator ใส่ `<h1>` เป็นชื่อบทความ แต่ checklist ตีความว่า h1 ทุกตัวเป็นข้อผิดพลาด นอกจากนี้ publish flow ยังส่งสคริปต์เดียวกันไปทุกแพลตฟอร์ม และการตรวจชนิดคอนเทนต์อาศัย platform จนวิดีโอที่เผยแพร่บน Facebook หรือ Instagram ถูกตรวจผิดชุดกฎ

ต้องแก้พฤติกรรมพื้นฐานเหล่านี้ก่อนต่อยอด Research และหน้า Content Pipeline เพื่อให้การตรวจ SEO แสดงสถานะตามข้อมูลจริง และการเผยแพร่ใช้เนื้อหาที่เหมาะกับแต่ละช่องทางโดยไม่กระทบ tenant อื่น

## What Changes

- ปรับ SEO checklist ให้ h1 แรกที่เป็นชื่อบทความยอมรับได้ และแจ้งไม่ผ่านเมื่อมี h1 มากกว่าหนึ่งตัว
- แยกชุดกฎ SEO ตามชนิดคอนเทนต์ โดยวิดีโอข้ามกฎที่ใช้เฉพาะบทความ เช่น h2 จำนวนคำ และ internal link แต่ยังตรวจ metadata และ hashtags ที่เกี่ยวข้อง
- แยกสถานะข้อมูลที่ยังไม่ได้กรอก/ยังไม่ได้กำหนดออกจากสถานะไม่ผ่าน โดยไม่ทำให้กฎ fail ที่จำเป็นต่อการเผยแพร่ถูกข้าม
- ทำให้ฟิลด์ SEO ทั้ง 6 รายการบันทึกผ่าน endpoint แก้ไขคอนเทนต์ได้ และไม่ให้ LLM สร้าง `meta_keywords` เองเมื่อไม่มี Research
- ใช้ชนิดคอนเทนต์จริงในการเลือก prompt, SEO ruleset และ publish gate แทนการเดาจาก platform
- ให้ publish flow เลือกสคริปต์ของแต่ละ platform จาก `article_content.scripts` ก่อน dispatch และไม่ใช้ผลของ channel สุดท้ายมาแทนความจริงของคอนเทนต์ทั้งหมด
- ให้ cron publish ใช้ข้อมูลชนิดคอนเทนต์เดียวกับ send-now และคง approval/SEO/idempotency gates ก่อน dispatch
- ปิดช่องโหว่การอ่านข้อมูลคอนเทนต์ข้าม tenant ในเส้นทางสร้างบทความ

## Capabilities

### New Capabilities

ไม่มี

### Modified Capabilities

- `content-seo-checklist`: เปลี่ยนกฎ h1, เพิ่ม ruleset ตามชนิดคอนเทนต์, เพิ่มสถานะข้อมูลที่ยังไม่ได้กำหนด และคง SEO gate ที่บล็อกเฉพาะกฎ `fail`
- `publish-send-now-idempotency`: คงการป้องกันการส่งซ้ำและผลรายช่องทาง พร้อมใช้ payload เฉพาะ platform โดยไม่ทำลายผลของช่องทางอื่น

## Impact

- Backend: `api/lib/seo-checklist.php`, `api/content-publish.php`, `api/cron/publish-scheduler.php`, `api/content-items.php`, `api/brand-content.php`
- ข้อมูล: ไม่เพิ่มตารางหรือแก้ schema ใน change นี้
- พฤติกรรมที่เปลี่ยน: คอนเทนต์ที่ไม่มี Research จะเก็บ `meta_keywords` ว่างตาม requirement และ `/content-planner` จะไม่เติม keyword จาก LLM เอง
- ต้องตรวจ regression ของการสร้าง แก้ไข อนุมัติ ตั้งเวลา และเผยแพร่ทั้งบทความ โซเชียล และวิดีโอ รวมถึง tenant isolation
