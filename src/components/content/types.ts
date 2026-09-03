// ─── Content Types — single source of truth ────────────────────────

import { FileText, Image, Video, BookOpen, ListChecks, CheckCircle2, Clock, Stamp, RotateCcw, Edit3, XCircle } from 'lucide-react';

export interface ContentItem {
  id: string; title: string; type: string; status: string;
  views: number; likes: number; created_at: string;
  plan_item_id?: string | null;
  caption?: string | null;
  // Approver's reason when status is 'rejected' or 'revision'
  reject_reason?: string | null;
  // When the item was sent for approval (transition into pending_approval)
  requested_at?: string | null;
  updated_at?: string | null;
  image_brief?: string | null;
  generated_image_url?: string | null;
  image_gen_status?: string | null;
  video_gen_status?: string | null;
  video_url?: string | null;
  video_job_id?: string | null;
  article_content?: string | null;
  platform?: string | null;
  day_label?: string | null;
  scheduled_date?: string | null;
  plan_title?: string | null;
  plan_id?: string | null;
  week_start?: string | null;
  // SEO / AEO fields
  seo_title?: string | null;
  slug?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  structured_data?: string | null;
  og_image?: string | null;
}

export interface BrandContext {
  id: string; name: string; file_type: 'brand_md' | 'sop_md' | 'custom';
  content: string; parsed_data?: string | null; created_at: string;
}

export interface ContentSkill {
  id: string; name: string; description: string; system_prompt: string;
  content_type?: string;
  steps: { instruction: string; output_type: string }[]; created_at: string;
}

export interface ContentTrigger {
  id: string; command: string; description: string;
  skill_id: string | null; skill_name: string | null;
  content_type?: string;
  is_active: number; created_at: string;
}

export interface ContentPlan {
  id: string; title: string; week_start: string; status: string;
  plan_type?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  plan_start?: string | null;
  plan_end?: string | null;
  trigger_command: string; created_at: string; items?: PlanItem[];
}

export interface PostingAnalytics {
  platform: string;
  day_of_week: number;
  hour_of_day: number;
  avg_engagement: number;
  total_posts: number;
  sample_size: number;
}

export interface PostingAnalyticsResponse {
  has_data: boolean;
  by_day: Record<string, Record<number, number>>;
  by_hour: Record<string, Record<number, number>>;
  recommendations: Array<{
    platform: string;
    day_of_week: number;
    hour_of_day: number;
    avg_engagement: number;
  }>;
}

export interface CalendarItemGroup {
  date: string;
  items: PlanItem[];
}

export type CalendarView = 'month' | 'quarter' | 'year';

export interface PlanItem {
  id: string; plan_id: string; day_label: string; day_order: number;
  scheduled_date?: string | null; platform: string; topic: string;
  caption: string; image_brief: string;
  generated_image_url: string | null; image_gen_status: string;
  article_content?: string | null;
  content_item_id?: string | null;
  content_type?: string | null;
  reject_reason?: string | null;
}

export interface PublishChannel {
  id: string; name: string;
  platform: 'wordpress' | 'wix' | 'custom' | 'facebook' | 'lineoa' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter' | 'lotusdomino';
  endpoint_url: string; is_active: number; created_at: string;
  // ผลตรวจอายุ credentials เขียนโดย api/cron/content-metrics-sync.php
  // null = ยังไม่เคยตรวจ ซึ่งต่างจาก 'valid' (ตรวจแล้วปกติ) — ห้ามยุบสองกรณีนี้เข้าด้วยกัน
  token_status?: 'valid' | 'expiring' | 'expired' | 'invalid' | 'unsupported' | null;
  token_expires_at?: string | null;       // null = ไม่มีวันหมดอายุ (Page token คืน 0)
  data_access_expires_at?: string | null; // เดดไลน์คนละตัวจาก token_expires_at
  token_checked_at?: string | null;
  token_error?: string | null;
}

export interface ContentSchedule {
  id: string; plan_item_id: string; channel_id: string;
  scheduled_at: string; status: string; publish_result: string | null;
  channel_name?: string; platform?: string;
  topic?: string; day_label?: string; plan_title?: string; week_start?: string;
}

export interface PublishQueueItem {
  id: string; content_id: string; channel_id: string;
  channel_name?: string; platform?: string;
  scheduled_at: string; status: 'pending' | 'processing' | 'sent' | 'failed';
  sent_at?: string | null; error_msg?: string | null;
}

