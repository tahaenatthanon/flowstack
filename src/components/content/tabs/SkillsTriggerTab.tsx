import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import {
  useContentSkills, useContentTriggers,
  useSaveContentSkill, useDeleteContentSkill,
  useSaveContentTrigger, useDeleteContentTrigger,
} from '@/hooks/useContent';
import type { ContentSkill, ContentTrigger } from '@/components/content/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Bot, Zap, Pencil, Trash2, X, FileText, Video, Sparkles, Download } from 'lucide-react';

// ─── Step output type labels ──────────────────────────────────────────────────
const STEP_TYPE_LABELS: Record<string, string> = {
  caption:     'Caption / โพสต์',
  image_brief: 'Image Prompt',
  plan:        'Content Plan',
  analysis:    'วิเคราะห์ / Outline',
  article:     'บทความ HTML',
  script:      'Script วีดิโอ',
  hashtags:    'Tags & Hashtags',
};

// ─── Professional skill templates ────────────────────────────────────────────
interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  steps: Array<{ instruction: string; output_type: string }>;
}

interface DefaultTrigger {
  command: string;
  description: string;
  skill_template_id: string | null;
}

const ARTICLE_TEMPLATES: SkillTemplate[] = [
  {
    id: 'seo-article',
    name: 'เขียนบทความ SEO',
    description: 'สร้างบทความภาษาไทยที่ติดอันดับ Google พร้อม Structure, Meta Description และ CTA',
    system_prompt: `คุณเป็นนักเขียนบทความภาษาไทยระดับมืออาชีพที่เชี่ยวชาญ SEO On-Page สำหรับตลาดไทย เขียนบทความที่ Google ชอบและผู้อ่านเข้าใจง่าย

กฎที่ต้องปฏิบัติตาม:
- ใช้ภาษาไทยที่เป็นธรรมชาติ อ่านง่าย ไม่แข็งกระด้าง
- โครงสร้าง: H1 (หัวข้อหลัก) → H2 (หัวข้อย่อย) → H3 (หัวข้อย่อยของย่อย)
- ความยาวบทความ: 800–1,500 คำ
- Keyword Density: 1–2% (ธรรมชาติ ไม่ยัดคำ)
- ทุกบทความต้องมี: Introduction ดึงดูด, เนื้อหาแบ่งหัวข้อชัดเจน, สรุปพร้อม CTA
- Meta Description: ไม่เกิน 160 ตัวอักษร มี Keyword หลัก
- Excerpt: สรุป 2–3 ประโยคแรกที่น่าสนใจ`,
    steps: [
      { instruction: 'วิเคราะห์ Keyword หลัก สร้าง Outline บทความ (H1, H2, H3) และระบุ Search Intent ของผู้ค้นหา', output_type: 'analysis' },
      { instruction: 'เขียนบทความเต็มรูปแบบตาม Outline ใช้ HTML tags (h2, h3, p, ul, li, strong) ภาษาไทยชัดเจนเป็นธรรมชาติ', output_type: 'article' },
      { instruction: 'สร้าง Meta Description (ไม่เกิน 160 ตัวอักษร) และ Excerpt น่าสนใจ 2 ประโยค พร้อม CTA', output_type: 'caption' },
    ],
  },
  {
    id: 'social-repurpose',
    name: 'แปลงบทความเป็น Social Caption',
    description: 'ย่อบทความยาวให้เป็น Caption ดึงดูดสำหรับ Facebook, Instagram, LinkedIn พร้อม Hashtags',
    system_prompt: `คุณเป็น Social Media Copywriter มืออาชีพสำหรับตลาดไทย เก่งในการย่อบทความยาวให้เป็น Caption สั้น กระชับ ดึงดูด เหมาะกับแต่ละ Platform

หลักการทำงาน:
- Facebook: เล่าเรื่องแบบ Storytelling 2–4 ย่อหน้า + CTA ชัดเจน + Emoji พอดี
- Instagram: Hook ดึงดูด + เนื้อหากระชับ + บรรทัดใหม่ทุกประโยค + 10–15 Hashtags
- LinkedIn: โทนมืออาชีพ + Insight ลึก + 1–2 ย่อหน้า
- ภาษาไทยเป็นธรรมชาติ ไม่เป็นทางการมากเกินไป
- ทุก Caption ต้องมี Hook ใน 2 บรรทัดแรก เพื่อป้องกันถูก "See More" ใน Feed`,
    steps: [
      { instruction: 'ดึงประเด็นหลัก 3–5 ข้อจากบทความที่น่าสนใจที่สุดสำหรับ Social Media', output_type: 'analysis' },
      { instruction: 'เขียน Caption สำหรับ Facebook (Hook + เล่าเรื่อง 2 ย่อหน้า + CTA) ใส่ Emoji ที่เหมาะสม', output_type: 'caption' },
      { instruction: 'เขียน Caption สำหรับ Instagram (Hook สั้น + เนื้อหากระชับ + 12 Hashtags ไทย-อังกฤษ) และ LinkedIn (มืออาชีพ)', output_type: 'caption' },
    ],
  },
  {
    id: 'email-line',
    name: 'เขียน Email / LINE OA Broadcast',
    description: 'เขียน Broadcast Message สำหรับ Email Marketing และ LINE OA ที่เปิดอ่านสูง',
    system_prompt: `คุณเป็น Email Marketing & LINE OA Copywriter สำหรับตลาดไทย เขียนข้อความที่เปิดอ่านสูงและกระตุ้นการคลิก

หลักการทำงาน:
- Email: Subject Line ดึงดูด (ไม่เกิน 50 ตัวอักษร), Preview Text สั้น, เนื้อหากระชับ 3–4 ย่อหน้า, ปุ่ม CTA 1 ปุ่ม
- LINE OA: ข้อความสั้น 3–5 บรรทัด, ใช้ Emoji พอดี, มีลิงก์เดียว, โทนเป็นกันเองเหมือนแชทกับเพื่อน
- Personalization: ใส่ตัวแปร {{ชื่อลูกค้า}} หรือ {{บริษัท}} ให้รู้สึกเฉพาะบุคคล
- หลีกเลี่ยงคำ Spam ที่ทำให้ Email ตก Junk (ฟรี, รวย, ด่วน, $$$)
- A/B Testing: สร้าง 2 เวอร์ชันสำหรับทดสอบ`,
    steps: [
      { instruction: 'วิเคราะห์กลุ่มเป้าหมาย Offer และ Pain Point เพื่อกำหนดมุมการเขียน', output_type: 'analysis' },
      { instruction: 'เขียน Email: Subject Line 3 แบบ + Preview Text + เนื้อหา 3-4 ย่อหน้า + ปุ่ม CTA', output_type: 'article' },
      { instruction: 'เขียน LINE OA: ข้อความสั้น 3-5 บรรทัด โทนเป็นกันเอง มี 1 ลิงก์ + Emoji พอดี', output_type: 'caption' },
    ],
  },
  {
    id: 'press-release',
    name: 'เขียนข่าวประชาสัมพันธ์',
    description: 'Press Release แบบมืออาชีพ พร้อมหัวข้อดึงดูดสื่อมวลชนและโครงสร้างมาตรฐาน',
    system_prompt: `คุณเป็น PR Writer มืออาชีพสำหรับตลาดไทย เขียน Press Release ที่สื่อมวลชนอยากหยิบไปลง

โครงสร้าง Press Release มาตรฐาน:
- หัวข้อข่าว: ดึงดูด กระชับ ไม่เกิน 80 ตัวอักษร
- วรรคนำ (Lead): 5W1H ใน 2–3 ประโยคแรก (ใคร ทำอะไร เมื่อไหร่ ที่ไหน ทำไม อย่างไร)
- เนื้อหาข่าว: 3–4 ย่อหน้า เรียงลำดับความสำคัญ (Inverted Pyramid)
- Quote: คำพูดผู้บริหาร 1–2 Quote ที่ฟังดูเป็นธรรมชาติและมีเนื้อหา
- Boilerplate: เกี่ยวกับบริษัท 1 ย่อหน้าสั้น
- สื่อติดต่อ: ชื่อ-เบอร์-อีเมล
- โทน: เป็นทางการแต่ไม่แข็ง อ่านแล้วเห็นภาพ`,
    steps: [
      { instruction: 'วิเคราะห์ประเด็นข่าว กำหนด Angle ที่น่าสนใจ และข้อมูล 5W1H', output_type: 'analysis' },
      { instruction: 'เขียน Press Release เต็มรูปแบบ: หัวข้อข่าว + Lead + เนื้อหา 3-4 ย่อหน้า + Quote ผู้บริหาร', output_type: 'article' },
      { instruction: 'เขียน Subject Line สำหรับส่งอีเมลถึงสื่อ + สรุป 1 ย่อหน้าสำหรับ Line Official', output_type: 'caption' },
    ],
  },
  {
    id: 'product-desc',
    name: 'เขียนคำบรรยายสินค้า',
    description: 'Product Description และ Landing Page Copy ที่โน้มน้าวและขายได้',
    system_prompt: `คุณเป็น Copywriter สาย Conversion สำหรับตลาดไทย เชี่ยวชาญการเขียน Product Description และ Landing Page ที่เปลี่ยนผู้อ่านเป็นลูกค้า

หลักการทำงาน:
- Product Short Description: 1–2 ประโยค สื่อ USP ชัดเจน (ใช้ในหน้าหมวดหมู่/การ์ดสินค้า)
- Product Full Description: 4–6 sections (ปัญหา → วิธีแก้ → Features → Benefits → Social Proof → CTA)
- Landing Page: Hero + Pain Point + Solution + Features/Benefits + Testimonials + Pricing (ถ้ามี) + FAQ + CTA
- ใช้ Sensory Words ให้เห็นภาพ: "สัมผัสนุ่มเหมือนผ้าไหม" แทน "วัสดุคุณภาพดี"
- Benefits > Features: บอกว่าลูกค้าได้อะไร ไม่ใช่แค่ของมีอะไร
- AIDA Framework: Attention → Interest → Desire → Action`,
    steps: [
      { instruction: 'วิเคราะห์ USP, Target Persona และ Pain Point ของกลุ่มเป้าหมาย', output_type: 'analysis' },
      { instruction: 'เขียน Product Short Description (1-2 ประโยค) + Full Description (4-6 sections แบบ AIDA)', output_type: 'article' },
      { instruction: 'เขียน Landing Page Copy: Hero Headline + Subheadline + 3 Benefits + Testimonial Format + CTA', output_type: 'article' },
    ],
  },
  {
    id: 'content-calendar',
    name: 'วางแผนคอนเทนต์รายเดือน',
    description: 'สร้าง Content Calendar 30 วัน พร้อม Theme, Topic, Format และ Channel สำหรับทีมคอนเทนต์',
    system_prompt: `คุณเป็น Content Strategist ระดับมืออาชีพ วางแผนคอนเทนต์รายเดือนแบบครบวงจรสำหรับตลาดไทย

หลักการวางแผน:
- แบ่งเดือนเป็น 4 สัปดาห์ แต่ละสัปดาห์มี Theme หลัก 1 เรื่อง
- Content Mix สมดุล: Educate 40% + Entertain 30% + Inspire 20% + Convert 10%
- แต่ละวันระบุ: Topic, Format (บทความ/รูป/VDO/Infographic), Channel (FB/IG/LINE/TikTok/Web), เป้าหมาย
- คำนึงถึงวันสำคัญ เทศกาลไทย วันหยุด และ Seasonal Trend
- กำหนด Content Pillar ที่สอดคล้องกับ Brand Identity และ Audience Journey
- ทุกสัปดาห์ต้องมี 1 Hero Content (คุณภาพสูง) + 2-3 Hygiene Content (สม่ำเสมอ)`,
    steps: [
      { instruction: 'กำหนด Theme 4 สัปดาห์ สอดคล้องกับ Brand Pillar, ฤดูกาล และวันสำคัญของไทยในเดือนนั้น', output_type: 'plan' },
      { instruction: 'สร้าง Topic วันละ 1-2 หัวข้อ รวม 30-45 หัวข้อ ระบุ Format, Channel, เป้าหมาย และ Content Pillar', output_type: 'plan' },
      { instruction: 'ระบุ Hero Content 4 ชิ้น (1 ต่อสัปดาห์) พร้อม Caption และ Image Brief สำหรับแต่ละชิ้น', output_type: 'caption' },
    ],
  },
];

