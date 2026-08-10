## 1. Database Migrations

- [ ] 1.1 สร้าง migration: `tenants` table (id, name, subdomain, status, trial_ends_at, created_at)
- [ ] 1.2 สร้าง migration: `subscriptions` table (id, tenant_id, plan, stripe_subscription_id, status, starts_at, ends_at)
- [ ] 1.3 สร้าง migration: เพิ่ม `tenant_id` column ใน `users`, `projects`, `tasks`, `sales_opportunities`, `companies` tables
- [ ] 1.4 สร้าง migration: `email_events` table (id, campaign_id, recipient_email, event_type, token, created_at, ip)
- [ ] 1.5 สร้าง migration: `impact_outcomes` table (id, project_id, simulation_id, predicted_duration, actual_duration, predicted_cost, actual_cost, accuracy_score, created_at)
- [ ] 1.6 สร้าง migration: `content_posts` table (id, title, body, format, author_id, created_at)
- [ ] 1.7 สร้าง migration: `content_publish_queue` table (id, post_id, platform, status, error_message, scheduled_at, processed_at)
- [ ] 1.8 สร้าง migration: `wat_channels` table (id, category [owned/earned/paid], platform, credentials_encrypted, is_active)
- [ ] 1.9 สร้าง migration: `kpi_targets` table (id, metric_key, target_value, period_type, period_value, created_at)
- [ ] 1.10 สร้าง migration: เพิ่ม `sla_hours` column ใน `workflow_journey_stages` table
- [ ] 1.11 สร้าง migration: `ai_tool_calls` table (id, user_id, tool_name, input_json, output_json, status, created_at)
- [ ] 1.12 สร้าง migration: เพิ่ม `engagement_score` column ใน `companies` / contacts table
- [ ] 1.13 Backfill default tenant_id บน existing rows ทุก table

## 2. SaaS Onboarding — Backend

- [ ] 2.1 สร้าง `api/registration.php`: POST สร้าง tenant + admin user + activate trial
- [ ] 2.2 สร้าง `api/subscriptions.php`: GET status, POST create Stripe checkout session, webhook handler
- [ ] 2.3 ตั้งค่า Stripe PHP SDK ใน `composer.json` และ `vendor/`
- [ ] 2.4 เพิ่ม tenant middleware ใน `requireAuth()` — inject tenant_id จาก JWT
- [ ] 2.5 เพิ่ม trial expiry check ใน `requireAuth()` — return 402 ถ้า expired

## 3. SaaS Onboarding — Frontend

- [ ] 3.1 สร้างหน้า `/register` (public) — registration form พร้อม validation (Thai labels)
- [ ] 3.2 สร้างหน้า `/setup` — setup wizard 4 steps: ข้อมูลบริษัท, invite, SMTP, modules
- [ ] 3.3 สร้างหน้า `/upgrade` — plan comparison + CTA → Stripe checkout
- [ ] 3.4 เพิ่ม trial banner component ใน `DashboardLayout.tsx` แสดงเมื่อ trial < 7 วัน
- [ ] 3.5 เพิ่ม route guards: redirect `/setup` ถ้า first login, block non-admin routes ถ้า trial expired

## 4. PM & Sales KPI Dashboard — Backend

- [ ] 4.1 สร้าง `api/kpi-dashboard.php`: GET project KPIs (velocity, burn_rate, on_time_rate, overdue_count)
- [ ] 4.2 เพิ่ม sales KPI endpoint ใน `api/kpi-dashboard.php`: win_rate, avg_cycle_time, pipeline_value
- [ ] 4.3 สร้าง CRUD สำหรับ `kpi_targets` ใน `api/kpi-targets.php`

## 5. PM & Sales KPI Dashboard — Frontend

- [ ] 5.1 สร้าง `KpiDashboard` component แสดง KPI cards พร้อม actual vs target comparison
- [ ] 5.2 เพิ่ม KPI section ใน Projects page (หรือ project detail)
- [ ] 5.3 เพิ่ม KPI section ใน Sales page
- [ ] 5.4 สร้าง KPI target configuration panel ใน Admin settings

## 6. BPM Bottleneck Analysis — Backend

- [ ] 6.1 สร้าง `api/bpm-analytics.php`: GET bottleneck metrics ต่อ journey (avg_time, queue_depth, throughput, sla_breach_rate)
- [ ] 6.2 เพิ่ม SLA breach detection ใน `api/workflow-journeys.php` — notify เมื่อ instance เกิน sla_hours
- [ ] 6.3 เพิ่ม CSV export endpoint ใน `api/bpm-analytics.php`

## 7. BPM Bottleneck Analysis — Frontend