export interface GlobalSettings {
  global_instruction: string; image_gen_provider: string; image_gen_model: string;
  image_gen_base_url: string; product_ref_image_url: string; product_refs?: string;
  has_image_gen_key: boolean;
  research_provider?: string; research_api_login?: string; has_research_key?: boolean;
  research_location_code?: number; research_language_code?: string; research_cache_hours?: number;
  weekly_posts_target?: number;
}

/** ช่วงวันที่ YYYY-MM-DD ที่ endpoint ใช้จริง */
export interface DateRange {
  from: string;
  to: string;
}

export interface ResultMetricsResponse {
  /** ช่วงวันที่ที่ backend ใช้จริง (default 12 เดือนย้อนหลังเมื่อ client ไม่ส่งมา) */
  range: DateRange;
  /** ค่าเฉลี่ยชั่วโมง created_at → approved_at ในช่วงวันที่ (null = ยังไม่มีรายการที่อนุมัติ) */
  avg_production_hours: number | null;
  approved_count: number;
  /** snapshot 7 วันล่าสุด — ไม่ผูกช่วงวันที่ที่เลือก */
  posts_last_7_days: number;
  published_count: number;
  /** เป้าหมายโพสต์/สัปดาห์ (0 = ยังไม่ได้ตั้งเป้าหมาย) — snapshot */
  weekly_posts_target: number;
  has_data: boolean;
}

// ── Content BI (api/content-analytics.php) ─────────────────────

export interface QueueFailure {
  id: string; content_id: string; channel_id: string;
  title: string;
  channel_name: string | null;
  /** null เมื่อ channel มี platform เป็นสตริงว่าง */
  platform: string | null;
  error_msg: string | null;
  retry_count: number;
  scheduled_at: string;
}

export interface StaleContentItem {
  id: string; title: string; status: string;
  platform: string | null;
  age_days: number;
}

export interface AssetGenBreakdown {
  none: number; generating: number; done: number; failed: number;
}

export interface ContentOverview {
  queue: {
    pending: number; processing: number; sent: number; failed: number;
    /** pending ที่เลย scheduled_at แล้ว */
    overdue_pending: number;
    total: number;
    failures: QueueFailure[];
  };
  /** นับ "เคยผ่าน" แต่ละขั้นจาก timestamp (ไม่ใช่ status ปัจจุบัน) */
  funnel: {
    created: number; requested: number; approved: number; published: number;
  };
  aging: {
    d0_7: number; d8_30: number; d31_90: number; d90_plus: number;
    total: number;
    /** null = ไม่มีคอนเทนต์ที่ยังไม่เผยแพร่ */
    oldest_days: number | null;
    items: StaleContentItem[];
  };
  assets: { image: AssetGenBreakdown; video: AssetGenBreakdown };
}

export interface ThroughputPoint {
  /** 'YYYY-MM' */
  period: string;
  created: number; requested: number; approved: number; published: number;
}

export interface LeadTimeStage {
  key: string; label: string;
  sample_size: number;
  /** null = ขั้นนี้ยังไม่มีรายการที่มี timestamp ครบทั้งสองฝั่ง */
  avg_hours: number | null;
  p50_hours: number | null;
  p90_hours: number | null;
}

export interface SeoFieldCompleteness {
  key: string; label: string;
  filled: number; total: number; pct: number;
}

export interface PlanConversionRow {
  plan_type: string; label: string;
  plans: number; plan_items: number;
  converted: number; published: number; convert_pct: number;
}

export interface PublishSuccessRow {
  /** '__unknown__' = channel ไม่ระบุแพลตฟอร์ม */
  platform: string;
  sent: number; failed: number; pending: number; processing: number; total: number;
  /** null = ยังไม่มีรายการที่จบ (sent+failed = 0) */
  success_pct: number | null;
  top_error: string | null;
}

/** ยอดรวมสำหรับ stat card ของ sub-tab เนื้อหา — นับจากคอนเทนต์ที่ created_at อยู่ในช่วงวันที่ */
export interface ContentStatsSummary {
  total: number;
  /** SUM(published_at IS NOT NULL) ในกลุ่มเดียวกับ total */
  published: number;
  views: number;
  likes: number;
  /** views + likes — 0 คือค่าจริง (ยังไม่มีการซิงก์จากแพลตฟอร์ม) ไม่ใช่ "ไม่มีข้อมูล" */
  engagement: number;
  /** อัตราถึงขั้นเผยแพร่ %; null เมื่อ total = 0 */
  performance_pct: number | null;
}

/**
 * ยอดรวม engagement เฉพาะ Facebook/Instagram — มาจากตาราง time-series
 * `content_post_metrics` (แถวล่าสุดต่อคอนเทนต์+ช่องทาง) ไม่ใช่ `content_items.views/likes`
 * ที่เป็นผลรวมทุกแพลตฟอร์ม
 */