const VIDEO_TEMPLATES: SkillTemplate[] = [
  {
    id: 'video-script',
    name: 'สร้าง Script วีดิโอยาว',
    description: 'เขียน Script YouTube 8-15 นาที พร้อม Hook, B-roll Suggestion, Timestamp และ CTA',
    system_prompt: `คุณเป็น Video Script Writer ระดับมืออาชีพสำหรับ YouTube และ Long-form Content ในตลาดไทย

โครงสร้าง Script:
- HOOK (0:00-0:30): Pattern Interrupt, คำถามที่ตอบยาก, ข้อเท็จจริงน่าตกใจ หรือ Promise ชัดเจน
- INTRO (0:30-1:30): เกริ่นเรื่อง บอกว่า Audience จะได้อะไร
- VALUE (1:30-12:00): เนื้อหาหลัก แบ่งเป็น Section พร้อม Timestamp ทุก 60-90 วินาที
- CTA (12:00-13:00): ชัดเจน 1 อย่าง (Like / Comment / Subscribe / Link ใน Bio)
- END SCREEN (13:00-13:30): สรุป + แนะนำคลิปต่อไป

ข้อกำหนดเพิ่มเติม:
- B-roll Suggestion: ระบุภาพที่ควรตัดมาประกอบในแต่ละช่วง
- Transition Phrase: ประโยคเชื่อมระหว่าง Section ไม่ให้รู้สึกกระโดด
- Tone: เป็นธรรมชาติ เหมือนคุยกับเพื่อน ไม่แข็ง ไม่เป็นทางการเกินไป
- หลีกเลี่ยงคำ filler: "เอ่อ..." "คือว่า..." "แบบว่า..." — เขียนให้กระชับ
- Sound Design Hint: ระบุ mood เพลงประกอบในแต่ละ Section (ถ้าจำเป็น)`,
    steps: [
      { instruction: 'สร้าง Hook 3 แบบ: Pattern Interrupt, คำถาม, Promise — เลือกแบบที่ดีที่สุดพร้อมเหตุผล', output_type: 'script' },
      { instruction: 'เขียนเนื้อหาหลักพร้อม Timestamp ทุก Section, Transition Phrase และ B-roll Suggestion ในแต่ละช่วง', output_type: 'script' },
      { instruction: 'เขียน CTA ปิดวีดิโอที่ชัดเจน + End Screen Script สำหรับแนะนำคลิปต่อไป', output_type: 'script' },
    ],
  },
  {
    id: 'youtube-seo',
    name: 'SEO สำหรับ YouTube',
    description: 'สร้าง Title, Description, Tags และ Hashtags เพื่อให้วีดิโอติดอันดับการค้นหา YouTube',
    system_prompt: `คุณเป็น YouTube SEO Specialist เชี่ยวชาญการ Optimize Title, Description และ Tags สำหรับ YouTube Algorithm และ Search

ความเชี่ยวชาญ:
- CTR Optimization: สร้าง Title ที่คนอยากคลิก (CTR สูง) พร้อม Keyword ที่ค้นหาได้จริง
- Description Structure: Paragraph สั้นพร้อม Keyword ใน 100 ตัวแรก (ก่อน "See More"), Timestamp, Links
- Tags Strategy: Mix ระหว่าง Broad + Specific + Long-tail Keywords (15-20 คำ)
- Hashtags: 3-5 อัน (ปรากฏเหนือ Title) เลือกที่มี Volume แต่ไม่ Competition สูงเกินไป
- ใช้ทั้งภาษาไทยและอังกฤษ (บาง Keyword คนไทยค้นเป็นอังกฤษ)
- วิเคราะห์คู่แข่ง: ดูว่า Top 3 วิดีโอใน Keyword นี้ใช้อะไรบ้าง`,
    steps: [
      { instruction: 'สร้าง Title 3 แบบ: SEO (keyword ชัด), Curiosity Gap, How-to Format พร้อมอธิบายว่าแต่ละแบบเหมาะกับอะไร', output_type: 'caption' },
      { instruction: 'เขียน Description 3 ส่วน: Hook paragraph (100 ตัวแรก) + Timestamps/Chapters + Links/CTA พร้อม Keyword ธรรมชาติ', output_type: 'article' },
      { instruction: 'สร้าง Tags 15-20 คำ (ไทย + อังกฤษ) และ 5 Hashtags ที่มี Volume ปานกลาง Competition ต่ำ', output_type: 'hashtags' },
    ],
  },
  {
    id: 'short-script',
    name: 'สร้าง Script สั้น (Reels/TikTok)',
    description: 'Script 30-60 วินาที พร้อม Hook แรง, Pattern Interrupt และ CTA ที่ใช่',
    system_prompt: `คุณเป็น Short-form Content Script Writer สำหรับ TikTok, Reels, YouTube Shorts ในตลาดไทย

หลักการเขียน Script สั้น:
- Hook 0-3 วิ: ต้องดึงดูดใน 3 วินาทีแรก — ภาพแรง / คำถามสะกิด / Before-After / ความเชื่อผิดๆ
- Retention Hook ทุก 7-10 วิ: Text Overlay, ภาพเปลี่ยน, เสียงเปลี่ยน — ให้คนดูต่อ
- โครงสร้าง 30 วิ: Hook → Context (5 วิ) → Value (20 วิ) → CTA (5 วิ)
- โครงสร้าง 60 วิ: Hook → Context (5 วิ) → Value (40 วิ) → CTA (15 วิ)
- Caption: 1-2 บรรทัด บรรยายเพิ่ม + Hashtags 5-8 อัน
- Text Overlay: ระบุตำแหน่งข้อความบนจอและการเปลี่ยนจังหวะ
- Trend-aware: ใช้ Trend Format, Audio, Transition ที่กำลังมาในไทย`,
    steps: [
      { instruction: 'สร้าง Hook 3 แบบที่ดึงดูดใน 3 วิ: Visual Hook, Question Hook, Controversial Statement', output_type: 'script' },
      { instruction: 'เขียน Script 30-60 วิ: Hook → Context → Value → CTA พร้อม Text Overlay แนะนำแต่ละจังหวะ', output_type: 'script' },
      { instruction: 'เขียน Caption สำหรับโพสต์ 1-2 บรรทัด + 8 Hashtags ไทย-อังกฤษ + แนะนำ Audio/Trend', output_type: 'caption' },
    ],
  },
  {
    id: 'desc-chapters',
    name: 'เขียน Description & Chapters',
    description: 'YouTube Description พร้อม Timestamp Chapters และ Links ที่ช่วยเพิ่ม Watch Time',
    system_prompt: `คุณเป็น YouTube Content Optimizer เชี่ยวชาญการเขียน Description และ Chapter ที่เพิ่ม Watch Time และ SEO

สิ่งที่ต้องทำ:
- Chapters: แบ่งวีดิโอเป็น 5-8 ช่วง แต่ละช่วงมี Timestamp + ชื่อ Chapter ดึงดูด (ไม่ใช่แค่ "ตอนที่ 1" แต่บอกว่าเนื้อหาคืออะไร)
- Chapter Name: ใช้ Keyword + Curiosity — "0:00 - ทำไมต้องใช้ AI ช่วยเขียนบทความ" ดีกว่า "0:00 - เริ่มต้น"
- Description Hook (100 ตัวแรก): สรุปเนื้อหาพร้อม Keywords สำคัญ
- Description Body: Background, Key Takeaways, Resources/Links
- Description Footer: Subscribe CTA + Social Links + Related Videos
- Affiliate/Product Links: จัดกลุ่มแยกชัดเจน (ถ้ามี)
- ใช้ Emoji ใน Chapter Title เพิ่มความโดดเด่น`,
    steps: [
      { instruction: 'สร้าง Chapters 5-8 ช่วง พร้อม Timestamp และชื่อ Chapter ที่ใช้ Keyword + Curiosity', output_type: 'plan' },
      { instruction: 'เขียน Description เต็ม: Hook 100 ตัวแรก + Key Takeaways + Resources + Footer Links', output_type: 'article' },
      { instruction: 'สร้าง Related Videos Section และ Call-to-Action Links + Social Links', output_type: 'caption' },
    ],
  },
  {
    id: 'thumbnail',
    name: 'คอนเซปต์ Thumbnail',
    description: 'Thumbnail Concept Brief สำหรับนักออกแบบ พร้อมวิเคราะห์แนวที่ CTR สูง',
    system_prompt: `คุณเป็น Thumbnail Strategist สำหรับ YouTube เชี่ยวชาญการคิด Thumbnail Concept ที่ CTR สูงสำหรับตลาดไทย

สิ่งที่ต้องวิเคราะห์และออกแบบ:
- วิเคราะห์ Thumbnail Top 3 ของคู่แข่งใน Keyword นี้: ใช้สีอะไร, ภาพแบบไหน, Text กี่คำ, อารมณ์แบบไหน
- เสนอแนว Thumbnail 3 แบบ:
  1. Safe (ตามเทรนด์หมวดหมู่ — CTR กลางๆ)
  2. Curiosity Gap (ทำให้สงสัยต้องคลิก — CTR สูง)
  3. Bold/Different (แตกต่างจากคู่แข่ง — เสี่ยงแต่ Viral ได้)
- แต่ละแนวระบุ: Composition (จุดโฟกัส), Color Palette, Text Overlay (ไม่เกิน 4 คำ), Facial Expression, Background
- กฎ Thumbnail: ตัวหนังสือใหญ่ อ่านออกแม้ขนาดเล็ก, ใบหน้าชัด (ถ้ามี), Contrast สูง, ไม่ซ้ำกับ Title
- Text Overlay ภาษาไทย: สั้น 2-4 คำ ใช้ฟอนต์หนา`,
    steps: [
      { instruction: 'วิเคราะห์ Thumbnail Top 3 คู่แข่ง: สี, Composition, Text, อารมณ์ — หา Pattern และโอกาสสร้างความต่าง', output_type: 'analysis' },
      { instruction: 'ออกแบบ Thumbnail Concept 3 แนว: Safe / Curiosity Gap / Bold พร้อม Composition, สี, Text Overlay', output_type: 'image_brief' },
      { instruction: 'ระบุ Text Overlay ภาษาไทย (2-4 คำ) สำหรับแต่ละแนว + แนะนำ Facial Expression และ Mood', output_type: 'caption' },
    ],
  },
  {
    id: 'video-calendar',
    name: 'วางแผนคอนเทนต์วีดิโอรายเดือน',
    description: 'Video Content Calendar พร้อม Series, Format และ Platform Strategy',
    system_prompt: `คุณเป็น Video Content Strategist วางแผนคอนเทนต์วีดิโอรายเดือนสำหรับ YouTube, TikTok, Reels

กลยุทธ์การวางแผน:
- กำหนด Series หลัก 4 ตอน (1 ตอนต่อสัปดาห์) แต่ละตอนมี Theme และ Hook ของตัวเอง
- Long-form (YouTube): 4 ตอนหลัก (Hero Content)
- Short-form (TikTok/Reels/Shorts): 12-16 คลิป (Repurpose จาก Long-form + Original)
- Content Mix: Tutorial 30% + Entertainment 30% + Behind-the-scenes 20% + Trending 20%
- แต่ละตอนระบุ: Title, Hook, Key Points, Target Duration, Thumbnail Idea
- วางเผื่อ Live Stream 1-2 ครั้งต่อเดือน (ถ้าเหมาะกับแบรนด์)
- Community Post: 4-8 โพสต์ (โพล, เบื้องหลัง, teaser ตอนต่อไป)
- Seasonality: คำนึงถึงวันสำคัญ เทศกาล และกระแสรายเดือน`,
    steps: [
      { instruction: 'กำหนด Series 4 ตอนหลัก (YouTube Long-form) พร้อม Theme, Hook, Key Points และ Thumbnail Idea', output_type: 'plan' },
      { instruction: 'สร้าง Short-form Plan: 12-16 คลิป (TikTok/Reels/Shorts) จาก Long-form + Original content', output_type: 'plan' },
      { instruction: 'วาง Community Post 4-8 โพสต์ + Live Stream Plan + Cross-platform Posting Schedule', output_type: 'caption' },
    ],
  },
];

