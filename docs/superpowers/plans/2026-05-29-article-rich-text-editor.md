# Article Rich Text Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the read-only HTML preview in `ContentCardDialog` with a full Tiptap WYSIWYG editor supporting rich text, tables, fonts, SEO fields editing, and AI rewrite/generate.

**Architecture:** New `ArticleEditor.tsx` component wraps Tiptap with a custom toolbar, bubble menu for AI rewrite, append panel for AI generate, and an editable SEO panel. `ContentCardDialog` replaces its existing preview block with `<ArticleEditor>` and includes the editor HTML + SEO fields in its save payload.

**Tech Stack:** Tiptap v3 (already installed), `@tiptap/extension-text-style`, `@tiptap/extension-color`, `@tiptap/extension-highlight`, `@tiptap/extension-font-family`, `@tiptap/extension-character-count` (new installs), React 18, shadcn-ui, `/api/chat.php` for AI calls.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/content/types.ts` | Modify | Add `SeoFields` interface |
| `src/components/content/ArticleEditor.tsx` | **Create** | Full Tiptap editor: toolbar, bubble menu, AI generate panel, editable SEO panel |
| `src/components/content/ContentCardDialog.tsx` | Modify | Replace read-only preview with `<ArticleEditor>`, wire save to include HTML + SEO |
| `src/components/content/ArticleEditor.css` | **Create** | Tiptap prose styles (table borders, selection highlight) |
| `src/__tests__/content/ArticleEditor.test.tsx` | **Create** | Unit tests for ArticleEditor |

---

## Task 1: Install missing Tiptap extensions

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install packages**

```bash
cd C:/xampp/htdocs/flowstack
pnpm add @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-highlight @tiptap/extension-font-family @tiptap/extension-character-count
```

Expected: packages added, pnpm-lock.yaml updated, no peer-dep errors.

- [ ] **Step 2: Verify installation**

```bash
grep -E "text-style|color|highlight|font-family|character-count" package.json
```

Expected: all 5 packages present with `^3.x.x` version.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(content): install tiptap color/font/highlight extensions"
```

---

## Task 2: Add SeoFields type

**Files:**
- Modify: `src/components/content/types.ts`

- [ ] **Step 1: Add interface after `ArticleContent`**

Open `src/components/content/types.ts` and add after the `ArticleContent` interface (around line 164):

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/xampp/htdocs/flowstack && pnpm build 2>&1 | tail -5
```

Expected: build succeeds (0 errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/content/types.ts
git commit -m "feat(content): add SeoFields type"
```

---

## Task 3: Create ArticleEditor CSS

**Files:**
- Create: `src/components/content/ArticleEditor.css`

- [ ] **Step 1: Create the CSS file**

Create `src/components/content/ArticleEditor.css`:

```css
/* Tiptap editor container */
.article-editor-content {
  outline: none;
  min-height: 320px;
  padding: 1rem;
  font-size: 0.9375rem;
  line-height: 1.75;
}

/* Prose typography */
.article-editor-content h1 { font-size: 1.75rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
.article-editor-content h2 { font-size: 1.375rem; font-weight: 700; margin: 1rem 0 0.5rem; }
.article-editor-content h3 { font-size: 1.125rem; font-weight: 600; margin: 0.875rem 0 0.375rem; }
.article-editor-content h4 { font-size: 1rem;     font-weight: 600; margin: 0.75rem 0 0.25rem; }
.article-editor-content p  { margin: 0.5rem 0; }
.article-editor-content ul { list-style: disc;    padding-left: 1.5rem; margin: 0.5rem 0; }
.article-editor-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
.article-editor-content blockquote {
  border-left: 3px solid hsl(var(--border));
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: hsl(var(--muted-foreground));
  font-style: italic;
}
.article-editor-content pre {
  background: hsl(var(--muted));
  border-radius: 0.375rem;
  padding: 0.75rem 1rem;
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
  overflow-x: auto;
  margin: 0.75rem 0;
}
.article-editor-content code {
  background: hsl(var(--muted));
  border-radius: 0.25rem;
  padding: 0.125rem 0.375rem;
  font-family: ui-monospace, monospace;
  font-size: 0.875em;
}
.article-editor-content a { color: hsl(var(--primary)); text-decoration: underline; }

/* Table */
.article-editor-content table {
  width: 100%; border-collapse: collapse; margin: 0.75rem 0;
}
.article-editor-content th,
.article-editor-content td {
  border: 1px solid hsl(var(--border));
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.article-editor-content th {
  background: hsl(var(--muted));
  font-weight: 600;
}
.article-editor-content .selectedCell {
  background: hsl(var(--primary) / 0.08);
}

/* Placeholder */
.article-editor-content p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: hsl(var(--muted-foreground));
  pointer-events: none;
  float: left;
  height: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/content/ArticleEditor.css
git commit -m "feat(content): add ArticleEditor styles"
```

