import './ArticleEditor.css';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Paragraph from '@tiptap/extension-paragraph';

// Tiptap nodes/marks only keep attributes declared in their schema, so inline `style`
// is stripped on parse. The CTA button inserted by "แทรกปุ่มลิงก์ในอีเมล" relies on
// inline styles both on the <a> (button look) and the wrapping <p> (text-align:center).
// Without this, the sent email renders a plain, left-aligned link instead of a button.
const keepStyleAttribute = {
  style: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute('style'),
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes.style ? { style: attributes.style } : {},
  },
};

const StyledLink = Link.extend({
  addAttributes() {
    return { ...this.parent?.(), ...keepStyleAttribute };
  },
});

const StyledParagraph = Paragraph.extend({
  addAttributes() {
    return { ...this.parent?.(), ...keepStyleAttribute };
  },
});
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SeoFields, SeoChecklistResult, SeoRuleLevel, SeoRuleStatus } from '@/components/content/types';
import { SEO_GATE_LABEL } from '@/components/content/types';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, Quote, Code2,
  Table as TableIcon, Link as LinkIcon, Image as ImageIcon,
  Undo2, Redo2, Code, ChevronDown, Sparkles, Loader2,
  Search, AlignLeft, Plus, Eye, EyeOff, MousePointer,
  CheckCircle2, AlertTriangle, XCircle, MinusCircle, Clock, RefreshCw,
} from 'lucide-react';

export interface ArticleEditorProps {
  html: string;
  onChange: (html: string) => void;
  seoFields: SeoFields;
  onSeoChange: (fields: SeoFields) => void;
  contentItemId?: string;
  platform?: string;
  topic?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
  onTrackOpensChange?: (v: boolean) => void;
  onTrackClicksChange?: (v: boolean) => void;
}

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Sarabun (ไทย)', value: "'Sarabun', sans-serif" },
  { label: 'Noto Sans Thai', value: "'Noto Sans Thai', sans-serif" },
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'Monospace', value: 'ui-monospace, monospace' },
];

const AI_REWRITE_ACTIONS = [
  { label: 'ปรับปรุงภาษา', instruction: 'Improve the writing quality and clarity of this text, keeping the same language (Thai or English). Return only the improved text.' },
  { label: 'เขียนใหม่', instruction: 'Rewrite this text with fresh wording but the same meaning. Return only the rewritten text.' },
  { label: 'ย่อให้สั้นลง', instruction: 'Shorten this text to about half the length while preserving key points. Return only the shortened text.' },
  { label: 'ขยายให้ยาวขึ้น', instruction: 'Expand this text with more detail and examples. Return only the expanded text.' },
  { label: 'แปลเป็นอังกฤษ', instruction: 'Translate this text to English. Return only the translation.' },
];