const TEMPLATES: Record<'article' | 'video', SkillTemplate[]> = {
  article: ARTICLE_TEMPLATES,
  video:   VIDEO_TEMPLATES,
};

const DEFAULT_TRIGGERS: Record<'article' | 'video', DefaultTrigger[]> = {
  article: [
    { command: 'เขียนบทความ',  description: 'สั่งให้ AI เขียนบทความ SEO ใหม่ตาม Keyword ที่กำหนด', skill_template_id: 'seo-article' },
    { command: 'แปลงบทความ',  description: 'แปลงบทความที่มีอยู่เป็น Caption สำหรับ Facebook, Instagram, LinkedIn', skill_template_id: 'social-repurpose' },
    { command: 'เขียนอีเมล',   description: 'เขียน Broadcast Message สำหรับ Email และ LINE OA', skill_template_id: 'email-line' },
    { command: 'เขียนข่าว',    description: 'เขียน Press Release และข่าวประชาสัมพันธ์', skill_template_id: 'press-release' },
    { command: 'เขียนคำบรรยาย', description: 'เขียน Product Description และ Landing Page สำหรับสินค้า', skill_template_id: 'product-desc' },
    { command: 'แผนคอนเทนต์', description: 'สร้าง Content Calendar รายเดือนสำหรับทีมคอนเทนต์', skill_template_id: 'content-calendar' },
    { command: 'สรุปประเด็น',  description: 'สรุปเนื้อหายาวให้เป็นประเด็นสำคัญ 5-7 ข้อ', skill_template_id: null },
  ],
  video: [
    { command: 'สร้าง Script',     description: 'สร้าง Script วีดิโอยาวสำหรับ YouTube พร้อม Hook, B-roll, CTA', skill_template_id: 'video-script' },
    { command: 'SEO YouTube',      description: 'สร้าง Title, Description, Tags, Hashtags สำหรับ YouTube', skill_template_id: 'youtube-seo' },
    { command: 'Script สั้น',       description: 'สร้าง Script สั้น 30-60 วิ สำหรับ Reels/TikTok/Shorts', skill_template_id: 'short-script' },
    { command: 'เขียน Description', description: 'เขียน YouTube Description พร้อม Chapters และ Links', skill_template_id: 'desc-chapters' },
    { command: 'ไอเดีย Thumbnail',  description: 'สร้าง Thumbnail Concept Brief สำหรับนักออกแบบ', skill_template_id: 'thumbnail' },
    { command: 'แผนวีดิโอ',        description: 'สร้าง Video Content Calendar รายเดือน', skill_template_id: 'video-calendar' },
  ],
};