---

## Task 4: Create ArticleEditor component (core + toolbar)

**Files:**
- Create: `src/components/content/ArticleEditor.tsx`

This task builds the editor shell, toolbar, and HTML source toggle. AI and SEO panels come in later tasks.

- [ ] **Step 1: Create ArticleEditor.tsx**

Create `src/components/content/ArticleEditor.tsx`:

```tsx
import './ArticleEditor.css';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { SeoFields } from '@/components/content/types';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, Quote, Code2,
  Table as TableIcon, Link as LinkIcon, Image as ImageIcon,
  Undo2, Redo2, Code, ChevronDown, Sparkles, Loader2,
  Search, AlignLeft, Plus,
} from 'lucide-react';

export interface ArticleEditorProps {
  html: string;
  onChange: (html: string) => void;
  seoFields: SeoFields;
  onSeoChange: (fields: SeoFields) => void;
  contentItemId?: string;
  platform?: string;
  topic?: string;
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
}: ArticleEditorProps) {
  const { toast } = useToast();
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceHtml, setSourceHtml] = useState('');
  const [aiRewriting, setAiRewriting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [seoOpen, setSeoOpen] = useState(false);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: 'เริ่มพิมพ์เนื้อหาบทความ...' }),
    ],
    content: html,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Keep editorRef in sync for bubble-menu handler closures
  (editorRef as any).current = editor;

  // Sync incoming html prop only on first mount (controlled externally via ContentCardDialog)
  useEffect(() => {
    if (editor && html && editor.isEmpty) {
      editor.commands.setContent(html, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

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
    const ed = (editorRef as any).current;
    if (!ed) return;
    const { from, to } = ed.state.selection;
    if (from === to) return;
    const selectedText = ed.state.doc.textBetween(from, to, ' ');
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
        ed.chain().focus().deleteRange({ from, to }).insertContent(result.trim()).run();
        onChange(ed.getHTML());
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
  }, [onChange]);

  // ── AI Generate (append) ───────────────────────────────────────
  const handleAiGenerate = useCallback(async () => {
    const ed = (editorRef as any).current;
    if (!ed || !generatePrompt.trim()) return;
    const currentText = ed.getText().slice(0, 500);
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
        ed.chain().focus().insertContentAt(ed.state.doc.content.size, clean).run();
        onChange(ed.getHTML());
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
  }, [generatePrompt, onChange, topic, platform]);

  // ── Table helpers ───────────────────────────────────────────────
  const insertTable = () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  const addRowAfter = () => editor?.chain().focus().addRowAfter().run();
  const deleteRow   = () => editor?.chain().focus().deleteRow().run();
  const addColAfter = () => editor?.chain().focus().addColumnAfter().run();
  const deleteCol   = () => editor?.chain().focus().deleteColumn().run();
  const deleteTable = () => editor?.chain().focus().deleteTable().run();

  // ── Link helper ─────────────────────────────────────────────────
  const setLink = () => {
    const url = window.prompt('URL:');
    if (!url) return;
    editor?.chain().focus().setLink({ href: url }).run();
  };

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

        {/* Link + Image */}
        <ToolBtn active={editor.isActive('link')} onClick={setLink} title="Link"><LinkIcon className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={false} title="Image" onClick={() => {
          const url = window.prompt('Image URL:');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}><ImageIcon className="h-3.5 w-3.5" /></ToolBtn>

        <ToolSep />

        {/* Undo/Redo + Source */}
        <ToolBtn active={false} onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}><Undo2 className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn active={false} onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}><Redo2 className="h-3.5 w-3.5" /></ToolBtn>

        <ToolSep />
        <ToolBtn active={sourceMode} onClick={sourceMode ? exitSourceMode : enterSourceMode} title="HTML Source">
          <Code className="h-3.5 w-3.5" />
        </ToolBtn>
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
  const warn = maxWarn && value.length > maxWarn;
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
  const warn = maxWarn && value.length > maxWarn;
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:/xampp/htdocs/flowstack && pnpm build 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/content/ArticleEditor.tsx
git commit -m "feat(content): add ArticleEditor component with Tiptap, toolbar, AI, SEO panel"
```

