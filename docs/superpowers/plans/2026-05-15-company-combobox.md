# Company Picker — CompanyCombobox Adoption ✅ DONE (2026-05-18)

> **Goal:** แทนที่ static `<Select>` สำหรับ company ใน dialogs ทั้งหมดด้วย `CompanyCombobox` ที่มีอยู่แล้ว (`src/components/CompanyCombobox.tsx`) เพื่อ searchable dropdown + type-ahead แทน scrolling ยาวๆ

---

## Root Cause Analysis

`CompanyCombobox.tsx` มีอยู่และทำงานได้ แต่ยังไม่ได้ใช้ใน dialogs ทุกที่

| Dialog / Page | มี CompanyCombobox แล้ว? |
|--------------|------------------------|
| `CreateProjectDialog.tsx` | ✅ ใช้แล้ว |
| `CreateOpportunityDialog.tsx` | ✅ ใช้แล้ว |
| `CreateQuotationDialog.tsx` | ❓ ต้องตรวจ |
| `CreateCustomerDialog.tsx` | ❓ ต้องตรวจ |
| `DataQualityDashboard.tsx` | ❓ ต้องตรวจ |
| `CompaniesPage.tsx` | ❓ context ต่างออกไป — filter/picker? |
| `EditProjectDialog.tsx` | ❓ ต้องตรวจ |

---

## File Map

**Modified (audit first → แก้เฉพาะที่ยังใช้ static Select):**
- `src/components/CreateQuotationDialog.tsx`
- `src/components/CreateCustomerDialog.tsx`
- `src/components/EditProjectDialog.tsx`
- อื่นๆ ที่พบจาก audit

---

## Task 1: Audit — หา static company Select ทั้งหมด

- [ ] **Step 1: Grep หา pattern**

```bash
grep -rn "company\|compan" src/components src/pages --include="*.tsx" \
  | grep -i "select\|option\|<Select" | grep -v CompanyCombobox
```

หรือใช้ Editor: ค้นหา `SelectItem` ร่วมกับ `company` ในไฟล์ `.tsx`

- [ ] **Step 2: บันทึกรายการ dialogs ที่ยังต้องแก้**

ตัวอย่าง pattern ที่ต้องแก้:
```tsx
// ❌ static Select
<Select value={companyId} onValueChange={setCompanyId}>
  <SelectContent>
    {companies.map(c => (
      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

```tsx
// ✅ CompanyCombobox
<CompanyCombobox
  value={companyId}
  onChange={setCompanyId}
  placeholder="ค้นหาบริษัท..."
/>
```

---

## Task 2: แก้ไข Dialogs

สำหรับทุก dialog ที่พบใน Task 1:

- [ ] **Step 1: เพิ่ม import CompanyCombobox**

```tsx
import CompanyCombobox from '@/components/CompanyCombobox';
```

- [ ] **Step 2: แทนที่ static `<Select>` ด้วย `<CompanyCombobox>`**

ตรวจ props ที่ `CompanyCombobox` รับ:
```tsx
interface CompanyComboboxProps {
  value: string;       // company id หรือ ''
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

ถ้า props ต่างกัน → ดู `src/components/CompanyCombobox.tsx` เพื่อ confirm interface

- [ ] **Step 3: ลบ companies data fetching ที่ไม่จำเป็น**

`CompanyCombobox` fetch companies เอง — ถ้า dialog เดิม fetch `companies` list แยก และใช้แค่เพื่อ Select นี้ → ลบ fetch นั้นออกเพื่อลด redundant API calls

```tsx
// ลบถ้าใช้แค่สำหรับ company select:
// const { data: companies = [] } = useQuery({ queryKey: ['companies'], ... });
```

---

## Task 3: ตรวจสอบ CompanyCombobox รองรับ edge cases

- [ ] **Step 1: ตรวจสอบ empty state**

ถ้าไม่มีบริษัทในระบบ → `CompanyCombobox` แสดง "ไม่พบบริษัท" หรือ placeholder ที่เหมาะสม

- [ ] **Step 2: ตรวจสอบ disabled state**

บาง dialog ต้องการ disable company select ในบางเงื่อนไข (เช่น ถ้า edit mode) — ตรวจว่า `disabled` prop ทำงาน

- [ ] **Step 3: ตรวจสอบ initial value**

เมื่อ edit (เปิด dialog พร้อม existing data) → ค่า company ที่มีอยู่ต้องแสดงชื่อบริษัทให้ถูกต้อง ไม่ใช่แค่ UUID

---

## Task 4: Build Check

- [ ] **Step 1: TypeScript check**

```bash
pnpm build 2>&1 | grep -i error
```

- [ ] **Step 2: ทดสอบ Manual**

เปิดแต่ละ dialog ที่แก้ไข → ตรวจ:
1. Combobox แสดงรายการบริษัท
2. พิมพ์ค้นหาได้ (filter)
3. เลือกบริษัทแล้ว dialog บันทึก company_id ถูกต้อง
4. Edit mode แสดงชื่อบริษัทที่มีอยู่

---

## Final Verification

- [ ] `pnpm build` — TypeScript clean
- [ ] ไม่มี static `<Select>` สำหรับ company เหลืออยู่ใน dialogs
- [ ] CompanyCombobox ทำงานได้ใน: CreateQuotation, CreateCustomer, EditProject (ที่แก้ไข)
- [ ] Search/filter ทำงาน (พิมพ์ชื่อ filter ได้)