// ─── Form types ───────────────────────────────────────────────────────────────
type ContentTypeKey = 'article' | 'video';

interface SkillForm {
  name: string; description: string; system_prompt: string;
  steps: Array<{ instruction: string; output_type: string }>;
  content_type: ContentTypeKey;
}

interface TriggerForm {
  command: string; description: string; skill_id: string;
  content_type: ContentTypeKey;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SkillsTriggerTab() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [contentType, setContentType] = useState<ContentTypeKey>('article');
  const [installing, setInstalling] = useState(false);

  // Skill dialog
  const [skillDialog, setSkillDialog]   = useState(false);
  const [editingSkill, setEditingSkill] = useState<ContentSkill | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('__none__');
  const [skillForm, setSkillForm] = useState<SkillForm>({
    name: '', description: '', system_prompt: '', steps: [], content_type: 'article',
  });

  // Trigger dialog
  const [triggerDialog, setTriggerDialog] = useState(false);
  const [editingTrig, setEditingTrig]     = useState<ContentTrigger | null>(null);
  const [trigForm, setTrigForm] = useState<TriggerForm>({
    command: '', description: '', skill_id: '__none__', content_type: 'article',
  });

  const { data: skills   = [], isLoading: loadSkills   } = useContentSkills();
  const { data: triggers = [], isLoading: loadTriggers } = useContentTriggers();

