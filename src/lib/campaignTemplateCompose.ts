import type { EmailTemplate } from '@/data/emailTemplates';

/**
 * ประกอบ HTML เต็มก้อนของแคมเปญจาก chrome ของ template (ตายตัว) + เนื้อหาที่ผู้ใช้แก้ไข
 * เป็น pure function — input เดียวกันได้ output เดียวกันเสมอ ใช้ทั้งตอน render
 * แท็บ "ตัวอย่าง" (ระหว่างแก้ไข ยังไม่บันทึก) และตอนบันทึกแคมเปญ เพื่อให้ผลลัพธ์ตรงกันเป๊ะ
 *
 * Chrome ไม่เคยผ่าน ArticleEditor เลย — ดึงจาก `template.html` สดๆ ทุกครั้ง
 * จึงไม่มีทางเสียหายจากข้อจำกัดของ TipTap schema (style/div/width ที่เคยหายมาก่อน)
 */
export function composeCampaignHtml(
  template: EmailTemplate,
  editableContent: string,
  ctaText?: string,
  ctaUrl?: string,
  discountPercent?: string,
  countdown?: string,
): string {
  let html = template.html.replace('{{EMAIL_CONTENT}}', editableContent);
  if (template.hasCta) {
    html = html
      .replace('{{CTA_TEXT}}', ctaText ?? template.defaultCtaText ?? '')
      .replace('{{CTA_URL}}', ctaUrl ?? template.defaultCtaUrl ?? '');
  }
  if (template.hasDiscountPromo) {
    html = html
      .replace('{{DISCOUNT_PERCENT}}', discountPercent ?? template.defaultDiscountPercent ?? '')
      .replace('{{COUNTDOWN}}', countdown ?? template.defaultCountdown ?? '');
  }
  return html;
}
