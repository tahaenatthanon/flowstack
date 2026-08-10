# Smart Template Library & Feature Integration — Design Spec

**Date:** 2026-05-08  
**Author:** wynnalister  
**Status:** Approved

---

## Overview

ระบบแบบสอบถามอัจฉริยะ (Smart Survey) สำหรับทีมขาย KTN ที่ใช้เก็บข้อมูลความต้องการลูกค้าผ่าน template สำเร็จรูป แล้วเชื่อมข้อมูลเข้า Sales Pipeline, คำนวณ Pain Point Score, และ trigger AI WBS Generator เมื่อปิดการขาย

---

## Scope

### In Scope
- Template management (Global by admin, Personal by sales user)
- Survey response collection (Internal + Public link pre-linked to Opportunity)
- Pain Point Scoring Engine (Weighted sum + Critical bonus)
- CRM integration (auto-update Opportunity stage + notes)
- WBS trigger (pre-fill AITaskGeneratorDialog เมื่อ stage=won)
- 4 Built-in templates

### Out of Scope
- Drag-and-drop form builder
- Conditional/branching question logic
- Email delivery system (ทีมขาย copy link ส่งเอง)
- External authentication สำหรับ survey respondent

---

## Architecture: Modular 4-Layer

```
Template Layer → Response Layer → Scoring Engine → Integration Layer
```

---

## Database Schema

### `survey_templates`
```sql
CREATE TABLE survey_templates (
  id            CHAR(36) NOT NULL,
  tenant_id     CHAR(36) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  industry      VARCHAR(100) NOT NULL DEFAULT 'general',
  strategic_theme VARCHAR(100) NOT NULL DEFAULT 'general',
  description   TEXT,
  is_global     TINYINT(1) NOT NULL DEFAULT 0,
  created_by    CHAR(36) NOT NULL,
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_survey_templates_tenant (tenant_id),
  KEY idx_survey_templates_created_by (created_by)
);
```

**`industry` values:** `tapioca_factory`, `food_pharma`, `it_service`, `general`  
**`strategic_theme` values:** `it_bottleneck`, `ai_governance`, `iso_compliance`, `general`  
**`is_global`:** 1 = Global template (admin only can create/edit), 0 = Personal

### `survey_questions`
```sql
CREATE TABLE survey_questions (
  id            CHAR(36) NOT NULL,
  template_id   CHAR(36) NOT NULL,
  order_index   INT NOT NULL DEFAULT 0,
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) NOT NULL,
  options_json  JSON,
  weight        DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  is_critical   TINYINT(1) NOT NULL DEFAULT 0,
  critical_bonus DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  max_score     DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_survey_questions_template (template_id)
);
```

**`question_type` values:** `yes_no`, `scale_1_5`, `multiple_choice`, `text`  
**`options_json`:** ใช้สำหรับ `multiple_choice` เช่น `["ตัวเลือก A","ตัวเลือก B"]`

### `survey_responses`
```sql
CREATE TABLE survey_responses (
  id              CHAR(36) NOT NULL,
  tenant_id       CHAR(36) NOT NULL,
  template_id     CHAR(36) NOT NULL,
  opportunity_id  CHAR(36) NOT NULL,
  company_id      CHAR(36) NOT NULL,
  token           VARCHAR(64) NOT NULL UNIQUE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  pain_point_score DECIMAL(5,2),
  pain_priority   VARCHAR(20),
  submitted_by    CHAR(36),
  submitted_at    DATETIME,
  created_at      DATETIME NOT NULL,
  updated_at      DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_survey_responses_tenant (tenant_id),
  KEY idx_survey_responses_opportunity (opportunity_id),
  KEY idx_survey_responses_token (token)
);
```

**`status` values:** `pending`, `in_progress`, `completed`  
**`pain_priority` values:** `critical` (80-100%), `high` (60-79%), `medium` (40-59%), `low` (<40%)  
**`submitted_by`:** NULL = กรอกโดยลูกค้าผ่าน public link, มีค่า = กรอกโดย sales user

### `survey_answers`
```sql
CREATE TABLE survey_answers (
  id                CHAR(36) NOT NULL,
  response_id       CHAR(36) NOT NULL,
  question_id       CHAR(36) NOT NULL,
  answer_value      TEXT NOT NULL,
  score_contribution DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  created_at        DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_survey_answers_response (response_id)
);
```

**`answer_value`:** เก็บเป็น string เสมอ — `"yes"/"no"`, `"1"`-`"5"`, text ตอบอิสระ

---

## Backend Files

### `api/surveys.php`
Template + Question CRUD (requires `requireAuth()`)

