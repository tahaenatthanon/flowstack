## Why

Flowstack มีโมดูลหลักหลายตัวที่ยังทำงานได้ไม่ครบวงจร — ข้อมูลแสดงผลได้แต่วัดผลจริงไม่ได้, AI ยังเป็นแค่ chatbot ไม่ใช่ agent, การตลาดส่งเมลได้แต่ไม่มี tracking, และระบบยังไม่รองรับ SaaS lifecycle (register → trial → pay → onboard) ซึ่งทำให้ไม่สามารถเปิดให้ลูกค้าใช้งานจริงได้ในเชิงพาณิชย์

## What Changes

- **Project Management & Sales**: เพิ่ม KPI dashboard แสดงผลจริง (velocity, burn rate, win rate, cycle time) พร้อม drill-down และ target comparison
- **BPM**: เพิ่ม bottleneck analysis ต่อ stage (avg time, queue depth, throughput) และ SLA breach alerts ที่วัดผลได้จริงตาม workflow journey
- **ImpactOS**: ผูก impact simulation กับ actual outcomes — เปรียบเทียบ predicted vs actual เมื่องานเสร็จ, แสดง accuracy score
- **AI Chat (Agentic)**: อัปเกรดจาก chatbot เป็น agentic AI — สามารถ create tasks/projects/leads, run queries, trigger workflows, summarize reports และ take action ผ่าน tool-calling
- **Marketing — Email Tracking**: เพิ่ม open tracking pixel และ click redirect proxy, แสดง engagement metrics ต่อ campaign
- **Marketing — Customer Engagement**: เชื่อม email campaign outcomes กับ CRM (lead scoring, engagement timeline)
- **Marketing — Content & Distribution**: สร้างบทความ/วิดีโอ script ด้วย AI และ publish ไปยัง platform ที่ตั้งค่าไว้ตาม WAT Framework (Owned/Earned/Paid channels)
- **SaaS Operations**: หน้า registration, trial activation, Stripe/payment integration, และ setup wizard สำหรับ onboarding workspace ใหม่

## Capabilities

### New Capabilities
- `pm-sales-kpi-dashboard`: KPI dashboard สำหรับ project management และ sales พร้อม targets และ drill-down
- `bpm-bottleneck-analysis`: วิเคราะห์คอขวดต่อ stage ใน workflow journey พร้อม SLA alerts
- `impactos-outcome-tracking`: เปรียบเทียบ predicted vs actual impact เมื่องานเสร็จ
- `agentic-ai-chat`: AI chat ที่ทำ action ได้จริง (create, query, trigger) ผ่าน tool-calling
- `email-campaign-tracking`: Open/click tracking สำหรับ email campaigns
- `customer-engagement-crm`: เชื่อม campaign engagement กับ CRM lead scoring
- `content-distribution-wat`: สร้างและ publish content ตาม WAT Framework channels
- `saas-onboarding`: Registration, trial, payment, และ setup wizard

### Modified Capabilities
<!-- ไม่มี existing specs ที่ต้องแก้ requirement -->

## Impact

- **Backend (PHP)**: API ใหม่ใน `api/` สำหรับ tracking pixel, click proxy, agentic tool endpoints, BPM analytics, outcome tracking, Stripe webhooks, tenant registration
- **Frontend (React/TypeScript)**: หน้าใหม่และ components ใหม่ใน `src/pages/` และ `src/components/`
- **Database**: migration ใหม่สำหรับ email_events, campaign_clicks, impact_outcomes, ai_tool_calls, tenants, subscriptions
- **Third-party**: Stripe (payments), SMTP (existing แต่เพิ่ม tracking layer), social platform APIs (WAT distribution)
- **Infrastructure**: ต้องการ public-accessible URL สำหรับ tracking pixel และ click redirect (หรือ proxy)