- [ ] 7.1 สร้าง `BottleneckAnalysisPanel` component แสดง stage metrics heatmap/bar
- [ ] 7.2 เพิ่ม bottleneck panel ใน BPM workflow journey detail page
- [ ] 7.3 เพิ่ม `sla_hours` field ใน stage edit dialog
- [ ] 7.4 แสดง SLA breach badge บน workflow instance list

## 8. ImpactOS Outcome Tracking — Backend

- [ ] 8.1 สร้าง `api/impact-outcomes.php`: GET/POST outcome records, GET accuracy trends
- [ ] 8.2 เพิ่ม hook ใน `api/projects.php` — เมื่อ status → done, auto-create impact_outcome
- [ ] 8.3 เพิ่ม accuracy score calculation function (predicted vs actual % diff)

## 9. ImpactOS Outcome Tracking — Frontend

- [ ] 9.1 สร้าง `OutcomeComparisonCard` component แสดง predicted vs actual side-by-side
- [ ] 9.2 เพิ่ม outcome section ใน project detail page (เมื่อ project done + simulation exists)
- [ ] 9.3 สร้าง accuracy trend chart ใน ImpactOS overview page
- [ ] 9.4 สร้าง manual outcome entry form

## 10. Agentic AI Chat — Backend

- [ ] 10.1 สร้าง `api/ai-agent-tools.php`: tool registry + executor (create_task, create_project, create_lead, query_tasks, query_projects, summarize_report)
- [ ] 10.2 อัปเดต `api/ai-insights.php` หรือ chat endpoint — ส่ง tool definitions ไปยัง AI provider
- [ ] 10.3 เพิ่ม tool call logging ใน `ai_tool_calls` table
- [ ] 10.4 เพิ่ม permission check ก่อน execute tool ทุก tool

## 11. Agentic AI Chat — Frontend

- [ ] 11.1 อัปเดต AI chat component รองรับ tool call responses (render structured data)
- [ ] 11.2 แสดง "กำลังดำเนินการ..." indicator เมื่อ AI executing tool
- [ ] 11.3 Render table/chart สำหรับ AI responses ที่ return structured data

## 12. Email Campaign Tracking — Backend

- [ ] 12.1 สร้าง `api/email-track.php`: GET open pixel (1×1 PNG), GET click redirect + log
- [ ] 12.2 อัปเดต `api/brand-content.php` หรือ campaign send logic — inject tracking pixel + wrap links
- [ ] 12.3 เพิ่ม `APP_PUBLIC_URL` config ใน `company_settings` (admin settings)
- [ ] 12.4 สร้าง campaign metrics aggregation endpoint: open_rate, click_rate per campaign

## 13. Email Campaign Tracking — Frontend

- [ ] 13.1 สร้าง `CampaignMetricsPanel` component แสดง sent/opened/clicked/unsubscribed
- [ ] 13.2 เพิ่ม metrics panel ใน campaign detail page
- [ ] 13.3 เพิ่ม `APP_PUBLIC_URL` field ใน admin email settings

## 14. Customer Engagement CRM — Backend

- [ ] 14.1 อัปเดต `api/email-track.php` — หลัง log event ให้ lookup contact และ update engagement_score
- [ ] 14.2 สร้าง `api/engagement-timeline.php`: GET activity timeline ต่อ contact/company
- [ ] 14.3 สร้าง scoring rules CRUD ใน `api/lead-scoring.php`

## 15. Customer Engagement CRM — Frontend

- [ ] 15.1 สร้าง `EngagementTimeline` component แสดง touchpoints chronologically
- [ ] 15.2 เพิ่ม engagement timeline ใน company/contact detail page
- [ ] 15.3 แสดง "Hot Lead" badge บน contact cards ที่ score เกิน threshold
- [ ] 15.4 สร้าง lead scoring configuration panel ใน Admin settings

## 16. Content Distribution (WAT Framework) — Backend

- [ ] 16.1 สร้าง `api/content-posts.php`: CRUD สำหรับ content posts
- [ ] 16.2 สร้าง `api/wat-channels.php`: CRUD สำหรับ WAT channels + credentials (encrypted)
- [ ] 16.3 สร้าง `api/content-publish.php`: POST add to queue, GET status, POST retry
- [ ] 16.4 สร้าง cron script `cron/publish-content.php`: process queue → call platform APIs
- [ ] 16.5 Implement platform publishers: WordPress (REST API), Facebook (Graph API), LINE (Messaging API)

## 17. Content Distribution (WAT Framework) — Frontend

- [ ] 17.1 สร้าง content editor page (`/marketing/content`) พร้อม AI generation panel
- [ ] 17.2 สร้าง WAT channel configuration panel ใน Admin settings (แยกตาม Owned/Earned/Paid)
- [ ] 17.3 สร้าง publish panel — เลือก channels + submit + แสดง queue status
- [ ] 17.4 แสดง publish status badges (รอดำเนินการ/สำเร็จ/ล้มเหลว) และปุ่ม retry