---

## Task 5: Wire ArticleEditor into ContentCardDialog

**Files:**
- Modify: `src/components/content/ContentCardDialog.tsx`

- [ ] **Step 1: Add state + import at top of ContentCardDialog.tsx**

Add to the existing imports at the top of the file:

```tsx
import ArticleEditor from '@/components/content/ArticleEditor';
import type { SeoFields } from '@/components/content/types';
import { emptySeoFields } from '@/components/content/types';
```

Add to the component state (inside `ContentCardDialog`, alongside existing `useState` calls):

```tsx
const [articleHtml, setArticleHtml] = useState('');
const [seoFields, setSeoFields] = useState<SeoFields>(emptySeoFields());
```

- [ ] **Step 2: Populate state from existingItem in the useEffect**

Inside the existing `useEffect` block (around line 78), add after `setImageBrief`:

```tsx
// Populate article HTML + SEO from article_content JSON
if (existingItem?.article_content) {
  try {
    const art = JSON.parse(existingItem.article_content);
    setArticleHtml(art.html || '');
    setSeoFields({
      seo_title:        art.seo_title        || '',
      slug:             art.slug             || '',
      meta_description: art.meta_description || '',
      meta_keywords:    art.meta_keywords    || '',
      og_image:         art.og_image         || '',
      structured_data:  art.structured_data
        ? (typeof art.structured_data === 'string'
            ? art.structured_data
            : JSON.stringify(art.structured_data, null, 2))
        : '',
    });
  } catch {
    setArticleHtml('');
    setSeoFields(emptySeoFields());
  }
} else {
  setArticleHtml('');
  setSeoFields(emptySeoFields());
}
```

- [ ] **Step 3: Replace read-only preview block with ArticleEditor**

Find and remove the block starting with `{/* ===== Article HTML Preview ===== */}` (lines ~179–199) and the block `{/* ===== SEO / AEO Metadata ===== */}` (lines ~201–239). Replace both with:

```tsx
{/* ===== Article Editor ===== */}
{hasArticle || existingItem ? (
  <div className="px-6 py-5 border-b">
    <div className="flex items-center gap-2 mb-3">
      <FileText className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold">เนื้อหาบทความ</h3>
    </div>
    <ArticleEditor
      html={articleHtml}
      onChange={setArticleHtml}
      seoFields={seoFields}
      onSeoChange={setSeoFields}
      contentItemId={existingItem?.id}
      platform={platform === '__none__' ? undefined : platform}
      topic={topic}
    />
  </div>
) : null}
```

- [ ] **Step 4: Include articleHtml + seoFields in handleSave**

Find `handleSave` (around line 106). Modify it to build the updated `article_content` JSON:

```tsx
const handleSave = async () => {
  if (!topic.trim()) return;
  setSaving(true);
  try {
    // Merge updated html + seo back into article_content JSON
    let updatedArticleContent: string | undefined;
    if (existingItem?.article_content || articleHtml) {
      let art: Record<string, any> = {};
      if (existingItem?.article_content) {
        try { art = JSON.parse(existingItem.article_content); } catch { /* ignore */ }
      }
      // Parse structured_data back to object if valid JSON
      let parsedSd: any = undefined;
      if (seoFields.structured_data.trim()) {
        try { parsedSd = JSON.parse(seoFields.structured_data); } catch { parsedSd = seoFields.structured_data; }
      }
      art = {
        ...art,
        html:             articleHtml,
        seo_title:        seoFields.seo_title        || undefined,
        slug:             seoFields.slug             || undefined,
        meta_description: seoFields.meta_description || undefined,
        meta_keywords:    seoFields.meta_keywords    || undefined,
        og_image:         seoFields.og_image         || undefined,
        structured_data:  parsedSd                  ?? undefined,
      };
      updatedArticleContent = JSON.stringify(art);
    }

    await onSave({
      topic: topic.trim(),
      caption,
      platform: platform === '__none__' ? 'facebook' : platform,
      scheduled_date: scheduledDate || new Date().toISOString().split('T')[0],
      image_brief: imageBrief.trim(),
      ...(updatedArticleContent !== undefined && { article_content: updatedArticleContent }),
    });
    onOpenChange(false);
  } finally {
    setSaving(false);
  }
};
```

- [ ] **Step 5: Update Props interface to accept article_content in onSave**

Find the `Props` interface (around line 17) and update `onSave`:

```tsx
onSave: (data: {
  topic: string;
  caption: string;
  platform: string;
  scheduled_date: string;
  image_brief?: string;
  article_content?: string;
}) => Promise<void>;
```

- [ ] **Step 6: Update call sites of onSave to handle article_content**

In `ContentDetailView.tsx` (the `handleEditSave` function around line 77), pass `article_content` through to the API:

```tsx
const handleEditSave = async (data: {
  topic: string; caption: string; platform: string;
  scheduled_date: string; image_brief?: string; article_content?: string;
}) => {
  await apiFetch(`/content-items.php?id=${item.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: data.topic,
      caption: data.caption,
      platform: data.platform,
      scheduled_date: data.scheduled_date || null,
      image_brief: data.image_brief || '',
      ...(data.article_content !== undefined && { article_content: data.article_content }),
    }),
  });
  qc.invalidateQueries({ queryKey: ['content', 'items'] });
  qc.invalidateQueries({ queryKey: ['content', 'plans'] });
  toast({ title: 'อัพเดทคอนเทนต์แล้ว' });
};
```

- [ ] **Step 7: Verify build passes**

```bash
cd C:/xampp/htdocs/flowstack && pnpm build 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/content/ContentCardDialog.tsx src/components/content/views/ContentDetailView.tsx
git commit -m "feat(content): wire ArticleEditor into ContentCardDialog with save"
```

---

## Task 6: Verify content-items.php accepts article_content

**Files:**
- Read: `api/content-items.php`

- [ ] **Step 1: Check that PUT handler accepts article_content**

```bash
grep -n "article_content" C:/xampp/htdocs/flowstack/api/content-items.php | head -20
```

Expected: `article_content` is in the PUT update block. If it is present, skip to Step 3.

- [ ] **Step 2: If missing — add article_content to PUT handler**

Find the PUT section in `api/content-items.php`. Add `article_content` to the allowed update fields:

```php
// In the PUT section, inside the allowed fields array:
if (isset($body['article_content'])) {
    $fields[] = 'article_content = ?';
    $params[] = $body['article_content'];
}
```

- [ ] **Step 3: Test the API manually**

```bash
# Check current table column exists
mysql -u root flowstack -e "SHOW COLUMNS FROM content_items LIKE 'article_content';"
```

Expected: column exists with `text` or `longtext` type.

- [ ] **Step 4: Commit if modified**

```bash
git add api/content-items.php
git commit -m "fix(api): ensure content-items PUT accepts article_content"
```

---

## Task 7: Write tests for ArticleEditor

**Files:**
- Create: `src/__tests__/content/ArticleEditor.test.tsx`

- [ ] **Step 1: Create test file**

Create `src/__tests__/content/ArticleEditor.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ArticleEditor from '@/components/content/ArticleEditor';
import { emptySeoFields } from '@/components/content/types';

