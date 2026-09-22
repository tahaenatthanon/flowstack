@All API Post บทความ web www.ktnbusinesssolutions.com ครับ
API สำหรับโพสต์บทความที่พบในโค้ดคือ **`POST /api/ai/save-bulk-posts.php`** ครับ

- **เว็บจริง ตามโดเมนในเอกสาร:** [https://www.ktnbusinesssolutions.com/api/ai/save-bulk-posts.php](https://www.ktnbusinesssolutions.com/api/ai/save-bulk-posts.php)
- **เครื่อง Local:** [http://localhost/ktnbs/api/ai/save-bulk-posts.php](http://localhost/ktnbs/api/ai/save-bulk-posts.php)

ส่ง Header Content-Type: application/json พร้อมข้อมูลตัวอย่าง:

json
{
  "is_published": true,
  "posts": [
    {
      "title_th": "หัวข้อบทความ",
      "content_th": "<p>เนื้อหาบทความ</p>",
      "category_id": 1,
      "slug": "my-new-article"
    }
  ]
}

ใช้ category_id ที่มีอยู่จริง และเปลี่ยน is_published เป็น false หากต้องการเก็บเป็นฉบับร่าง

**ต้องล็อกอินด้วยบัญชี admin และส่ง Session Cookie ไปด้วย** โดยล็อกอินผ่าน POST /api/auth.php?action=login ด้วยฟอร์ม email และ password — endpoint นี้ยังไม่รองรับ API Key หรือ Bearer Token

อ้างอิงจาก [โค้ด API](/C:/xampp/htdocs/ktnbs/api/ai/save-bulk-posts.php) ยังไม่ได้ทดสอบโพสต์บนเว็บจริงครับ

ส่วน CodeGraph ที่อนุญาตให้สร้างดัชนี ยังทำไม่ได้เพราะเครื่องไม่พบคำสั่ง codegraph