export default function ArticleEditor({
  html, onChange, seoFields, onSeoChange, contentItemId, platform, topic,
  trackOpens, trackClicks, onTrackOpensChange, onTrackClicksChange,
}: ArticleEditorProps) {
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceHtml, setSourceHtml] = useState('');
  const [aiRewriting, setAiRewriting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [seoOpen, setSeoOpen] = useState(false);
  const [seoCheck, setSeoCheck] = useState<SeoChecklistResult | null>(null);
  const [seoCheckLoading, setSeoCheckLoading] = useState(false);
  const [seoCheckError, setSeoCheckError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [ctaOpen, setCtaOpen] = useState(false);
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaText, setCtaText] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false, paragraph: false }),
      StyledParagraph,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      StyledLink.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: 'เริ่มพิมพ์เนื้อหาบทความ...' }),
    ],
    content: html,
    onUpdate({ editor }) {
      // Defer to avoid setState-in-render warning from parent re-render
      requestAnimationFrame(() => onChange(editor.getHTML()));
    },
  });

  // Sync content when html prop changes externally (e.g. after AI generation)
  // Use setTimeout to avoid setState-in-render warning from editor.onUpdate → onChange → parent re-render
  const prevHtmlRef = useRef(html);
  useEffect(() => {
    if (editor && html !== prevHtmlRef.current && html !== editor.getHTML()) {
      const id = setTimeout(() => editor.commands.setContent(html, false), 0);
      return () => clearTimeout(id);
    }
    prevHtmlRef.current = html;
  }, [editor, html]);

  // ── SEO checklist (Phase 4 publish gate) ────────────────────────
  // ผลตรวจอ้างอิงเนื้อหาที่ "บันทึกล่าสุด" ใน content_items (ไม่ใช่สถานะที่ยัง
  // ไม่ได้บันทึกในตัวแก้ไข) จึงต้องบันทึกก่อนแล้วกด "ตรวจใหม่" เพื่ออัปเดต
  const runSeoCheck = useCallback(async () => {
    if (!contentItemId) return;
    setSeoCheckLoading(true);
    setSeoCheckError(null);
    try {
      const res = await apiFetch<SeoChecklistResult>(
        '/brand-content.php?action=seo-checklist&item_id=' + encodeURIComponent(contentItemId),
      );
      setSeoCheck(res);
    } catch {
      setSeoCheckError('ตรวจ SEO ไม่สำเร็จ — ลองใหม่อีกครั้ง');
      setSeoCheck(null);
    } finally {
      setSeoCheckLoading(false);
    }
  }, [contentItemId]);

  // ดึงผลตรวจอัตโนมัติเมื่อเปิดแผง SEO ครั้งแรก (มี id เท่านั้น)
  useEffect(() => {
    if (seoOpen && contentItemId && !seoCheck && !seoCheckLoading && !seoCheckError) {
      runSeoCheck();
    }
  }, [seoOpen, contentItemId, seoCheck, seoCheckLoading, seoCheckError, runSeoCheck]);

  // ── Source mode toggle ──────────────────────────────────────────
  const enterSourceMode = useCallback(() => {
    if (!editor) return;
    setSourceHtml(editor.getHTML());
    setSourceMode(true);
  }, [editor]);

  const exitSourceMode = useCallback(() => {
    if (!editor) return;
    editor.commands.setContent(sourceHtml, false);
    onChange(sourceHtml);
    setSourceMode(false);
  }, [editor, sourceHtml, onChange]);

  // ── AI Rewrite (bubble menu) ────────────────────────────────────
  const handleAiRewrite = useCallback(async (instruction: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    setAiRewriting(true);
    setAiError(null);
    try {
      const res: any = await apiFetch('/chat.php', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: `${instruction}\n\nText:\n${selectedText}` },
          ],
        }),
      });
      const result: string = res?.choices?.[0]?.message?.content
        ?? res?.message?.content ?? res?.content ?? '';
      if (result.trim()) {
        editor.chain().focus().deleteRange({ from, to }).insertContent(result.trim()).run();
        onChange(editor.getHTML());
      }
    } catch (err: any) {
      const msg = err?.message || '';
      setAiError(
        msg.includes('API key') ? 'ยังไม่ได้ตั้งค่า API Key — Admin > AI Settings'
        : 'AI ไม่สามารถใช้งานได้ชั่วคราว'
      );
    } finally {
      setAiRewriting(false);
    }
  }, [editor, onChange]);

  // ── AI Generate (append) ───────────────────────────────────────
  const handleAiGenerate = useCallback(async () => {
    if (!editor || !generatePrompt.trim()) return;
    const currentText = editor.getText().slice(0, 500);
    const contextHint = topic ? `บทความเรื่อง: "${topic}"\n` : '';
    const platformHint = platform ? `แพลตฟอร์ม: ${platform}\n` : '';

    setAiGenerating(true);
    setAiError(null);
    try {
      const res: any = await apiFetch('/chat.php', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `${contextHint}${platformHint}เนื้อหาที่มีอยู่ (ตัวอย่าง):\n${currentText}\n\nสร้างเนื้อหาเพิ่มเติมสำหรับ: ${generatePrompt.trim()}\nตอบเป็น HTML (ใช้ h2, p, ul, table ตามความเหมาะสม) ไม่ต้องมี markdown code block`
            },
          ],
        }),
      });
      const result: string = res?.choices?.[0]?.message?.content
        ?? res?.message?.content ?? res?.content ?? '';
      if (result.trim()) {
        const clean = result.replace(/```html?\n?/gi, '').replace(/```/g, '').trim();
        editor.chain().focus().insertContentAt(editor.state.doc.content.size, clean).run();
        onChange(editor.getHTML());
        setGeneratePrompt('');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      setAiError(
        msg.includes('API key') ? 'ยังไม่ได้ตั้งค่า API Key — Admin > AI Settings'
        : 'AI ไม่สามารถใช้งานได้ชั่วคราว'
      );
    } finally {
      setAiGenerating(false);
    }
  }, [editor, generatePrompt, onChange, topic, platform]);

  // ── Table helpers ───────────────────────────────────────────────
  const insertTable = () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  const addRowAfter = () => editor?.chain().focus().addRowAfter().run();
  const deleteRow   = () => editor?.chain().focus().deleteRow().run();
  const addColAfter = () => editor?.chain().focus().addColumnAfter().run();
  const deleteCol   = () => editor?.chain().focus().deleteColumn().run();
  const deleteTable = () => editor?.chain().focus().deleteTable().run();


  if (!editor) return null;

  return (
    <div className="border rounded-lg overflow-hidden flex flex-col">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 overflow-x-auto">
        {/* Headings */}
        <ToolBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1"><Heading1 className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2"><Heading2 className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3"><Heading3 className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={editor.isActive('heading', { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="H4"><Heading4 className="h-3.5 w-3.5" /></ToolBtn>

        <ToolSep />

        {/* Inline formatting */}
        <ToolBtn active={editor.isActive('bold')}          onClick={() => editor.chain().focus().toggleBold().run()}          title="Bold">        <Bold           className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={editor.isActive('italic')}        onClick={() => editor.chain().focus().toggleItalic().run()}        title="Italic">      <Italic         className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={editor.isActive('underline')}     onClick={() => editor.chain().focus().toggleUnderline().run()}     title="Underline">   <UnderlineIcon  className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={editor.isActive('strike')}        onClick={() => editor.chain().focus().toggleStrike().run()}        title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></ToolBtn>

        <ToolSep />

        {/* Font family */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 font-normal">
              <AlignLeft className="h-3.5 w-3.5" />ฟอนต์<ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="text-sm">
            {FONT_FAMILIES.map(f => (
              <DropdownMenuItem key={f.value} style={{ fontFamily: f.value || undefined }}
                onClick={() => f.value
                  ? editor.chain().focus().setFontFamily(f.value).run()
                  : editor.chain().focus().unsetFontFamily().run()
                }>
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Text color */}
        <div className="flex items-center gap-0.5">
          <label title="สีตัวอักษร" className="cursor-pointer h-7 w-7 flex items-center justify-center rounded hover:bg-accent">
            <span className="text-xs font-bold" style={{ color: editor.getAttributes('textStyle').color || 'inherit' }}>A</span>
            <input type="color" className="sr-only" onChange={e => editor.chain().focus().setColor(e.target.value).run()} />
          </label>
          <label title="Highlight" className="cursor-pointer h-7 w-7 flex items-center justify-center rounded hover:bg-accent">
            <span className="text-xs font-bold bg-yellow-300 px-0.5 rounded">H</span>
            <input type="color" className="sr-only" defaultValue="#fef08a"
              onChange={e => editor.chain().focus().setHighlight({ color: e.target.value }).run()} />
          </label>
        </div>

        <ToolSep />

        {/* Lists */}
        <ToolBtn active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}  title="Bullet List">  <List        className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered List"> <ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={editor.isActive('blockquote')}  onClick={() => editor.chain().focus().toggleBlockquote().run()}  title="Blockquote">   <Quote       className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={editor.isActive('codeBlock')}   onClick={() => editor.chain().focus().toggleCodeBlock().run()}   title="Code Block">   <Code2       className="h-3.5 w-3.5" /></ToolBtn>

        <ToolSep />

        {/* Table */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 font-normal">
              <TableIcon className="h-3.5 w-3.5" />ตาราง<ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={insertTable}>สร้างตาราง 3×3</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={addRowAfter}>เพิ่มแถว (ด้านล่าง)</DropdownMenuItem>
            <DropdownMenuItem onClick={deleteRow}>ลบแถวนี้</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={addColAfter}>เพิ่มคอลัมน์ (ขวา)</DropdownMenuItem>
            <DropdownMenuItem onClick={deleteCol}>ลบคอลัมน์นี้</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={deleteTable} className="text-destructive">ลบตาราง</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Link */}
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Link"
              className={cn(
                'h-7 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                platform === 'email' ? 'px-2 gap-1' : 'w-7',
                editor.isActive('link') && 'bg-accent text-foreground',
              )}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {platform === 'email' && <span className="text-xs hidden sm:inline">ใส่ลิงค์</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 flex gap-2" align="start">
            <Input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="h-7 text-xs flex-1"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (linkUrl) editor.chain().focus().setLink({ href: linkUrl }).run();
                  setLinkUrl('');
                  setLinkOpen(false);
                }
              }}
            />
            <Button size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => {
              if (linkUrl) editor.chain().focus().setLink({ href: linkUrl }).run();
              setLinkUrl('');
              setLinkOpen(false);
            }}>ยืนยัน</Button>
          </PopoverContent>
        </Popover>

        {/* Image */}
        <Popover open={imageOpen} onOpenChange={setImageOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Image"
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 flex gap-2" align="start">
            <Input
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="h-7 text-xs flex-1"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (imageUrl) editor.chain().focus().setImage({ src: imageUrl }).run();
                  setImageUrl('');
                  setImageOpen(false);
                }
              }}
            />
            <Button size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => {
              if (imageUrl) editor.chain().focus().setImage({ src: imageUrl }).run();
              setImageUrl('');
              setImageOpen(false);
            }}>ยืนยัน</Button>
          </PopoverContent>
        </Popover>

        <ToolSep />

        {/* Undo/Redo + Source */}
        <ToolBtn active={false} onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}><Undo2 className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={false} onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}><Redo2 className="h-3.5 w-3.5" /></ToolBtn>

        <ToolSep />
        <ToolBtn active={sourceMode} onClick={sourceMode ? exitSourceMode : enterSourceMode} title="HTML Source">
          <Code className="h-3.5 w-3.5" />
        </ToolBtn>

        {/* Email CTA block — only shown when platform=email */}
        {platform === 'email' && (
          <>
            <ToolSep />
            <Popover open={ctaOpen} onOpenChange={setCtaOpen}>
              <PopoverTrigger asChild>
                <button type="button" title="แทรกปุ่มลิงก์ในอีเมล"
                  className="h-7 px-2 flex items-center gap-1 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors whitespace-nowrap">
                  <MousePointer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">แทรกปุ่ม</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 space-y-3" align="start">
                <p className="text-xs font-semibold">แทรกปุ่มลิงก์ในอีเมล</p>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">ข้อความบนปุ่ม</label>
                  <Input
                    value={ctaText}
                    onChange={e => setCtaText(e.target.value)}
                    placeholder="เช่น อ่านต่อ, ดูโปรโมชัน, สมัครเลย"
                    className="h-7 text-xs"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">URL ปลายทาง</label>
                  <Input
                    value={ctaUrl}
                    onChange={e => setCtaUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-7 text-xs"
                    onKeyDown={e => {
                      if (e.key !== 'Enter' || !ctaUrl.trim()) return;
                      const label = ctaText.trim() || 'อ่านต่อ';
                      editor.chain().focus().insertContent(
                        `<p style="text-align:center;margin:24px 0;"><a href="${ctaUrl.trim()}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${label}</a></p>`
                      ).run();
                      setCtaUrl(''); setCtaText(''); setCtaOpen(false);
                    }}
                  />
                </div>
                <Button size="sm" className="w-full h-7 text-xs" disabled={!ctaUrl.trim()} onClick={() => {
                  if (!ctaUrl.trim()) return;
                  const label = ctaText.trim() || 'อ่านต่อ';
                  editor.chain().focus().insertContent(
                    `<p style="text-align:center;margin:24px 0;"><a href="${ctaUrl.trim()}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${label}</a></p>`
                  ).run();
                  setCtaUrl(''); setCtaText(''); setCtaOpen(false);
                }}>แทรกปุ่มในอีเมล</Button>
              </PopoverContent>
            </Popover>
          </>
        )}

        {/* Email tracking toggles — only shown when platform=email */}
        {platform === 'email' && onTrackOpensChange && onTrackClicksChange && (
          <>
            <ToolSep />
            <button
              type="button"
              title={trackOpens ? 'ติดตามการเปิดอ่าน: เปิด (คลิกเพื่อปิด)' : 'ติดตามการเปิดอ่าน: ปิด (คลิกเพื่อเปิด)'}
              onClick={() => onTrackOpensChange(!trackOpens)}
              className={cn(
                'h-7 px-1.5 flex items-center gap-1 rounded text-xs transition-colors',
                trackOpens
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {trackOpens ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">นับการเปิด</span>
            </button>
            <button
              type="button"
              title={trackClicks ? 'ติดตามการคลิกลิงก์: เปิด (คลิกเพื่อปิด)' : 'ติดตามการคลิกลิงก์: ปิด (คลิกเพื่อเปิด)'}
              onClick={() => onTrackClicksChange(!trackClicks)}
              className={cn(
                'h-7 px-1.5 flex items-center gap-1 rounded text-xs transition-colors',
                trackClicks
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <MousePointer className={cn('h-3.5 w-3.5', !trackClicks && 'opacity-40')} />
              <span className="hidden sm:inline">นับการคลิก</span>
            </button>
          </>
        )}
      </div>

      {/* ── Editor body ── */}
      {sourceMode ? (
        <Textarea
          value={sourceHtml}
          onChange={e => setSourceHtml(e.target.value)}
          className="font-mono text-xs resize-none border-0 rounded-none focus-visible:ring-0 min-h-[320px]"
          placeholder="<p>HTML ของบทความ...</p>"
        />
      ) : (
        <>
          {/* Bubble menu for AI rewrite */}
          <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
            <div className="flex items-center gap-1 bg-popover border rounded-lg shadow-lg px-2 py-1">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" disabled={aiRewriting}>
                    {aiRewriting ? <><Loader2 className="h-3 w-3 animate-spin" />AI...</> : <>AI เขียน<ChevronDown className="h-3 w-3" /></>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {AI_REWRITE_ACTIONS.map(a => (
                    <DropdownMenuItem key={a.label} onClick={() => handleAiRewrite(a.instruction)}>
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </BubbleMenu>
          <EditorContent editor={editor} className="article-editor-content flex-1" />
        </>
      )}

      {/* ── AI error ── */}
      {aiError && (
        <div className="px-4 py-2 text-xs text-destructive bg-destructive/5 border-t">
          {aiError}
        </div>
      )}

      {/* ── AI Generate panel ── */}
      <div className="border-t px-3 py-2.5 bg-muted/20">
        <div className="flex gap-2 items-center">
          <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            value={generatePrompt}
            onChange={e => setGeneratePrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiGenerate(); } }}
            placeholder="พิมพ์ prompt เพื่อให้ AI เพิ่มเนื้อหา เช่น 'เพิ่มส่วน FAQ 5 ข้อ'..."
            className="h-7 text-xs flex-1"
            disabled={aiGenerating}
          />
          <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1 shrink-0"
            onClick={handleAiGenerate} disabled={aiGenerating || !generatePrompt.trim()}>
            {aiGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {aiGenerating ? 'กำลังสร้าง...' : 'สร้างเนื้อหา'}
          </Button>
        </div>
      </div>

      {/* ── SEO Panel ── */}
      <div className="border-t">
        <button
          type="button"
          onClick={() => setSeoOpen(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">SEO / AEO Metadata</span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', seoOpen && 'rotate-180')} />
        </button>
        {seoOpen && (
          <div className="px-4 pb-4 pt-2 border-t space-y-3 bg-muted/10">
            {contentItemId && (
              <SeoChecklistPanel
                result={seoCheck}
                loading={seoCheckLoading}
                error={seoCheckError}
                onRecheck={runSeoCheck}
              />
            )}
            <SeoInput label="SEO Title" value={seoFields.seo_title}
              onChange={v => onSeoChange({ ...seoFields, seo_title: v })}
              placeholder="หัวข้อ SEO (แนะนำ ≤60 ตัวอักษร)"
              maxWarn={60} />
            <SeoInput label="Slug" value={seoFields.slug}
              onChange={v => onSeoChange({ ...seoFields, slug: v })}
              placeholder="url-slug-here" mono />
            <SeoTextarea label="Meta Description" value={seoFields.meta_description}
              onChange={v => onSeoChange({ ...seoFields, meta_description: v })}
              placeholder="คำอธิบายสำหรับ Google (แนะนำ ≤160 ตัวอักษร)"
              maxWarn={160} />
            <SeoInput label="Meta Keywords" value={seoFields.meta_keywords}
              onChange={v => onSeoChange({ ...seoFields, meta_keywords: v })}
              placeholder="keyword1, keyword2, keyword3" />
            <SeoInput label="OG Image URL" value={seoFields.og_image}
              onChange={v => onSeoChange({ ...seoFields, og_image: v })}
              placeholder="https://..." />
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Structured Data (JSON-LD)
              </Label>
              <Textarea
                value={seoFields.structured_data}
                onChange={e => onSeoChange({ ...seoFields, structured_data: e.target.value })}
                placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Article"\n}'}
                className="font-mono text-xs min-h-[100px] resize-y"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────

function ToolBtn({ children, active, onClick, title, disabled }: {
  children: React.ReactNode; active: boolean; onClick: () => void; title: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function ToolSep() {
  return <Separator orientation="vertical" className="h-5 mx-0.5" />;
}

function SeoInput({ label, value, onChange, placeholder, mono, maxWarn }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean; maxWarn?: number;
}) {
  const warn = !!maxWarn && value.length > maxWarn;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
        {maxWarn && <span className={cn('text-[10px]', warn ? 'text-destructive' : 'text-muted-foreground')}>{value.length}/{maxWarn}</span>}
      </div>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={cn('h-8 text-xs', mono && 'font-mono')} />
    </div>
  );
}

function SeoTextarea({ label, value, onChange, placeholder, maxWarn }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; maxWarn?: number;
}) {
  const warn = !!maxWarn && value.length > maxWarn;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
        {maxWarn && <span className={cn('text-[10px]', warn ? 'text-destructive' : 'text-muted-foreground')}>{value.length}/{maxWarn}</span>}
      </div>
      <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="text-xs min-h-[72px] resize-y" />
    </div>
  );
}

// ── SEO checklist panel ───────────────────────────────────────────
const SEO_LEVEL_META: Record<SeoRuleLevel, { icon: React.ElementType; className: string }> = {
  pass: { icon: CheckCircle2,  className: 'text-green-600' },
  warn: { icon: AlertTriangle, className: 'text-amber-500' },
  fail: { icon: XCircle,       className: 'text-destructive' },
  pending: { icon: Clock,      className: 'text-muted-foreground' },
  skip: { icon: MinusCircle,   className: 'text-muted-foreground/50' },
};

// status ใหม่ (pass/warning/failed/pending/skip) — map ไปใช้ icon ชุดเดิม
const SEO_STATUS_META: Record<SeoRuleStatus, { icon: React.ElementType; className: string }> = {
  pass: SEO_LEVEL_META.pass,
  warning: SEO_LEVEL_META.warn,
  failed: SEO_LEVEL_META.fail,
  pending: SEO_LEVEL_META.pending,
  skip: SEO_LEVEL_META.skip,
};

function seoScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-500';
  return 'text-destructive';
}

function SeoChecklistPanel({ result, loading, error, onRecheck }: {
  result: SeoChecklistResult | null;
  loading: boolean;
  error: string | null;
  onRecheck: () => void;
}) {
  const fails = result?.rules.filter(r => (r.status ?? r.level) === 'failed' || r.level === 'fail') ?? [];
  const gateOn = result?.seo_gate_enabled === 1;
  const gateMeta = result ? SEO_GATE_LABEL[result.gate] : undefined;
  return (
    <div className="rounded-md border bg-background/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            ตรวจ SEO
          </span>
          {result && (
            <span className={cn('text-sm font-bold leading-none', seoScoreColor(result.score))}>
              {result.score}
              <span className="text-[10px] font-normal text-muted-foreground">/100</span>
            </span>
          )}
          {result && gateMeta && (
            <span className={cn('text-[11px] font-medium leading-none', gateMeta.className)}>
              {gateMeta.label}
            </span>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs"
          onClick={onRecheck} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          ตรวจใหม่
        </Button>
      </div>

      {result && gateOn && (
        <div className={cn(
          'flex items-start gap-1.5 rounded px-2 py-1.5 text-[11px] leading-relaxed',
          result.gate === 'failed'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
        )}>
          {result.gate === 'failed' ? (
            <>
              <XCircle className="h-3.5 w-3.5 mt-px shrink-0" />
              <span>เกต SEO เปิดอยู่ — มีกฎไม่ผ่าน {fails.length} ข้อ จะเผยแพร่/อนุมัติไม่ได้จนกว่าจะแก้ครบ{result.seo_gate_min_score > 0 ? ` (คะแนนขั้นต่ำ ${result.seo_gate_min_score})` : ''}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 mt-px shrink-0" />
              <span>เกต SEO เปิดอยู่ — ผ่านเกณฑ์ที่บังคับทั้งหมด</span>
            </>
          )}
        </div>
      )}

      {loading && !result && (
        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังตรวจ...
        </div>
      )}
      {error && <div className="py-1 text-xs text-destructive">{error}</div>}

      {result && (
        <ul className="space-y-1">
          {result.rules.map(rule => {
            const status = (rule.status ?? rule.level) as SeoRuleStatus;
            const meta = SEO_STATUS_META[status] ?? SEO_LEVEL_META.pending;
            const Icon = meta.icon;
            const showScore = (status === 'pass' || status === 'warning' || status === 'failed') && rule.weight > 0;
            return (
              <li key={rule.key} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                <Icon className={cn('h-3.5 w-3.5 mt-px shrink-0', meta.className)} />
                <span className={cn(
                  (status === 'skip' || status === 'pending') && 'text-muted-foreground/70',
                )}>
                  {rule.message}
                  {showScore && (
                    <span className="ml-1 text-muted-foreground/70">
                      ({rule.score}/{rule.weight})
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {result && (
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
          * ผลตรวจอ้างอิงเนื้อหาที่บันทึกล่าสุด — บันทึกก่อนแล้วกด “ตรวจใหม่” เพื่ออัปเดต
        </p>
      )}
    </div>
  );
}
