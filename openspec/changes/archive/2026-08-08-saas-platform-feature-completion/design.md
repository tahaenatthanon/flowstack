## Context

Flowstack ปัจจุบันเป็น project management SaaS ที่มี PHP + MariaDB backend และ React 18 + TypeScript frontend โมดูลหลักทำงานได้ระดับ CRUD แต่ขาด: (1) analytics layer ที่วัดผลได้จริง, (2) AI ที่ทำ action ได้, (3) email tracking, (4) SaaS lifecycle สำหรับ tenant onboarding การพัฒนาทั้งหมดอยู่บน branch `feat/bpm-journey-redesign`

## Goals / Non-Goals

**Goals:**
- เพิ่ม analytics/KPI ที่วัดผลได้จริงใน PM, Sales, BPM, ImpactOS
- อัปเกรด AI Chat เป็น agentic mode (tool-calling)
- Email campaign tracking (open pixel + click proxy)
- เชื่อม campaign engagement กับ CRM
- Content creation + WAT Framework distribution
- SaaS registration, trial, Stripe payment, setup wizard

**Non-Goals:**
- Mobile app หรือ native app
- Real-time collaborative editing
- Multi-region deployment
- Social platform OAuth (ใช้ API key/token ที่ตั้งค่าไว้เท่านั้น)

## Decisions

### 1. Email Tracking: Pixel + Proxy ใน PHP เดียวกัน
เพิ่ม `api/email-track.php` รับ GET request สำหรับ open tracking (1×1 PNG) และ click redirect XAMPP ให้ public URL ได้อยู่แล้วผ่าน ngrok หรือ domain จริง ไม่ต้องการ infrastructure ใหม่
- **ทางเลือกที่ไม่เลือก**: บริการ third-party (Sendgrid tracking) — ติด vendor lock-in และราคา

### 2. Agentic AI: Tool-calling ผ่าน existing AI provider
ใช้ provider ที่ตั้งค่าไว้ใน `ai_settings` (OpenAI/Anthropic) กับ function calling เพิ่ม `api/ai-agent-tools.php` เป็น tool registry และ executor
- **ทางเลือกที่ไม่เลือก**: LangChain/LangGraph — เพิ่ม dependency ที่ไม่จำเป็น, PHP native calls เพียงพอ

### 3. BPM Analytics: Query-time aggregation บน existing tables
ไม่สร้าง materialized view ใหม่ — aggregate จาก `workflow_journey_instances` + `workflow_stage_logs` ที่มีอยู่แล้ว เพิ่ม index ที่จำเป็น
- **ทางเลือกที่ไม่เลือก**: Event sourcing/CQRS — over-engineering สำหรับขนาดนี้

### 4. SaaS Multi-tenancy: Tenant ID column บนทุก table
เพิ่ม `tenant_id` และ `tenants` + `subscriptions` tables ใช้ Row-Level Security ผ่าน PHP middleware ไม่ใช้ separate database ต่อ tenant
- **ทางเลือกที่ไม่เลือก**: Database-per-tenant — ยาก migrate และ cost สูง

### 5. WAT Distribution: Queue-based async publishing
สร้าง `content_publish_queue` table, cron job รัน publish ไปยัง platform APIs ทีละรายการ ป้องกัน timeout
- **ทางเลือกที่ไม่เลือก**: Synchronous publish — API platform หลายตัวช้า ทำให้ UI ค้าง

### 6. ImpactOS Outcome Tracking: Link งานที่เสร็จกับ simulation
เมื่อ task/project status เปลี่ยนเป็น `done` ระบบ auto-compare กับ impact simulation ล่าสุดของ project นั้น บันทึกใน `impact_outcomes` table

## Risks / Trade-offs

- **[Risk] Email tracking ต้องการ public URL** → Mitigation: เพิ่ม config `APP_PUBLIC_URL` ใน admin settings, fallback graceful ถ้าไม่ตั้งค่า (ไม่ embed pixel)
- **[Risk] Stripe integration ซับซ้อน** → Mitigation: ใช้ Stripe Checkout hosted page ก่อน (redirect-based) ไม่ทำ custom payment form
- **[Risk] Social platform API rate limits** → Mitigation: queue + retry + แสดง status ให้ user เห็น
- **[Risk] Agentic AI อาจทำ destructive action** → Mitigation: ทุก tool ต้องผ่าน permission check เดิม, ไม่มี delete tool ใน v1
- **[Risk] tenant_id migration บน existing data** → Mitigation: สร้าง default tenant สำหรับ existing data ทั้งหมด, migration script ทำทีละ table

## Migration Plan

1. สร้าง migration files ทีละ module ตามลำดับ: tenants → email_events → impact_outcomes → content tables
2. Backfill `tenant_id` บน existing rows ด้วย default tenant UUID
3. Deploy PHP changes (additive, backward compatible)
4. Enable frontend features ทีละ module ผ่าน feature flag ใน `company_settings`
5. Rollback: ทุก migration มี `-- ROLLBACK:` comment พร้อม DROP/ALTER กลับ

## Open Questions

- Stripe: ใช้ Test mode ก่อน หรือ Production ตั้งแต่แรก?
- WAT platforms: รองรับแพลตฟอร์มไหนใน v1 (Facebook, LINE, YouTube, Blog)?
- Trial period: กี่วัน? (สมมติ 14 วัน ถ้าไม่ระบุ)
- Tenant isolation: ข้อมูล existing ทั้งหมด assign ให้ tenant เดิม (single-tenant mode) ก่อนหรือไม่?
