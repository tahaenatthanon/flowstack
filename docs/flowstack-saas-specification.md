# FlowStack SaaS — Product Specification & Feature Guide
**Version:** 1.0.0 | **Status:** Draft | **Last Updated:** 2026-06-04

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Design Principles](#2-architecture--design-principles)
3. [AI Foundation Layer](#3-ai-foundation-layer)
4. [CRM — Customer Relationship Management](#4-crm--customer-relationship-management)
5. [Contact Management](#5-contact-management)
6. [Expense Management](#6-expense-management)
7. [Project Management](#7-project-management)
8. [Helpdesk](#8-helpdesk)
9. [Mail Marketing](#9-mail-marketing)
10. [AI Content Planner](#10-ai-content-planner)
11. [Survey](#11-survey)
12. [Workflow Engine (BPM)](#12-workflow-engine-bpm)
13. [AI Orchestrator & AI Agents](#13-ai-orchestrator--ai-agents)
14. [AI Dashboard & KPI](#14-ai-dashboard--kpi)
15. [Notification System](#15-notification-system)
16. [Settings & Parameters](#16-settings--parameters)
17. [Data Management](#17-data-management)
18. [Security & Access Control](#18-security--access-control)
19. [Integration & API](#19-integration--api)
20. [Non-Functional Requirements](#20-non-functional-requirements)

---

## 1. System Overview

FlowStack คือแพลตฟอร์ม SaaS แบบ All-in-One ที่รวม CRM, การตลาด, การจัดการโครงการ, การเงิน, และ AI ไว้ในที่เดียว ออกแบบมาเพื่อให้องค์กรสามารถ **ขาย → ส่งมอบ → สนับสนุน → ต่ออายุ** ในวงจรที่ต่อเนื่องและไร้รอยต่อ

### Customer Journey หลัก

```
[Lead] → [Sale] → [Project] → [Helpdesk] → [Renew/Upsell]
   ↑                                              |
   └──────────── Marketing Loop ←─────────────────┘
```

### Core Modules

| Module | ความสามารถหลัก |
|--------|----------------|
| CRM | Pipeline, Deal, Activity, AI Scoring |
| Contact | นามบัตร AI, นัดหมาย, กลุ่มลูกค้า |
| Expense | รายจ่าย, อนุมัติ, รายงาน |
| Project | Task, Milestone, Holiday-aware AI |
| Helpdesk | Ticket, SLA, AI Resolution |
| Mail Marketing | Template, Segment, Campaign |
| Content Planner | Article, Video, SEO/AEO, Multi-platform |
| Survey | Form Builder, Analytics, Auto-segment |
| Workflow (BPM) | Process Map, Bottleneck, AI Recommend |
| AI Orchestrator | Multi-Agent Brain, Role-based Agents |
| AI Dashboard | Real-time Insight, KPI Health |

---

## 2. Architecture & Design Principles

### 2.1 Design Principles

- **Context-First AI** — AI ทุกส่วนต้องอ่านและเข้าใจ `brand.md`, `claude.md`, `skill.md` ขององค์กรก่อนทำงาน
- **Configuration over Code** — ค่าตัวเลือกทุกอย่างเป็น parameter ในหน้า Settings ไม่ hardcode
- **Typeahead Everywhere** — ฟิลด์ที่มีข้อมูลปริมาณมากต้องมี Typeahead Search (debounce 300ms, min 2 chars)
- **Audit Everything** — ทุก action มี audit log พร้อม timestamp, user, IP, และ diff
- **Fail-Safe Notifications** — แจ้งเตือนผ่าน In-App → Email → Line OA → Telegram ตามลำดับ fallback

### 2.2 Technology Stack (Recommended)

```
Frontend:    Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
Backend:     Node.js / Go (microservices), REST + GraphQL + WebSocket
Database:    PostgreSQL (primary), Redis (cache/queue), Elasticsearch (search)
AI Layer:    Multi-gateway: Kilo, OpenRouter, Google AI Studio, OpenAI-compatible
Storage:     S3-compatible (files, backup), CDN for media
Queue:       BullMQ / RabbitMQ (async jobs, notifications)
BPM Engine:  BPMN 2.0 compatible (Camunda / custom)
```

### 2.3 Context Files

| ไฟล์ | วัตถุประสงค์ | ตำแหน่ง |
|------|-------------|---------|
| `brand.md` | Brand voice, tone, color, logo, slogan | Settings → Brand |
| `claude.md` | AI behavior rules, persona, restrictions | Settings → AI |
| `skill.md` | Domain knowledge, product catalog, FAQ | Settings → AI |

> **Best Practice:** ทุกครั้งที่ AI Agent ทำงาน ระบบ inject context files เหล่านี้เป็น system prompt อัตโนมัติ พร้อม org metadata (ชื่อบริษัท, อุตสาหกรรม, ภาษา)

---

## 3. AI Foundation Layer

### 3.1 AI Gateway Configuration

ระบบรองรับ AI Provider หลายเจ้าพร้อมกัน สามารถกำหนดว่า Feature ไหนใช้ Model ไหน

```yaml
# ตัวอย่าง AI Gateway Config (เก็บใน Settings)
gateways:
  - id: kilo
    name: Kilo AI
    base_url: https://api.kilo.ai/v1
    api_key: "***"
    models: [kilo-pro, kilo-fast]
    
  - id: openrouter
    name: OpenRouter
    base_url: https://openrouter.ai/api/v1
    api_key: "***"
    models: [anthropic/claude-*, openai/gpt-*, google/gemini-*]
    
  - id: google-ai-studio
    name: Google AI Studio
    base_url: https://generativelanguage.googleapis.com/v1beta
    api_key: "***"
    models: [gemini-2.0-flash, gemini-2.5-pro]
    
  - id: openai-compatible
    name: Custom OpenAI Compatible
    base_url: "{{custom_url}}"
    api_key: "***"
    models: ["{{custom_models}}"]

feature_model_mapping:
  contact_scan:       openrouter/anthropic/claude-sonnet
  content_planner:    google-ai-studio/gemini-2.5-pro
  helpdesk_reply:     kilo/kilo-fast
  kpi_analysis:       openrouter/anthropic/claude-opus
  workflow_suggest:   openai-compatible/{{model}}
```

### 3.2 Context Injection Pipeline

```
User Request
    ↓
[Context Loader]
  ├── brand.md        (Brand identity)
  ├── claude.md       (AI rules)
  ├── skill.md        (Domain knowledge)
  ├── org_metadata    (Company info, industry, language)
  └── user_context    (Role, department, permissions)
    ↓
[AI Gateway Router]  → เลือก Gateway + Model ตาม feature
    ↓
[Response Processor] → Format, Safety check, Log
    ↓
User Response
```

### 3.3 AI Rate Limiting & Cost Control

- **Per-feature budget cap** — กำหนด token limit ต่อ feature ต่อวัน
- **Usage dashboard** — แสดง cost per module, per user, per gateway
- **Fallback chain** — หาก primary gateway ล้ม → ลอง secondary → tertiary
- **Cache layer** — Cache AI response สำหรับ identical prompts (TTL configurable)

---

## 4. CRM — Customer Relationship Management

### 4.1 Pipeline Management

**Fields:**
- Pipeline Name (Typeahead ค้นหา Pipeline ที่มีอยู่)
- Stage: `[Lead → Qualified → Proposal → Negotiation → Won/Lost]` (ปรับแต่งได้ใน Settings)
- Opportunity Name (Typeahead)
- Company Name (Typeahead → ดึงจาก Contact DB)
- Deal Value, Currency
- Expected Close Date
- Win Probability (%) — AI ประเมินอัตโนมัติจาก historical data
- Owner (Typeahead → User list)
- Source: Email / Content / Survey / Event / Referral / Cold Call
- Tags (Multi-select, Typeahead)

**AI Features:**
- **Deal Scoring** — AI ให้คะแนน 0–100 พร้อมเหตุผล (เช่น "ลูกค้าเปิดอีเมล 3 ครั้ง, ตอบ survey, budget match")
- **Next Best Action** — แนะนำ action ถัดไป (โทรหา / ส่ง proposal / นัด demo)
- **Churn Prediction** — แจ้งเตือนเมื่อดีลเงียบเกิน N วัน (configurable)

**Views:**
- Kanban Board (drag-and-drop)
- List View (sort, filter, bulk action)
- Forecast View (revenue projection by month)
- Activity Timeline

### 4.2 Activity Management

**Activity Types** (configurable ใน Settings):
`Call | Meeting | Email | Demo | Proposal | Site Visit | Follow-up | Task | Note`

**Fields:**
- Type, Subject, Due Date/Time
- Related To: Deal / Contact / Company (Typeahead)
- Assigned To (Typeahead)
- Priority: Low / Medium / High / Urgent
- Outcome (เก็บหลังทำ)
- AI Summary — AI สรุป outcome อัตโนมัติ

### 4.3 Customer Segmentation from All Marketing Activities

ระบบ auto-tag และ auto-segment ลูกค้าจากทุก touchpoint:

```
Email Marketing  → opened, clicked, unsubscribed
Content          → viewed, shared, commented
Survey           → responded, score range
Event            → registered, attended, no-show
Activity         → call_made, meeting_done, demo_attended
Presentation     → deck_viewed, time_spent
```

**Segment Engine:**
- Rule-based (AND/OR conditions)
- AI-based (cluster by behavior pattern)
- Real-time update เมื่อมี activity ใหม่
- ใช้ Segment ใน: Mail Marketing, Content targeting, AI Agent briefing

---

## 5. Contact Management

### 5.1 Business Card Scanner (AI)

**กระบวนการ:**
1. ถ่ายภาพ / อัปโหลด รูปนามบัตร
2. AI OCR + NLP Extract:
   - ชื่อ-นามสกุล, ตำแหน่ง, บริษัท
   - อีเมล, เบอร์โทร (หลายเบอร์)
   - ที่อยู่, Website, Line ID, Social
3. **AI Duplicate Check** — ตรวจสอบว่ามี Contact นี้อยู่แล้วหรือไม่
4. AI แนะนำ: "บริษัทนี้อยู่ใน Segment B2B Tech → ควรเพิ่มใน Pipeline: SaaS Enterprise"
5. User confirm → Save (หรือ Merge กับ existing)

### 5.2 AI Contact Recommendation

AI วิเคราะห์ข้อมูลและแนะนำ:
- **ช่องทางติดต่อที่เหมาะสม** — "ลูกค้ารายนี้ตอบสนองต่อ Email ดีที่สุด (open rate 78%)"
- **เวลาที่เหมาะสม** — "ช่วงเวลาที่ engage สูงสุดคือ Tue-Thu 10:00-11:00"
- **เนื้อหาที่น่าสนใจ** — based on ประวัติการเปิด Content
- **โอกาส Upsell** — "ยังไม่ได้ใช้ Module X ที่เหมาะกับ use case ของเขา"

### 5.3 Appointment Management

**Fields:**
- Title, Type (Meeting / Call / Demo / Site Visit)
- Date/Time, Duration
- Location / Meeting URL (Google Meet, Zoom, Teams — auto-generate)
- Attendees (Typeahead → Contact + Internal Users)
- Related Deal / Project (Typeahead)
- Reminder: 1 day / 1 hour / 15 min (multi-channel)
- Agenda (Rich text)
- AI Pre-meeting Brief — สรุปประวัติลูกค้า, deal status, last touchpoint

**Calendar Integration:**
- Sync กับ Google Calendar, Outlook
- iCal export
- Public booking link (Calendly-style) — configurable availability

### 5.4 Contact Fields

| Field | Type | Note |
|-------|------|------|
| Full Name | Text | Required |
| Company | Typeahead | ดึงจาก Company DB |
| Job Title | Text + Typeahead | |
| Email (multiple) | Email | Primary + Secondary |
| Phone (multiple) | Tel | Mobile, Office, WhatsApp |
| Line ID / Telegram | Text | |
| Address | Structured | |
| Social Profiles | URL | LinkedIn, Facebook, etc. |
| Lead Source | Select | Configurable |
| Segment Tags | Multi-select | Auto + Manual |
| Assigned To | Typeahead | |
| Lifecycle Stage | Select | Lead→MQL→SQL→Customer→Advocate |
| Custom Fields | Dynamic | กำหนดใน Settings |

---

## 6. Expense Management

### 6.1 Expense Entry

**Fields:**
- Date, Category (Typeahead, configurable list)
- Amount, Currency (auto-convert)
- Project (Typeahead)
- Vendor / Payee (Typeahead)
- Payment Method (configurable)
- Receipt (Upload image → AI OCR extract amount/date/vendor อัตโนมัติ)
- Description, Tags
- Billable to Client (Yes/No → ผูกกับ Invoice)

### 6.2 Approval Workflow

```
Draft → Submitted → [Manager Review] → [Finance Review] → Approved/Rejected
                          ↓
                   Auto-approve if ≤ {threshold_amount} (configurable)
```

- Multi-level approval (configurable เป็น N ระดับ)
- Delegation of Authority ตาม role และ amount
- Comment + Reject reason required
- Email + In-app notification ทุก stage

### 6.3 Reports & Analytics

- Monthly/Quarterly/Annual summary
- By project, department, category, user
- Budget vs Actual
- AI Anomaly Detection — แจ้งเตือนค่าใช้จ่ายผิดปกติ
- Export: Excel, PDF, CSV

---

## 7. Project Management

### 7.1 Project Structure

```
Project
├── Milestones
│   └── Tasks
│       ├── Sub-tasks
│       ├── Attachments
│       ├── Comments
│       └── Time Logs
└── Team Members (Typeahead)
```

**Project Fields:**
- Name (Typeahead), Client (Typeahead), Deal (Typeahead — linked from CRM)
- Start Date, End Date, Budget
- Status: Planning / Active / On Hold / Completed / Cancelled
- Priority, Tags
- Project Type (configurable)

### 7.2 AI-Powered Scheduling (Holiday-Aware)

**Holiday-Aware Scheduler:**
- โหลด Public Holiday จากประเทศที่ตั้งค่า (configurable)
- เพิ่ม Custom Holiday / Company Holiday ได้
- เมื่อกำหนด Timeline → AI คำนวณ working days อัตโนมัติ
- แจ้งเตือนเมื่อ deadline ตรงกับวันหยุด → Auto-suggest วันก่อนหน้า

**AI Task Suggestions:**
- วิเคราะห์ project type → suggest task list template
- Resource leveling — ตรวจสอบ overload ของ team member
- Risk detection — "Task X ยังไม่เริ่ม แต่เหลือ 3 วัน → High Risk"

### 7.3 Task Management

**Fields:**
- Title, Description (Rich text)
- Assignee (Typeahead, multiple)
- Due Date, Estimated Hours
- Priority: Urgent / High / Normal / Low (Eisenhower Matrix view available)
- Status (configurable stages)
- Dependencies (Typeahead → other tasks)
- Labels/Tags (Typeahead)
- Checklist, Attachments, Time Tracker

**Views:** Kanban | Gantt | List | Calendar | Workload

### 7.4 Time Tracking

- Manual entry + Timer (start/stop)
- Linked to task, project, billable flag
- Timesheet view (weekly grid)
- Export for invoicing

---

## 8. Helpdesk

### 8.1 Ticket Management

**Fields:**
- Subject (+ AI auto-suggest category)
- Description, Attachments
- Contact (Typeahead), Company (Typeahead)
- Related Project (Typeahead), Related Deal (Typeahead)
- Priority: Critical / High / Medium / Low
- Category (configurable Typeahead)
- Status: New → Open → Pending → Resolved → Closed
- Assigned To (Typeahead)
- SLA Policy (auto-applied based on priority/client tier)

### 8.2 AI Resolution Engine

**AI Capabilities:**
- **Auto-categorize** — อ่าน subject+description → assign category + priority
- **Smart Reply** — AI draft ตอบโดยใช้ knowledge base + brand.md + skill.md
- **Solution Suggestion** — ค้นหา similar tickets ที่เคย resolve สำเร็จ
- **Sentiment Analysis** — ตรวจจับความไม่พอใจ → escalate อัตโนมัติ
- **Resolution Summary** — เมื่อ close ticket AI สรุป root cause และ solution

### 8.3 SLA Management

```yaml
sla_policies:
  critical:
    first_response: 1h
    resolution:     4h
    business_hours: false  # 24/7
  high:
    first_response: 4h
    resolution:     24h
    business_hours: true
  medium:
    first_response: 8h
    resolution:     48h
    business_hours: true
```

- SLA breach warning ที่ 75% และ 90% ของเวลา
- Auto-escalate เมื่อ breach
- SLA Report per agent, per category

### 8.4 Knowledge Base

- Article editor (Rich text + AI assist)
- Categories, Tags
- Public / Internal visibility
- AI auto-suggest articles เมื่อ agent พิมพ์ reply
- Search with semantic similarity

---

## 9. Mail Marketing

### 9.1 Campaign Management

**Fields:**
- Campaign Name, Type: Newsletter / Promotional / Transactional / Drip
- Subject Line (+ AI A/B suggest), Preview Text
- Sender Name, Sender Email
- Target Segment (Typeahead → Segment DB)
- Schedule: Immediate / Date-time / AI Optimal Time
- Unsubscribe handling (auto)
- UTM Parameters (auto-generate)

### 9.2 Template Builder

- Drag-and-drop block editor
- Responsive preview (Desktop / Mobile / Tablet)
- Dynamic fields: `{{first_name}}`, `{{company}}`, `{{deal_value}}` ฯลฯ
- Template library (ระบบ + user-created)
- AI เขียน copy จาก brief (ใช้ brand.md เป็น context)
- HTML editor mode สำหรับ advanced users

### 9.3 Audience Segmentation

- ใช้ Segment จาก Contact Module
- Filter แบบ real-time: preview จำนวนผู้รับก่อนส่ง
- Exclusion list (unsubscribed, bounced, suppression)
- Personalization token ต่อ segment

### 9.4 Analytics

| Metric | Description |
|--------|-------------|
| Delivered Rate | จำนวนที่ส่งได้จริง |
| Open Rate | % ที่เปิดอ่าน |
| Click Rate | % ที่คลิก link |
| Bounce Rate | Hard + Soft bounce |
| Unsubscribe Rate | % ที่ยกเลิก |
| Conversion | Action ที่กำหนด (เช่น form fill) |
| Revenue Attribution | รายได้ที่เกิดจาก campaign |

- Heat map ของ link clicks
- AI insight: "Campaign นี้ perform ต่ำกว่าค่าเฉลี่ย 23% → สาเหตุคือ subject line มีความยาวเกิน 50 ตัวอักษร"

---

## 10. AI Content Planner

### 10.1 Content Calendar

- Monthly / Weekly view
- ลาก-วาง reorder content
- Color-code ตาม platform / content type / status
- Bulk import จาก CSV

### 10.2 AI Content Generation

**Article Workflow:**
```
[Brief Input] → [AI Outline] → [AI Draft] → [Human Edit] → [SEO Check] → [Schedule/Publish]
```

**Video Script Workflow:**
```
[Topic + Brief] → [AI Script] → [AI Thumbnail Text Suggest] → [Human Review] → [Schedule]
```

**Brief Fields:**
- Topic / Keyword
- Target Audience (ดึงจาก Segment)
- Content Goal: Awareness / Consideration / Conversion / Retention
- Tone (ดึงจาก brand.md)
- Length / Format
- Platform Target (multi-select)

### 10.3 SEO & AEO Optimization

**SEO Checks:**
- Keyword density, placement (title, H1, meta, alt text)
- Readability score (Flesch-Kincaid equivalent)
- Internal link suggestions
- Meta title/description generator (character count enforced)
- Schema markup generator (Article, FAQ, HowTo)

**AEO (Answer Engine Optimization) Checks:**
- FAQ section generator (structured for AI search)
- Featured snippet optimization (answer box format)
- Entity coverage check
- Conversational query matching

### 10.4 Multi-Platform Publishing

**Supported Platforms:**

| Platform | Content Types | Features |
|----------|--------------|----------|
| Facebook | Post, Story, Reel | Page + Group, scheduling |
| WordPress | Post, Page | Category, tags, SEO meta |
| Wix | Blog Post | Auto-publish via API |
| Line OA | Broadcast, Flex Message | Rich message format |
| YouTube | Video (metadata) | Title, description, tags, thumbnail |
| TikTok | Video (metadata) | Caption, hashtags |
| Email Marketing | Campaign | ผ่าน Mail Marketing module |

**Publishing Features:**
- เลือกหลาย Platform พร้อมกัน
- ตั้งเวลาต่าง Platform ต่างเวลาได้
- Preview per platform ก่อน publish
- AI optimal time suggestion (based on audience activity)
- Cross-post performance tracking

### 10.5 Content Performance Analytics

- View / Reach / Engagement per platform
- AI insight: "Article นี้ rank top 10 สำหรับ keyword X"
- Content repurpose suggestion: "บทความนี้เหมาะแปลงเป็น Reel 60 วินาที"

---

## 11. Survey

### 11.1 Form Builder

**Question Types:**
- Short Text, Long Text, Number, Date
- Single Choice (Radio), Multiple Choice (Checkbox)
- Rating Scale (1–5, 1–10, Star)
- NPS (Net Promoter Score)
- Matrix / Likert Scale
- File Upload
- Dropdown (Typeahead สำหรับ long lists)
- Ranking

**Features:**
- Conditional logic (show/hide based on answer)
- Page branching
- Progress bar
- Mobile-responsive
- Multi-language support

### 11.2 Distribution

- Shareable link
- Embed code (website, blog)
- Email campaign integration
- QR Code generate
- Line OA message

### 11.3 AI Survey Analysis

- Auto-tag open-ended responses by sentiment / topic
- NPS trend analysis
- AI summary: "กลุ่มลูกค้า SME พอใจเรื่องราคา แต่ไม่พอใจด้าน onboarding"
- Auto-segment ผู้ตอบแบบสอบถาม → push เข้า CRM Segment

---

## 12. Workflow Engine (BPM)

### 12.1 BPM Process Designer

- Visual BPMN 2.0 diagram editor
- Drag-and-drop nodes: Start, Task, Gateway, Timer, End
- Swim lanes ตาม Department / Role
- Export เป็น BPMN XML / PNG / PDF

### 12.2 Lifecycle Workflow: Sale → Project → Helpdesk → Renew

```
[SALE]
  Start: Lead Created
  ├── Qualify Lead (Sales Rep)
  ├── Send Proposal (AI draft)
  ├── Negotiation (Deal update)
  ├── Won → [PROJECT TRIGGER]
  └── Lost → [Lost Analysis + Re-engage campaign]

[PROJECT]
  Start: Deal Won
  ├── Create Project (auto-link Deal)
  ├── Kick-off Meeting (auto-schedule)
  ├── Milestone 1 → N
  ├── UAT / Delivery
  ├── Go-Live → [HELPDESK TRIGGER]
  └── Handover Doc (AI generate)

[HELPDESK]
  Start: Go-Live / Customer Onboarded
  ├── Ticket → Resolve Loop
  ├── Satisfaction Score (auto-survey at 30 days)
  ├── Health Score Monitor (AI monthly)
  └── Renewal Alert (90 days before) → [RENEW TRIGGER]

[RENEW]
  Start: 90 days before expiry
  ├── AI Renewal Brief (usage summary, value delivered)
  ├── Sales Contact Assigned
  ├── Renewal Proposal (AI draft)
  ├── Renewed → loop back to [PROJECT/HELPDESK]
  └── Churned → Exit survey + Win-back campaign
```

### 12.3 Process Status & Bottleneck Detection

**Real-time Dashboard แสดง:**
- จำนวน instances ต่อ stage
- Average time spent ต่อ stage
- **Bottleneck Highlight** — stage ที่มี queue สูงหรือใช้เวลานานกว่า threshold
- SLA breach count per stage

**AI Bottleneck Analysis:**
- "Stage 'Proposal Review' ใช้เวลาเฉลี่ย 5.2 วัน (benchmark: 2 วัน) → แนะนำ: เพิ่ม template สำเร็จรูปหรือ auto-approve ≤ {threshold}"
- แนะนำ automation rule ที่ช่วยลด manual handoff

### 12.4 Workflow Automation Rules

```
WHEN  [trigger_event]
IF    [conditions]
THEN  [actions]

Example:
WHEN  Deal Stage = "Won"
IF    Deal Value > 100,000
THEN  Create Project (template: "Enterprise Onboarding")
      Notify: Account Manager, Project Lead
      Schedule: Kick-off Meeting (3 days later, business hours)
      Create: Helpdesk Customer Profile
```

---

## 13. AI Orchestrator & AI Agents

### 13.1 AI Orchestrator (สมอง)

ทำหน้าที่เป็น **Central Intelligence** ที่:
- รับ request จาก user หรือ system trigger
- วิเคราะห์ว่าต้องใช้ Agent ไหน / หลาย Agent ทำงานร่วมกัน
- Inject context: brand.md + claude.md + skill.md + org data
- ประสานงาน multi-agent workflows
- สรุปผลและ present ให้ user

### 13.2 AI Agents ตาม Role

| Agent | ความรับผิดชอบ | ตัวอย่างงาน |
|-------|--------------|------------|
| **CEO Agent** | Strategic overview, executive summary | Monthly business health report, KPI trends |
| **CFO Agent** | Financial analysis, budget, expense | P&L summary, expense anomaly alert, cash flow |
| **Sales Agent** | Deal coaching, forecast, pipeline health | "Deal X ควรทำอะไรต่อ?", Win probability |
| **Marketing Agent** | Campaign planning, content brief, analytics | "วางแผน content Q3", Campaign performance |
| **Research Agent** | Market research, competitor analysis | Industry trend report, keyword research |
| **HR Agent** | Recruitment, performance, org health | Onboarding checklist, leave analysis |
| **Support Agent** | Ticket resolution, knowledge base | AI reply draft, FAQ generation |
| **Content Agent** | Article/video creation, SEO, scheduling | Draft blog post, optimize meta tags |
| **Dev Agent** | Technical spec, bug triage, sprint planning | User story generation, error analysis |
| **Project Agent** | Timeline, resource, risk | Schedule optimization, milestone report |

### 13.3 Agent Interaction Modes

- **Chat Mode** — พิมพ์คำถาม agent ตอบ conversationally
- **Task Mode** — มอบหมายงาน agent ดำเนินการและรายงานผล
- **Auto Mode** — agent ทำงาน background ตาม trigger (เช่น ทุกเย็นวันจันทร์ CFO Agent สรุปค่าใช้จ่ายสัปดาห์)
- **Collaborative Mode** — หลาย agent ทำงานร่วม (เช่น Sales + Marketing วางแผน campaign ร่วมกัน)

### 13.4 Agent Memory & Learning

- Short-term memory: บริบทของ conversation ปัจจุบัน
- Long-term memory: บันทึกการตัดสินใจ, preference, feedback ของ user
- Organization knowledge: เรียนรู้จาก data ในระบบ (deals, tickets, campaigns)

---

## 14. AI Dashboard & KPI

### 14.1 AI Dashboard

**Widgets (drag-and-drop, per-user customizable):**
- Revenue Pipeline (funnel)
- Deal velocity trend
- Team activity heatmap
- Campaign performance overview
- Ticket resolution rate
- Content engagement summary
- Expense burn rate
- Project health matrix

**AI Narrative:**
> "สัปดาห์นี้ pipeline ลดลง 15% จากสัปดาห์ก่อน สาเหตุหลักคือ 3 deals ใน Negotiation stage ค้างมากกว่า 14 วัน แนะนำ: ให้ Sales Manager ติดตาม deals เหล่านี้โดยตรง"

### 14.2 AI KPI System

**KPI กำหนดตาม Role + Painpoint:**

```yaml
# KPI Template: Sales Rep
kpis:
  - name: Monthly Revenue
    target: "{{sales_target}}"  # parameter จาก Settings
    weight: 30%
    painpoint: "Revenue achievement"
    
  - name: Activities per Week
    target: 20
    weight: 20%
    painpoint: "Sales activity consistency"
    
  - name: Deal Conversion Rate
    target: 25%
    weight: 25%
    painpoint: "Proposal quality"
    
  - name: Average Response Time
    target: "<2h"
    weight: 25%
    painpoint: "Customer responsiveness"
```

**AI KPI Analysis:**
- เปรียบเทียบ actual vs target ทุก KPI
- ระบุ root cause เมื่อ KPI ต่ำกว่าเป้า
- แนะนำ action plan ที่ specific และ measurable
- Peer benchmarking (anonymous) ภายในองค์กร

### 14.3 Organizational Health Score

AI คำนวณ **Health Score 0–100** จาก:

| Dimension | น้ำหนัก | Indicators |
|-----------|--------|-----------|
| Revenue Health | 25% | Pipeline growth, win rate, churn |
| Operational Health | 20% | Project on-time, ticket resolution, SLA |
| Team Health | 20% | Activity levels, KPI achievement, response time |
| Customer Health | 20% | NPS, satisfaction score, renewal rate |
| Financial Health | 15% | Budget adherence, expense anomalies |

**Report:**
- Weekly / Monthly organization health report
- Trend line ย้อนหลัง 12 เดือน
- Department-level breakdown
- AI recommendation ตาม health dimension ที่ต่ำสุด

---

## 15. Notification System

### 15.1 Notification Channels

| Channel | Use Case | Configuration |
|---------|----------|--------------|
| **In-App** | ทุก notification | Real-time bell icon, notification center |
| **Email** | สำคัญ, ไม่ urgent | Template-based, unsubscribe per category |
| **Line OA** | Mobile-friendly alerts | Rich message / Flex Message |
| **Telegram** | Developer/IT alerts | Bot, formatted markdown |

### 15.2 Notification Rules

**Delivery Priority (Cascading):**
```
Critical Alert → In-App + Email + Line OA + Telegram (ทุกช่องพร้อมกัน)
Important      → In-App + Email + Line OA
Normal         → In-App + Email
Low            → In-App only
```

**User Preference** — แต่ละ user เลือกได้ว่า category ไหน รับผ่านช่องทางไหน

### 15.3 Notification Events

**CRM:**
- Deal stage changed, Deal assigned, Deal won/lost
- Activity due reminder, Overdue activity

**Project:**
- Task assigned, Task overdue, Milestone reached
- Project status changed, File uploaded

**Helpdesk:**
- New ticket created, Ticket assigned, SLA warning/breach
- Ticket resolved, Customer replied

**Finance:**
- Expense submitted, Expense approved/rejected
- Budget threshold reached

**AI & System:**
- AI task completed (long-running)
- Scheduled report ready
- Backup completed/failed
- Integration error
- Organization health score drop > 10 points

### 15.4 Notification Center (In-App)

- Grouped by module / date
- Mark as read / Unread
- Bulk mark all read
- Filter by type, module, priority
- Deep link → ไปยัง record ที่เกี่ยวข้องโดยตรง
- Retention: 90 days (configurable)

---

## 16. Settings & Parameters

### 16.1 Settings Architecture

> **Principle:** ทุก configurable value เป็น parameter ไม่ hardcode — ช่วยให้ทุก organization ปรับแต่งได้โดยไม่ต้องเปลี่ยน code

**Settings Categories:**

```
Settings
├── Organization
│   ├── Company Profile
│   ├── Branding (Logo, Colors, brand.md)
│   ├── Business Hours & Holidays
│   └── Localization (Language, Currency, Timezone, Date Format)
│
├── Users & Access
│   ├── User Management
│   ├── Roles & Permissions
│   ├── Teams / Departments
│   └── SSO / Authentication
│
├── AI Configuration
│   ├── AI Gateways (Kilo, OpenRouter, Google AI Studio, Custom)
│   ├── Feature → Model Mapping
│   ├── Context Files (brand.md, claude.md, skill.md)
│   ├── Token Budget per Feature
│   └── Agent Configuration
│
├── CRM
│   ├── Pipeline Stages
│   ├── Deal Fields (Custom)
│   ├── Activity Types
│   ├── Lead Sources
│   └── Win/Loss Reasons
│
├── Project
│   ├── Task Statuses
│   ├── Project Types
│   ├── Custom Fields
│   └── Holiday Calendar
│
├── Helpdesk
│   ├── Ticket Categories
│   ├── SLA Policies
│   ├── Escalation Rules
│   └── Email-to-Ticket (inbound mailbox)
│
├── Finance
│   ├── Expense Categories
│   ├── Approval Thresholds
│   ├── Budget Periods
│   └── Tax Rates
│
├── Notifications
│   ├── Global Rules
│   ├── Channel Configuration (Email SMTP, Line OA Token, Telegram Bot)
│   └── User Preferences
│
├── Integrations
│   ├── Social Media (Facebook, YouTube, TikTok)
│   ├── CMS (WordPress, Wix)
│   ├── Calendar (Google, Outlook)
│   ├── Email Service (SendGrid, Mailchimp, SES)
│   └── Webhooks & API Keys
│
└── Data Management
    ├── Backup Schedule
    ├── Retention Policies
    ├── Import/Export Templates
    └── Audit Log Settings
```

### 16.2 Typeahead Implementation Standard

ฟิลด์ต่อไปนี้ **ต้องมี** Typeahead Search:

| ฟิลด์ | Source | Min Chars | Debounce |
|-------|--------|-----------|---------|
| Company Name | Company DB | 2 | 300ms |
| Contact Name | Contact DB | 2 | 300ms |
| Project Name | Project DB | 2 | 300ms |
| Deal / Opportunity | Deal DB | 2 | 300ms |
| User / Assignee | User DB | 1 | 200ms |
| Product / Service | Product DB | 2 | 300ms |
| Tag | Tag DB | 1 | 200ms |
| Category | Category DB | 1 | 200ms |
| Segment | Segment DB | 2 | 300ms |
| Campaign | Campaign DB | 2 | 300ms |
| AI Model | Gateway API | 2 | 500ms |

**Typeahead UX Rules:**
- แสดง max 10 results
- Highlight match text
- Show recent/frequent first
- "Create new" option เมื่อไม่พบ
- Keyboard navigable (↑↓ Enter Escape)
- Loading spinner ระหว่าง fetch

---

## 17. Data Management

### 17.1 Backup & Restore

**Automated Backup:**
```yaml
backup:
  schedule:
    full:        "0 2 * * 0"    # Weekly Sunday 2:00 AM
    incremental: "0 2 * * 1-6"  # Daily (Mon-Sat) 2:00 AM
  retention:
    daily:   7    # days
    weekly:  4    # weeks
    monthly: 12   # months
  storage:
    primary:   S3 (same region)
    secondary: S3 (different region)  # Disaster recovery
  encryption: AES-256
  notification:
    success: in-app
    failure: in-app + email + telegram
```

**Manual Backup:**
- Trigger on-demand จาก Settings
- Download backup file (encrypted)
- Include: database, files, configurations, AI context files

**Restore:**
- Point-in-time restore (เลือก backup snapshot)
- Partial restore ต่อ module
- Restore to staging environment ก่อน apply production
- Restore log + confirmation step

### 17.2 Data Versioning (Undo/Redo)

- ทุก record เก็บ version history
- แสดง diff (changed fields, old value → new value)
- Restore เฉพาะ record นั้น โดยไม่กระทบ record อื่น
- Retention: กำหนดได้ใน Settings (default: 50 versions หรือ 1 ปี)
- Bulk restore จาก audit log

### 17.3 Import

**Supported Formats:** CSV, Excel (.xlsx), JSON, vCard (.vcf)

**Import Process:**
```
1. Upload file
2. AI field mapping (auto-detect column → field)
3. Preview (first 20 rows)
4. Validation report (errors, warnings, duplicates)
5. Choose duplicate handling: Skip / Update / Create new
6. Execute import (background job)
7. Import summary + downloadable error report
```

**Import Templates** (downloadable ต่อ module)

### 17.4 Export

**Export Options:**
- **Module Export:** เลือก module + filter → CSV / Excel / JSON / PDF
- **Full Export:** ทุก module เป็น ZIP (GDPR compliance)
- **Scheduled Export:** ส่งอีเมลรายงานตามเวลาที่กำหนด

**Export Fields:** user เลือกได้ว่าจะ export field ไหนบ้าง

---

## 18. Security & Access Control

### 18.1 Role-Based Access Control (RBAC)

```
Roles (configurable):
├── Super Admin     → ทุกสิทธิ์
├── Admin           → จัดการ settings, users
├── Manager         → อนุมัติ, report ทุก module
├── Sales Rep       → CRM, Contact, Calendar
├── Marketing       → Content, Campaign, Survey
├── Project Manager → Project, Helpdesk (read)
├── Support Agent   → Helpdesk, Contact (read)
├── Finance         → Expense, Report
├── Content Creator → Content Planner, Campaign (read)
└── Custom Role     → กำหนด permission ต่อ module ต่อ action ได้
```

**Permission Levels per Module:** `None | Read | Write | Delete | Admin`

### 18.2 Data Security

- End-to-end encryption สำหรับ sensitive fields
- Data at rest: AES-256
- Data in transit: TLS 1.3
- API Keys: ไม่แสดง plain text หลัง save (masked)
- PII fields: เลือก mask/unmask ตาม role ได้

### 18.3 Audit Log

ทุก action บันทึก:
```json
{
  "timestamp": "2026-06-04T10:30:00Z",
  "user_id": "usr_123",
  "user_name": "สมชาย ใจดี",
  "action": "DEAL_UPDATE",
  "module": "crm",
  "record_id": "deal_456",
  "changes": {
    "stage": { "old": "Proposal", "new": "Negotiation" }
  },
  "ip_address": "203.x.x.x",
  "user_agent": "Chrome/125"
}
```

- Searchable, filterable
- Export to CSV / SIEM system
- Immutable (ไม่สามารถ edit/delete)
- Retention: 2 ปี (configurable)

---

## 19. Integration & API

### 19.1 Outbound Integrations

| Service | Purpose | Protocol |
|---------|---------|---------|
| Facebook / Meta | Content publish, Lead Ads | OAuth2 + Graph API |
| WordPress | Blog publish | REST API + JWT |
| Wix | Blog publish | OAuth2 + Wix API |
| Line OA | Broadcast, notification | Line Messaging API |
| YouTube | Video metadata push | OAuth2 + YouTube Data API |
| TikTok | Video metadata | TikTok API |
| Google Calendar | Sync appointments | OAuth2 + CalDAV |
| Outlook Calendar | Sync appointments | OAuth2 + Graph API |
| SendGrid / SES | Email delivery | SMTP / API |
| Slack | Internal notifications | Webhook / Bot |
| Telegram | Notifications | Bot API |
| Zapier / Make | Automation bridge | Webhook |

### 19.2 FlowStack Public API

- RESTful API (JSON)
- GraphQL endpoint (สำหรับ complex queries)
- WebSocket (real-time events)
- API Key management (per integration, per permission)
- Rate limiting: configurable per key
- API documentation: OpenAPI 3.0 spec (auto-generated)
- Sandbox environment สำหรับ testing

### 19.3 Webhook

- Outbound webhook ต่อ event
- Retry logic (3 retries, exponential backoff)
- Delivery log + manual retry
- Signature verification (HMAC-SHA256)

---

## 20. Non-Functional Requirements

### 20.1 Performance

| Requirement | Target |
|-------------|--------|
| Page load (LCP) | < 2.5 seconds |
| API response (p95) | < 500ms |
| Typeahead response | < 300ms |
| AI response (short) | < 3 seconds |
| AI response (long task) | Async + progress indicator |
| Concurrent users | 1,000+ per tenant |

### 20.2 Availability & Reliability

- Uptime SLA: 99.9% (≤ 8.7 hours downtime/year)
- Maintenance window: ประกาศล่วงหน้า 24 ชั่วโมง
- Health check endpoint: `GET /health`
- Graceful degradation: ถ้า AI gateway ล้ม → ระบบยังทำงานได้ (AI features แสดง fallback message)

### 20.3 Scalability

- Horizontal scaling (stateless services)
- Database read replicas สำหรับ report queries
- CDN สำหรับ static assets และ media
- Queue-based async processing สำหรับ heavy tasks

### 20.4 Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation ทุก interactive element
- Screen reader compatible (ARIA labels)
- Color contrast ratio ≥ 4.5:1

### 20.5 Internationalization

- Multi-language UI (Thai / English default, extendable)
- Multi-timezone support
- Multi-currency (display + conversion)
- Date/number format ตาม locale

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| AEO | Answer Engine Optimization — การ optimize content สำหรับ AI search engines |
| BPM | Business Process Management — การจัดการกระบวนการทางธุรกิจ |
| Bottleneck | จุดที่กระบวนการชะงัก ทำให้งานค้างสะสม |
| Context Files | brand.md, claude.md, skill.md — ไฟล์ที่ inject เข้า AI เพื่อให้เข้าใจบริบทองค์กร |
| Typeahead | ฟีเจอร์ search-as-you-type สำหรับฟิลด์ที่มีข้อมูลมาก |
| SLA | Service Level Agreement — ข้อตกลงระดับการให้บริการ |
| NPS | Net Promoter Score — ตัวชี้วัดความพึงพอใจลูกค้า |
| RBAC | Role-Based Access Control — การควบคุมสิทธิ์ตาม role |
| Segment | กลุ่มลูกค้าที่จัดกลุ่มตามเงื่อนไขหรือ behavior |
| Orchestrator | AI กลางที่ประสานงานระหว่าง AI Agents ต่าง ๆ |

## Appendix B: Data Flow Diagram (Sale → Renew)

```
[Marketing Activity]
       │
       ▼
[Lead Generated in CRM] ─────────────────── [AI Lead Score]
       │
       ▼
[Contact Created / Matched]
       │
       ▼
[Deal Opened] ─────────────────────────── [AI Deal Coach]
       │
 Stage changes
       │
       ▼
[Deal Won] ──────────────────────── triggers
       │                                   │
       ▼                                   ▼
[Project Created] ──────────── [Customer Profile in Helpdesk]
       │
 Milestone completion
       │
       ▼
[Delivery / Go-Live] ───────────────── [Auto-Survey]
       │
       ▼
[Helpdesk Active]
       │
 90 days before expiry
       │
       ▼
[Renewal Workflow] ───────────────── [AI Renewal Brief]
       │
  ┌────┴────┐
  ▼         ▼
[Renewed] [Churned]
  │           │
  │      [Win-back Campaign]
  │
  └──► Loop back to [Deal Opened]
```

---

*FlowStack SaaS Specification v1.0.0 — Confidential*
*สงวนลิขสิทธิ์ — ห้ามเผยแพร่โดยไม่ได้รับอนุญาต*
