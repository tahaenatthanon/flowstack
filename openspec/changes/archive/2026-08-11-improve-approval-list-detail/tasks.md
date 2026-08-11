## 1. ปรับรูปแบบ Stat Card

- [x] 1.1 นำเข้า `Card`, `CardHeader`, `CardTitle`, `CardContent` จาก `@/components/ui/card` ใน `ContentApprovalPage.tsx`
- [x] 1.2 แทนที่ `div.stat-card.card-hover` ด้วย `<Card>` component — `CardHeader` แสดง Title + Icon (`flex flex-row items-center justify-between space-y-0 pb-2`), `CardContent` แสดง Count
- [x] 1.3 Title ใช้ `<CardTitle className="text-sm font-medium">` และ Icon ใช้ `className="h-4 w-4 {color}"`
- [x] 1.4 Count ใช้ `<div className="text-2xl font-bold">`
- [x] 1.5 Grid ใช้ `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3` — ลบ CSS class `stat-card card-hover` ออก
- [x] 1.6 Icon colors คงเดิม: `text-warning`, `text-success`, `text-info`, `text-destructive`

## 2. เพิ่มการเปิดดูรายละเอียด Content จาก Approval List

- [ ] 2.1 เพิ่ม `useState` สำหรับ `detailItem` (`ContentItem | null`) ใน `ContentApprovalPage`
- [ ] 2.2 นำเข้า `ContentDetailView` จาก `@/components/content/views/ContentDetailView`
- [ ] 2.3 เพิ่ม `onClick={() => setDetailItem(item)}` และ className `cursor-pointer hover:bg-muted/30` บน `TableRow`
- [ ] 2.4 เพิ่ม `e.stopPropagation()` บนปุ่มอนุมัติและปฏิเสธเพื่อป้องกัน row click
- [ ] 2.5 เพิ่ม `<Dialog>` ที่เปิดเมื่อ `detailItem` ไม่เป็น null — ภายในแสดง `<ContentDetailView item={detailItem} onBack={() => setDetailItem(null)} />`
- [ ] 2.6 Dialog ใช้ className `max-w-4xl max-h-[90vh] overflow-y-auto`

## 3. ตรวจสอบความเรียบร้อย

- [ ] 3.1 ตรวจสอบว่า `pnpm build` ผ่านไม่มี TypeScript error
- [ ] 3.2 ตรวจสอบว่า Stat Cards แสดง Title + Icon ในแถวเดียวกันและ Count ด้านล่างถูกต้อง
- [ ] 3.3 ตรวจสอบว่าคลิกที่แถว TableRow เปิด Dialog แสดง ContentDetailView
- [ ] 3.4 ตรวจสอบว่าปุ่มอนุมัติ/ปฏิเสธยังทำงานปกติ ไม่เปิด Dialog เมื่อกด
- [ ] 3.5 ตรวจสอบว่าการดูรายละเอียดไม่เปลี่ยน Status ของ Content
- [ ] 3.6 ตรวจสอบว่า UI อื่นที่ไม่เกี่ยวข้องไม่ได้รับผลกระทบ
