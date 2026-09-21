# campaign-ai-brand-context Specification

## Purpose

TBD - ให้ผู้ใช้เปิดใช้งาน brand context (จากไฟล์ brand_md ที่อัปโหลดไว้) เป็นแหล่งข้อมูลอ้างอิงเพิ่มเติมสำหรับ AI ตอนสร้างเนื้อหาแคมเปญ ทั้งแบบสร้างเดี่ยวและแบบ batch

## Requirements

### Requirement: Brand Context Opt-In Toggle
Both the single campaign "สร้างด้วย AI" panel and the "AI วางแผนแคมเปญ" (batch) dialog SHALL offer a checkbox to enable brand context for that generation request, defaulting to unchecked.

#### Scenario: Checkbox visible in single-generate panel
- **WHEN** a user opens the "สร้างด้วย AI" panel
- **THEN** a checkbox to enable brand context is visible, unchecked by default

#### Scenario: Checkbox visible in batch planning dialog
- **WHEN** a user opens the "AI วางแผนแคมเปญ" dialog
- **THEN** a checkbox to enable brand context is visible, unchecked by default

### Requirement: Brand Context Limited To brand_md
WHEN brand context is enabled, the system SHALL only include `brand_contexts` rows for the current tenant where `file_type='brand_md'`. The system SHALL NOT include rows of type `sop_md` or `custom`.

#### Scenario: Only brand_md rows are included
- **WHEN** brand context is enabled and the tenant has both a `brand_md` and a `sop_md` brand context uploaded
- **THEN** only the `brand_md` row's content is included in the generation request's context, and the `sop_md` row's content is not

### Requirement: Brand Context Grounds Generation
WHEN brand context is enabled, the system SHALL include the tenant's `brand_md` content as grounding context in the AI prompt for that generation request (single-generate or batch), regardless of whether a product or topic/idea is also provided.

#### Scenario: Brand context alone grounds the generated content
- **WHEN** a user enables brand context with no product and no typed idea
- **THEN** the generated content reflects the tenant's brand identity as described in their `brand_md`

#### Scenario: Brand context combines with product and idea
- **WHEN** a user enables brand context and also selects a product or types an idea
- **THEN** the AI prompt includes both the brand context and the product/idea information together

### Requirement: Missing Brand Context Does Not Fail Generation
WHEN brand context is enabled but the tenant has no `brand_contexts` row with `file_type='brand_md'`, the system SHALL still allow generation to proceed if another input source (product or typed idea) is present, and SHALL inform the user that no brand context was found rather than failing silently or blocking generation outright.

#### Scenario: No brand.md uploaded yet, but a product is selected
- **WHEN** a user enables brand context, has no `brand_md` uploaded, but has selected a product
- **THEN** generation proceeds using the product, and the user is informed that no brand context was found to include

#### Scenario: No brand.md uploaded and no other input source
- **WHEN** a user enables brand context, has no `brand_md` uploaded, has selected no product, and has typed no idea
- **THEN** the system prevents generation and indicates at least one usable input source is needed (an uploaded brand context, a product, or a typed idea)