| Method | Params | Action |
|---|---|---|
| GET | - | List templates: global + own personal |
| GET | `?id=X` | Get template with questions |
| POST | body | Create template + questions |
| PUT | `?id=X` | Update template + questions |
| DELETE | `?id=X` | Delete template (owner or admin only) |

### `api/survey-responses.php`
Internal response management (requires `requireAuth()`)

| Method | Params | Action |
|---|---|---|
| POST | body | Create response + generate token |
| GET | `?opportunity_id=X` | List responses for opportunity |
| GET | `?id=X` | Get response detail + answers + score |

### `api/survey-public.php`
Public endpoint — NO `requireAuth()`

| Method | Params | Action |
|---|---|---|
| GET | `?token=X` | Get template + questions (validate token) |
| POST | `?token=X` | Submit answers → score → update opportunity |

**POST flow:**
1. Validate token → get response + template + questions
2. Insert survey_answers
3. Call scoring logic → set pain_point_score + pain_priority
4. Update survey_response status=completed
5. Append pain summary to sales_opportunities.notes
6. If opportunity.stage = 'lead' → update to 'qualified'

### `api/survey-scoring.php`
Included file (not a standalone endpoint)

```php
function calculateScore(array $answers, array $questions): array {
    // weighted sum + critical bonus
    // returns ['score' => float, 'max' => float, 'percentage' => float, 'priority' => string]
}
```

**Formula:**
```
base_score  = Σ (numeric_answer_value × question.weight)
bonus_score = Σ (question.critical_bonus WHERE is_critical=1 AND answer triggers critical)
total       = base_score + bonus_score
percentage  = (total / max_possible_score) × 100
priority    = critical(≥80%) | high(≥60%) | medium(≥40%) | low(<40%)
```

---

## Frontend Files

### Pages
- **`src/pages/SurveyPage.tsx`** — Tab-based: Templates tab + Responses tab (PermissionRoute `menuKey="sales"`)
- **`src/pages/SurveyPublicPage.tsx`** — Public form ไม่มี AppLayout, route `/survey/public/:token`

### Components
- **`CreateSurveyTemplateDialog.tsx`** — Form สร้าง/แก้ไข template + dynamic question list
- **`SendSurveyDialog.tsx`** — เลือก template, เลือก opportunity, สร้าง response + แสดง link
- **`SurveyResponseViewer.tsx`** — แสดง answers + score + pain_priority badge
- **`SurveyPublicForm.tsx`** — Form component ที่ render คำถามตาม question_type

### Hooks: `src/hooks/useSurveys.ts`
```typescript
useSurveyTemplates()       // GET list
useSurveyTemplate(id)      // GET single
useCreateSurveyTemplate()  // POST
useUpdateSurveyTemplate()  // PUT
useDeleteSurveyTemplate()  // DELETE
useSurveyResponses(opportunityId)  // GET responses for opportunity
useCreateSurveyResponse()  // POST (internal)
useSurveyPublic(token)     // GET public (no auth)
useSubmitSurveyPublic()    // POST public (no auth)
```

### Routes ใหม่ใน `src/App.tsx`
```tsx
<PermissionRoute menuKey="sales">
  <Route path="/surveys" element={<SurveyPage />} />
</PermissionRoute>
<Route path="/survey/public/:token" element={<SurveyPublicPage />} />
```

### Navigation ใน `src/components/AppSidebar.tsx`
เพิ่มใต้ Sales group: `{ label: "แบบสอบถาม", href: "/surveys", icon: ClipboardList }`

---

## Integration Points

### SalesPage.tsx
- เพิ่มปุ่ม "ส่ง Survey" ใน Opportunity card menu (3-dot menu)
- เมื่อลาก card → `won`: ตรวจสอบ completed survey → prompt เปิด AI WBS

### SalesDetailPage.tsx
- แสดง section "Survey & Pain Points" — Pain score badge + response list

### AITaskGeneratorDialog.tsx
- รับ prop `surveyContext?: { industry, theme, painPoints: string[], companyName: string }`
- Pre-fill AI prompt ด้วยข้อมูล survey

---

## User Flows

### Flow 1: Internal (ทีมขายกรอกเอง)
```
SurveyPage → New Response → เลือก template + opportunity
→ กรอกคำถามใน SurveyResponseViewer (inline)
→ Submit → score คำนวณ → แสดงผล
```

### Flow 2: External (ส่ง link ลูกค้า)
```
SalesPage (Opportunity card) → "ส่ง Survey"
→ SendSurveyDialog: เลือก template → POST สร้าง response + token
→ แสดง link: /survey/public/{token}
→ ทีมขาย copy link ส่งลูกค้า
→ ลูกค้าเปิด link → กรอก → submit
→ ระบบ auto-update opportunity
```

