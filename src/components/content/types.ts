// ─── Content Types — single source of truth ────────────────────────

import { FileText, Image, Video, BookOpen, ListChecks } from 'lucide-react';

export interface ContentItem {
  id: string; title: string; type: string; status: string;
  views: number; likes: number; created_at: string;
  plan_item_id?: string | null;
  caption?: string | null;
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
}

export interface PublishChannel {
  id: string; name: string;
  platform: 'wordpress' | 'wix' | 'custom' | 'facebook' | 'lineoa' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter' | 'lotusdomino';
  endpoint_url: string; is_active: number; created_at: string;
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

// ─── Constants ──────────────────────────────────────────────────────
export const TYPE_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  article: { label: 'บทความ', icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950' },
  image:   { label: 'รูปภาพ', icon: Image,    color: 'text-violet-500 bg-violet-50 dark:bg-violet-950' },
  video:   { label: 'วีดีโอ',  icon: Video,    color: 'text-red-500 bg-red-50 dark:bg-red-950' },
};

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  published: { label: 'เผยแพร่แล้ว', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  draft:     { label: 'ร่าง',        color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  revision:  { label: 'รอแก้ไข',     color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  review:    { label: 'รอเผยแพร่',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
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
};