// Tiptap uses document APIs — jsdom supports them
// Mock apiFetch for AI tests
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const defaultProps = {
  html: '<p>Hello world</p>',
  onChange: vi.fn(),
  seoFields: emptySeoFields(),
  onSeoChange: vi.fn(),
};

describe('ArticleEditor', () => {
  it('renders editor with initial content', () => {
    render(<ArticleEditor {...defaultProps} />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('shows toolbar buttons', () => {
    render(<ArticleEditor {...defaultProps} />);
    expect(screen.getByTitle('Bold')).toBeTruthy();
    expect(screen.getByTitle('Italic')).toBeTruthy();
    expect(screen.getByTitle('H1')).toBeTruthy();
    expect(screen.getByTitle('HTML Source')).toBeTruthy();
  });

  it('toggles to HTML source mode', async () => {
    render(<ArticleEditor {...defaultProps} />);
    fireEvent.click(screen.getByTitle('HTML Source'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('<p>HTML ของบทความ...</p>')).toBeTruthy();
    });
  });

  it('renders AI generate panel with input and button', () => {
    render(<ArticleEditor {...defaultProps} />);
    expect(screen.getByPlaceholderText(/พิมพ์ prompt/)).toBeTruthy();
    expect(screen.getByText('สร้างเนื้อหา')).toBeTruthy();
  });

  it('AI generate button is disabled when prompt is empty', () => {
    render(<ArticleEditor {...defaultProps} />);
    const btn = screen.getByText('สร้างเนื้อหา').closest('button');
    expect(btn).toHaveProperty('disabled', true);
  });

  it('toggles SEO panel open', async () => {
    render(<ArticleEditor {...defaultProps} />);
    fireEvent.click(screen.getByText('SEO / AEO Metadata'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/หัวข้อ SEO/)).toBeTruthy();
    });
  });

  it('calls onSeoChange when SEO title is updated', async () => {
    const onSeoChange = vi.fn();
    render(<ArticleEditor {...defaultProps} onSeoChange={onSeoChange} />);
    fireEvent.click(screen.getByText('SEO / AEO Metadata'));
    await waitFor(() => screen.getByPlaceholderText(/หัวข้อ SEO/));
    fireEvent.change(screen.getByPlaceholderText(/หัวข้อ SEO/), { target: { value: 'My SEO Title' } });
    expect(onSeoChange).toHaveBeenCalledWith(expect.objectContaining({ seo_title: 'My SEO Title' }));
  });

  it('shows char counter warning when SEO title exceeds 60 chars', async () => {
    const longTitle = 'A'.repeat(65);
    render(<ArticleEditor {...defaultProps} seoFields={{ ...emptySeoFields(), seo_title: longTitle }} />);
    fireEvent.click(screen.getByText('SEO / AEO Metadata'));
    await waitFor(() => {
      expect(screen.getByText('65/60')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd C:/xampp/htdocs/flowstack && pnpm test 2>&1 | grep -E "PASS|FAIL|ArticleEditor"
```

Expected: `ArticleEditor.test.tsx` PASS, all tests green.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/content/ArticleEditor.test.tsx
git commit -m "test(content): add ArticleEditor unit tests"
```

---

## Task 8: Final lint + build check

- [ ] **Step 1: Run lint**

```bash
cd C:/xampp/htdocs/flowstack && pnpm lint 2>&1 | grep -E "error|Error" | grep -v "warning"
```

Expected: 0 errors (pre-existing warnings are OK).

- [ ] **Step 2: Run full test suite**

```bash
cd C:/xampp/htdocs/flowstack && pnpm test 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 3: Build production bundle**

```bash
cd C:/xampp/htdocs/flowstack && pnpm build 2>&1 | tail -5
```

Expected: `built in Xs` with 0 errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(content): complete article rich text editor with Tiptap, AI rewrite/generate, SEO panel"
```