  const saveSkillMut = useSaveContentSkill();
  const delSkillMut  = useDeleteContentSkill();
  const saveTrigMut  = useSaveContentTrigger();
  const delTrigMut   = useDeleteContentTrigger();

  // Filtered by active content type (treat null/undefined as 'article')
  const typeSkills   = skills.filter(s => (s.content_type || 'article') === contentType);
  const typeTriggers = triggers.filter(t => (t.content_type || 'article') === contentType);

  // ─── Skill handlers ───────────────────────────────────────────────────────
  const openCreateSkill = () => {
    setEditingSkill(null);
    setSelectedTemplate('__none__');
    setSkillForm({ name: '', description: '', system_prompt: '', steps: [], content_type: contentType });
    setSkillDialog(true);
  };

  const openEditSkill = (sk: ContentSkill) => {
    setEditingSkill(sk);
    setSelectedTemplate('__none__');
    setSkillForm({
      name: sk.name, description: sk.description, system_prompt: sk.system_prompt,
      steps: sk.steps ?? [], content_type: (sk.content_type as ContentTypeKey) || contentType,
    });
    setSkillDialog(true);
  };

  const applyTemplate = (tplId: string) => {
    setSelectedTemplate(tplId);
    if (tplId === '__none__') return;
    const tpl = TEMPLATES[skillForm.content_type].find(t => t.id === tplId);
    if (!tpl) return;
    setSkillForm(f => ({ ...f, name: tpl.name, description: tpl.description, system_prompt: tpl.system_prompt, steps: tpl.steps }));
  };