### Flow 3: WBS Trigger
```
Opportunity ถูก drag → 'won'
→ ระบบเช็ค survey_responses WHERE opportunity_id AND status='completed'
→ ถ้ามี: Dialog "เปิด AI WBS พร้อมข้อมูล Survey?"
→ กด "ใช่" → AITaskGeneratorDialog พร้อม surveyContext
```

---

## Built-in Templates

### 1. IT Bottleneck Audit
`industry=it_service`, `theme=it_bottleneck`, `is_global=1`

| # | คำถาม | Type | Weight | Critical | Bonus |
|---|---|---|---|---|---|
| 1 | ระบบปัจจุบันแลกเปลี่ยนข้อมูลอัตโนมัติหรือทำมือ? | scale_1_5 | 2.0 | ❌ | - |
| 2 | มีงาน Manual ซ้ำๆ ทุกวันหรือไม่? | yes_no | 1.5 | ❌ | - |
| 3 | เคยเกิดข้อมูลผิดพลาดเพราะพิมพ์ซ้ำระหว่างระบบ? | yes_no | 2.5 | ✅ | +10 |
| 4 | ระบบที่ใช้อยู่มีอายุเกิน 5 ปี? | yes_no | 1.5 | ❌ | - |
| 5 | ใช้เวลากี่ชม./สัปดาห์กับ Excel report? | scale_1_5 | 2.0 | ❌ | - |

### 2. AI Governance Readiness
`industry=general`, `theme=ai_governance`, `is_global=1`

| # | คำถาม | Type | Weight | Critical | Bonus |
|---|---|---|---|---|---|
| 1 | พนักงานใช้ AI tools ในการทำงานหรือไม่? | yes_no | 1.0 | ❌ | - |
| 2 | มีนโยบายควบคุม AI เป็นลายลักษณ์อักษร? | yes_no | 2.0 | ❌ | - |
| 3 | เคยมีข้อมูลลูกค้าถูกป้อนเข้า AI ภายนอก? | yes_no | 3.0 | ✅ | +15 |
| 4 | มีการแยก network สำหรับข้อมูลลับ? | yes_no | 2.0 | ❌ | - |
| 5 | ผู้บริหารตระหนักถึงความเสี่ยง AI Data Leakage? | scale_1_5 | 1.5 | ❌ | - |

### 3. ISO Compliance Survey
`industry=food_pharma`, `theme=iso_compliance`, `is_global=1`

| # | คำถาม | Type | Weight | Critical | Bonus |
|---|---|---|---|---|---|
| 1 | มีเอกสาร SOP ครบถ้วนหรือไม่? | scale_1_5 | 2.0 | ❌ | - |
| 2 | มีระบบ Traceability ติดตาม Lot/Batch? | yes_no | 2.5 | ✅ | +10 |
| 3 | เคยผ่าน Audit จากหน่วยงานภายนอก? | yes_no | 1.5 | ❌ | - |
| 4 | บันทึกคุณภาพยังเป็นกระดาษหรือ Excel? | yes_no | 2.0 | ✅ | +8 |
| 5 | มีแผนได้ ISO 9001 ภายใน 12 เดือน? | yes_no | 1.0 | ❌ | - |

### 4. Tapioca Factory Operations
`industry=tapioca_factory`, `theme=general`, `is_global=1`

| # | คำถาม | Type | Weight | Critical | Bonus |
|---|---|---|---|---|---|
| 1 | Stock/Inventory เป็น Real-time หรือปิดบัญชีรายวัน? | scale_1_5 | 2.0 | ❌ | - |
| 2 | มี BOM อัปเดตอัตโนมัติตามยอดผลิต? | yes_no | 2.5 | ✅ | +10 |
| 3 | เคยมีวัตถุดิบขาดมือกะทันหันโดยไม่มีแจ้งเตือน? | yes_no | 3.0 | ✅ | +12 |
| 4 | ต้นทุน/หน่วยคำนวณอัตโนมัติหรือทำมือ? | scale_1_5 | 2.0 | ❌ | - |
| 5 | ระบบรายงานโรงงานเชื่อมกับบัญชีโดยตรง? | yes_no | 2.0 | ❌ | - |

---

## Migration File
`database/migrations/2026_05_08_000000_create_survey_tables.sql`

---

## Menu Key
ใช้ `menuKey="sales"` (ไม่เพิ่ม key ใหม่) — Survey เป็นส่วนหนึ่งของ Sales module