/** สถิติรวมต่อแพลตฟอร์ม (คำนวณจาก snapshot ล่าสุดต่อโพสต์ต่อช่องทาง) */
export interface SocialPlatformStat {
  platform: string;
  posts: number;
  views: number;
  likes: number;
  /** views + likes */
  engagement: number;
}

/** จุดแนวโน้มรายเดือน — เดือนที่ไม่มีข้อมูลจะมีค่าเป็น 0 ทุกช่อง */
export interface SocialMonthlyPoint {
  /** 'YYYY-MM' */
  month: string;
  posts: number;
  views: number;
  likes: number;
  /** views + likes */
  engagement: number;
}

/** โพสต์เด่น เรียงตาม engagement มากไปน้อย */
export interface SocialTopPost {
  content_item_id: string;
  title: string;
  /** แพลตฟอร์มของโพสต์ (คั่นด้วย '/' เมื่อ cross-post) */
  platform: string;
  published_at: string;
  views: number;
  likes: number;
  /** views + likes */
  engagement: number;
  /** permalink จริงจาก content_items.published_url; null = ไม่มี (ไม่เดา URL) */
  published_url: string | null;
}

export interface SocialEngagementSummary {
  /** แพลตฟอร์มที่ตัวเลขนี้ครอบคลุมจริง (มาจาก DISTINCT ของ cohort — ไม่ hardcode) */
  platforms: string[];
  /** จำนวนโพสต์ที่มีข้อมูลซิงก์แล้วในช่วงที่เลือก */
  posts: number;
  views: number;
  likes: number;
  /** views + likes */
  engagement: number;
  /** เวลาซิงก์ล่าสุด; null = ยังไม่เคยซิงก์ */
  last_fetched_at: string | null;
  /** false = ยังไม่มีโพสต์ FB/IG ที่ซิงก์แล้ว → ต้องแสดง "—" ไม่ใช่ 0 */
  has_data: boolean;
  /** breakdown ต่อแพลตฟอร์มที่มีข้อมูลจริงเท่านั้น */
  by_platform: SocialPlatformStat[];
  /** แนวโน้ม engagement รายเดือนตลอดช่วงที่เลือก (เดือนว่าง = 0) */
  monthly: SocialMonthlyPoint[];
  /** โพสต์เด่นสูงสุด 10 รายการ */
  top_posts: SocialTopPost[];
}

export interface ContentAnalytics {
  /** ช่วงวันที่ที่ backend ใช้จริง (default 12 เดือนย้อนหลังเมื่อ client ไม่ส่งมา) */
  range: DateRange;
  stats: ContentStatsSummary;
  /** engagement เฉพาะ Facebook/Instagram จาก content_post_metrics (cohort = โพสต์ที่เผยแพร่ในช่วงที่เลือก) */
  social: SocialEngagementSummary;
  /** หนึ่งจุดต่อเดือนตลอดช่วงวันที่ที่เลือก (เดือนที่ไม่มีข้อมูล = 0) */
  throughput: ThroughputPoint[];
  lead_time: LeadTimeStage[];
  /** snapshot — ไม่ผูกช่วงวันที่ที่เลือก */
  seo: {
    total_articles: number;
    fields: SeoFieldCompleteness[];
    gate_enabled: boolean;
    gate_min_score: number;
  };
  plan_conversion: {
    by_type: PlanConversionRow[];
    /** คอนเทนต์ที่สร้างนอกแผน (plan_item_id IS NULL) */
    adhoc_items: number;
  };
  publish_success: PublishSuccessRow[];
}

export interface AIGatewaySettings {
  ai_active_provider_id: string | null;
  ai_default_model_id: string | null;
  ai_content_model_id: string | null;         // legacy
  ai_content_text_model_id: string | null;
  ai_content_image_model_id: string | null;
  ai_content_video_model_id: string | null;
  provider_name?: string; provider_display_name?: string;
  provider_base_url?: string; provider_has_key?: number;
  model_name?: string; model_identifier?: string;
  content_model_name?: string;
  content_text_model_name?: string;
  content_image_model_name?: string;
  content_video_model_name?: string;
}

export interface ArticleContent {
  title?: string;
  excerpt?: string;
  html?: string;
  caption?: string;
  platform_type?: 'article' | 'video' | 'social';
  headlines?: {
    viral_clickbait?: Array<{ title: string; hook: string }>;
    storytelling?: Array<{ title: string; hook: string }>;
    educational?: Array<{ title: string; hook: string }>;
  };
  scripts?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
  };
  script_sections?: { opening?: string; bridge?: string; twist?: string; ending?: string };
  visuals?: string[];
  hashtags?: string[];
  // SEO / AEO fields
  seo_title?: string;
  slug?: string;
  meta_description?: string;
  meta_keywords?: string;
  structured_data?: Record<string, any>; // JSON-LD structured data (Article, FAQ, BreadcrumbList)
  og_image?: string;
}