  const addStep    = () => setSkillForm(f => ({ ...f, steps: [...f.steps, { instruction: '', output_type: 'caption' }] }));
  const removeStep = (i: number) => setSkillForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));
  const updateStep = (i: number, field: string, val: string) =>
    setSkillForm(f => ({ ...f, steps: f.steps.map((s, idx) => idx === i ? { ...s, [field]: val } : s) }));

  const handleSaveSkill = () => {
    saveSkillMut.mutate(
      { ...skillForm, id: editingSkill?.id },
      { onSuccess: () => { setSkillDialog(false); setEditingSkill(null); toast({ title: editingSkill ? 'แก้ไข Skill แล้ว' : 'สร้าง Skill แล้ว' }); } }
    );
  };

  // ─── Trigger handlers ─────────────────────────────────────────────────────
  const openCreateTrigger = () => {
    setEditingTrig(null);
    setTrigForm({ command: '', description: '', skill_id: '__none__', content_type: contentType });
    setTriggerDialog(true);
  };

  const openEditTrigger = (tr: ContentTrigger) => {
    setEditingTrig(tr);
    setTrigForm({
      command: tr.command, description: tr.description,
      skill_id: tr.skill_id ?? '__none__', content_type: (tr.content_type as ContentTypeKey) || contentType,
    });
    setTriggerDialog(true);
  };

  const handleSaveTrigger = () => {
    saveTrigMut.mutate(
      { ...trigForm, skill_id: trigForm.skill_id === '__none__' ? null : trigForm.skill_id, id: editingTrig?.id },
      { onSuccess: () => { setTriggerDialog(false); setEditingTrig(null); toast({ title: editingTrig ? 'แก้ไข Trigger แล้ว' : 'สร้าง Trigger แล้ว' }); } }
    );
  };

  // ─── Install all defaults for the current type ────────────────────────────
  const handleInstallDefaults = async () => {
    setInstalling(true);
    try {
      const templates = TEMPLATES[contentType];
      const skillIdMap: Record<string, string> = {};
      for (const tpl of templates) {
        const result: any = await saveSkillMut.mutateAsync({ ...tpl, content_type: contentType });
        if (result?.id) skillIdMap[tpl.id] = result.id;
      }
      for (const tr of DEFAULT_TRIGGERS[contentType]) {
        const skillId = tr.skill_template_id ? (skillIdMap[tr.skill_template_id] ?? null) : null;
        await saveTrigMut.mutateAsync({ command: tr.command, description: tr.description, skill_id: skillId, content_type: contentType });
      }
      const label = contentType === 'article' ? 'บทความ' : 'วีดิโอ';
      toast({ title: `ติดตั้ง Skills & Triggers มาตรฐานสำหรับ${label}แล้ว` });
    } catch (e: any) {
      toast({ title: 'ติดตั้งไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setInstalling(false);
    }
  };

  const typeLabel = contentType === 'article' ? 'บทความ' : 'วีดิโอ';

  return (
    <div className="space-y-5">
      {/* ─── Content type switcher ─── */}
      <Tabs value={contentType} onValueChange={v => setContentType(v as ContentTypeKey)}>
        <TabsList>
          <TabsTrigger value="article" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />บทความ
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-1.5">
            <Video className="h-3.5 w-3.5" />วีดิโอ
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ─── Two-column layout ─── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* ══ SKILLS ══ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-500" />AI Skills
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                System Prompt และขั้นตอนการทำงานของ AI สำหรับ{typeLabel}
              </p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={openCreateSkill}>
              <Plus className="h-3.5 w-3.5" />สร้าง Skill
            </Button>
          </div>

          {loadSkills ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : typeSkills.length === 0 ? (
            <div className="text-center py-10 border rounded-lg border-dashed space-y-3">
              <Bot className="h-8 w-8 mx-auto opacity-25" />
              <div>
                <p className="text-sm text-muted-foreground">ยังไม่มี Skill สำหรับ{typeLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">สร้างเองหรือติดตั้ง Templates มาตรฐาน</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={installing} onClick={handleInstallDefaults}>
                {installing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                ติดตั้ง Templates มาตรฐาน
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {typeSkills.map(sk => (
                <Card key={sk.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-950 shrink-0">
                        <Bot className="h-4 w-4 text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{sk.name}</p>
                        {sk.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{sk.description}</p>}
                        {(sk.steps?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {sk.steps.map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">
                                {i + 1}. {STEP_TYPE_LABELS[s.output_type] ?? s.output_type}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditSkill(sk)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive"
                          onClick={async () => { if (await confirm({ title: 'ลบ Skill', description: 'ลบ Skill นี้?', variant: 'destructive' })) delSkillMut.mutate(sk.id, { onSuccess: () => toast({ title: 'ลบ Skill แล้ว' }) }); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ══ TRIGGERS ══ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />Trigger Commands
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                คำสั่งสั้นที่เรียก Skill โดยอัตโนมัติสำหรับ{typeLabel}
              </p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={openCreateTrigger}>
              <Plus className="h-3.5 w-3.5" />สร้าง Trigger
            </Button>
          </div>

          {loadTriggers ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : typeTriggers.length === 0 ? (
            <div className="text-center py-10 border rounded-lg border-dashed space-y-2">
              <Zap className="h-8 w-8 mx-auto opacity-25" />
              <p className="text-sm text-muted-foreground">ยังไม่มี Trigger สำหรับ{typeLabel}</p>
              <p className="text-xs text-muted-foreground">ติดตั้ง Templates มาตรฐานเพื่อเพิ่ม Triggers อัตโนมัติ</p>
            </div>
          ) : (
            <div className="space-y-2">
              {typeTriggers.map(tr => (
                <Card key={tr.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 shrink-0">
                        <Zap className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-semibold text-amber-700 dark:text-amber-400">"{tr.command}"</p>
                        {tr.skill_name && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Bot className="h-3 w-3" />→ {tr.skill_name}
                          </p>
                        )}
                        {tr.description && <p className="text-xs text-muted-foreground">{tr.description}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditTrigger(tr)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive"
                          onClick={async () => { if (await confirm({ title: 'ลบ Trigger', description: 'ลบ Trigger นี้?', variant: 'destructive' })) delTrigMut.mutate(tr.id, { onSuccess: () => toast({ title: 'ลบ Trigger แล้ว' }) }); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ SKILL DIALOG ══ */}
      <Dialog open={skillDialog} onOpenChange={open => { setSkillDialog(open); if (!open) setEditingSkill(null); }}>
        <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-violet-500" />
              {editingSkill ? 'แก้ไข Skill' : 'สร้าง Skill ใหม่'}
              <Badge variant="outline" className="ml-1 text-[10px]">
                {skillForm.content_type === 'article' ? '📄 บทความ' : '🎬 วีดิโอ'}
              </Badge>
            </DialogTitle>
            <DialogDescription>กำหนด System Prompt และขั้นตอนที่ AI จะทำงานสำหรับคอนเทนต์ประเภทนี้</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Template picker (create only) */}
            {!editingSkill && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />ใช้ Template มาตรฐาน
                </Label>
                <Select value={selectedTemplate} onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue placeholder="เลือก Template... (ไม่บังคับ)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— สร้างใหม่ทั้งหมด —</SelectItem>
                    {TEMPLATES[skillForm.content_type].map(tpl => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        <span className="font-medium">{tpl.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{tpl.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ชื่อ Skill <span className="text-destructive">*</span></Label>
                <Input value={skillForm.name} onChange={e => setSkillForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={skillForm.content_type === 'article' ? 'เช่น เขียนบทความ SEO' : 'เช่น สร้าง Script วีดิโอ'} />
              </div>
              <div className="space-y-1.5">
                <Label>คำอธิบาย</Label>
                <Input value={skillForm.description} onChange={e => setSkillForm(f => ({ ...f, description: e.target.value }))} placeholder="คำอธิบายสั้น..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>System Prompt</Label>
              <Textarea value={skillForm.system_prompt} onChange={e => setSkillForm(f => ({ ...f, system_prompt: e.target.value }))}
                placeholder={skillForm.content_type === 'article'
                  ? 'คุณเป็นนักเขียนบทความภาษาไทยมืออาชีพที่เชี่ยวชาญ SEO...'
                  : 'คุณเป็น Video Script Writer มืออาชีพสำหรับ YouTube และ Reels...'}
                className="min-h-[140px] text-sm font-mono" />
              <p className="text-[11px] text-muted-foreground">System Prompt นี้จะส่งให้ AI ก่อนทุก Request ที่ใช้ Skill นี้</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>ขั้นตอนการทำงาน (Steps)</Label>
                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addStep}>
                  <Plus className="h-3 w-3" />เพิ่ม Step
                </Button>
              </div>
              {skillForm.steps.map((step, i) => (
                <div key={i} className="flex gap-2 items-start p-3 bg-muted/40 rounded-lg">
                  <span className="text-xs font-mono text-muted-foreground mt-2.5 w-6 shrink-0">{i + 1}.</span>
                  <div className="flex-1 space-y-2">
                    <Input value={step.instruction} onChange={e => updateStep(i, 'instruction', e.target.value)} placeholder="คำสั่งสำหรับ Step นี้..." className="text-sm" />
                    <Select value={step.output_type} onValueChange={v => updateStep(i, 'output_type', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STEP_TYPE_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 mt-0.5 hover:text-destructive" onClick={() => removeStep(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {skillForm.steps.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                  ยังไม่มี Steps — เพิ่มเพื่อแบ่งงาน AI เป็นขั้นตอน
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkillDialog(false)}>ยกเลิก</Button>
            <Button disabled={saveSkillMut.isPending || !skillForm.name.trim()} onClick={handleSaveSkill}>
              {saveSkillMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังบันทึก...</> : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ TRIGGER DIALOG ══ */}
      <Dialog open={triggerDialog} onOpenChange={open => { setTriggerDialog(open); if (!open) setEditingTrig(null); }}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              {editingTrig ? 'แก้ไข Trigger' : 'สร้าง Trigger ใหม่'}
              <Badge variant="outline" className="ml-1 text-[10px]">
                {trigForm.content_type === 'article' ? '📄 บทความ' : '🎬 วีดิโอ'}
              </Badge>
            </DialogTitle>
            <DialogDescription>ตั้งคำสั่งสั้นและเชื่อมกับ Skill ที่ต้องการเรียกใช้</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Trigger Command <span className="text-destructive">*</span></Label>
              <Input value={trigForm.command} onChange={e => setTrigForm(f => ({ ...f, command: e.target.value }))}
                placeholder={trigForm.content_type === 'article' ? 'เช่น เขียนบทความ' : 'เช่น สร้าง Script'}
                className="font-mono" />
              <p className="text-[11px] text-muted-foreground">คำสั้น ๆ ที่ผู้ใช้พิมพ์เพื่อเรียก Workflow นี้</p>
            </div>
            <div className="space-y-1.5">
              <Label>เชื่อมกับ Skill</Label>
              <Select value={trigForm.skill_id} onValueChange={v => setTrigForm(f => ({ ...f, skill_id: v }))}>
                <SelectTrigger><SelectValue placeholder="เลือก Skill..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ไม่เชื่อม Skill —</SelectItem>
                  {typeSkills.map(sk => <SelectItem key={sk.id} value={sk.id}>{sk.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>คำอธิบาย</Label>
              <Input value={trigForm.description} onChange={e => setTrigForm(f => ({ ...f, description: e.target.value }))} placeholder="อธิบายว่า Trigger นี้ทำอะไร..." />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTriggerDialog(false)}>ยกเลิก</Button>
            <Button disabled={saveTrigMut.isPending || !trigForm.command.trim()} onClick={handleSaveTrigger}>
              {saveTrigMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังบันทึก...</> : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