export interface SeoFields {
  seo_title: string;
  slug: string;
  meta_description: string;
  meta_keywords: string;
  og_image: string;
  structured_data: string; // raw JSON string
}

export const emptySeoFields = (): SeoFields => ({
  seo_title: '', slug: '', meta_description: '',
  meta_keywords: '', og_image: '', structured_data: '',
});

// ─── SEO checklist (Phase 4 publish gate) ───────────────────────────
// ตรงกับผลลัพธ์จาก api/lib/seo-checklist.php ผ่าน ?action=seo-checklist
export type SeoRuleLevel = 'pass' | 'warn' | 'fail' | 'pending' | 'skip';
export type SeoRuleStatus = 'passed' | 'needs_improvement' | 'failed' | 'pending' | 'skip';
export type SeoGateStatus = 'passed' | 'needs_improvement' | 'failed';

export interface SeoRule {
  key: string;
  level: SeoRuleLevel;
  status: SeoRuleStatus;
  weight: number;
  score: number;
  critical: boolean;
  message: string;
}

export interface SeoChecklistResult {
  score: number;
  gate: SeoGateStatus;
  rules: SeoRule[];
  seo_gate_enabled: 0 | 1;
  seo_gate_min_score: number;
}

export const SEO_GATE_LABEL: Record<SeoGateStatus, { label: string; className: string }> = {
  passed:           { label: 'ผ่าน',        className: 'text-green-600' },
  needs_improvement: { label: 'ควรปรับปรุง', className: 'text-amber-500' },
  failed:           { label: 'ไม่ผ่าน',     className: 'text-destructive' },
};

// ─── Constants ──────────────────────────────────────────────────────
export const TYPE_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  article: { label: 'บทความ', icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950' },
  image:   { label: 'รูปภาพ', icon: Image,    color: 'text-violet-500 bg-violet-50 dark:bg-violet-950' },
  video:   { label: 'วีดีโอ',  icon: Video,    color: 'text-red-500 bg-red-50 dark:bg-red-950' },
};

export const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType; iconColor: string; progressColor: string }> = {
  published:        { label: 'เผยแพร่แล้ว', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',   icon: CheckCircle2, iconColor: 'text-green-600', progressColor: '[&>div]:bg-green-600' },
  draft:            { label: 'ฉบับร่าง',    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',       icon: Edit3,        iconColor: 'text-gray-600',  progressColor: '[&>div]:bg-gray-600' },
  revision:         { label: 'รอแก้ไข',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',       icon: RotateCcw,    iconColor: 'text-blue-600',  progressColor: '[&>div]:bg-blue-600' },
  pending_approval: { label: 'รออนุมัติ',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',   icon: Clock,        iconColor: 'text-amber-600', progressColor: '[&>div]:bg-amber-600' },
  approved:         { label: 'อนุมัติแล้ว', color: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',       icon: Stamp,        iconColor: 'text-teal-600',  progressColor: '[&>div]:bg-teal-600' },
  rejected:         { label: 'ปฏิเสธ',      color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',           icon: XCircle,      iconColor: 'text-red-600',   progressColor: '[&>div]:bg-red-600' },
};

export const PLAN_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'ร่าง',         color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  approved:  { label: 'อนุมัติแล้ว', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  published: { label: 'เผยแพร่แล้ว', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
};

export const FILE_TYPE_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  brand_md: { label: 'brand.md',  color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', icon: BookOpen },
  sop_md:   { label: 'claude.md', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',     icon: ListChecks },
  custom:   { label: 'Custom',    color: 'bg-gray-100 text-gray-600',   icon: FileText },
};

export const PLATFORM_MAP: Record<string, { label: string; color: string }> = {
  wordpress: { label: 'WordPress',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  wix:       { label: 'Wix',         color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  custom:    { label: 'Custom API',  color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  facebook:  { label: 'Facebook',    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  lineoa:    { label: 'Line OA',     color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  instagram: { label: 'Instagram',   color: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300' },
  tiktok:    { label: 'TikTok',      color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  linkedin:  { label: 'LinkedIn',    color: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  twitter:      { label: 'Twitter / X',             color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  lotusdomino:  { label: 'Lotus Notes / Domino',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  youtube:      { label: 'YouTube',                 color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
};
