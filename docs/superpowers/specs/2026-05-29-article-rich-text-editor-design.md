# Article Rich Text Editor — Design Spec
**Date:** 2026-05-29  
**Scope:** `ContentCardDialog` → replace read-only HTML preview with Tiptap WYSIWYG editor

---

## Problem

`article_content.html` is currently rendered as a read-only DOMPurify preview inside `ContentCardDialog`. Users cannot edit the HTML body of an article after AI generates it. The only editable fields are `topic`, `caption`, `platform`, `scheduled_date`, and `image_brief`.

## Goal

Allow users to directly edit the article HTML body using a full-featured WYSIWYG editor supporting:
- Rich text formatting (bold, italic, underline, font, color, tables)
- HTML source view toggle
- SEO/AEO metadata editing
- AI rewrite (selection-based) and AI generate (append) features

---

## Architecture

### New Component: `src/components/content/ArticleEditor.tsx`

A self-contained Tiptap editor with toolbar, AI panel, and SEO fields. Exported as a controlled component:

```tsx
interface ArticleEditorProps {
  html: string;                          // initial HTML content
  onChange: (html: string) => void;      // called on every content change
  seoFields: SeoFields;
  onSeoChange: (fields: SeoFields) => void;
  contentItemId?: string;                // for AI context
  platform?: string;
  topic?: string;
}
```

### Modified: `src/components/content/ContentCardDialog.tsx`

Replace the existing read-only preview block (lines ~180–199) with `<ArticleEditor>`. Wire `onChange` to local state, include SEO fields in the save payload.

### Types: `src/components/content/types.ts`

Add `SeoFields` interface (no schema change — these fields already exist in `ArticleContent`).

---

## Tiptap Extensions

Install via pnpm:

```
@tiptap/react @tiptap/pm @tiptap/starter-kit
@tiptap/extension-underline
@tiptap/extension-text-style @tiptap/extension-color
@tiptap/extension-highlight
@tiptap/extension-font-family
@tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-header @tiptap/extension-table-cell
@tiptap/extension-link
@tiptap/extension-image
@tiptap/extension-placeholder
@tiptap/extension-character-count
```

No paid/Pro extensions. All MIT-licensed.

---

## Toolbar Layout

```
[H1][H2][H3] | [B][I][U][S] | [Font▼][Size▼] | [Color●][Highlight●] |
[Link][Image] | [Table▼] | [• List][1. List][Quote][Code] | [HTML⟨/⟩] | [Undo][Redo]
```

Table dropdown: Insert Table / Add Row / Delete Row / Add Column / Delete Column / Delete Table

HTML source view: toggle between Tiptap editor and a `<textarea>` showing raw HTML. Synced bidirectionally.

---

## Data Flow

### Load
```
existingItem.article_content (JSON string)
  → JSON.parse() → ArticleContent
  → art.html → TiptapEditor initial content
  → art.seo_title, art.slug, etc. → SEO panel inputs
```

### Save
```
editor.getHTML() → newHtml
seoFields state → newSeo
JSON.parse(existingItem.article_content) → existing ArticleContent
{ ...existing, html: newHtml, ...newSeo } → JSON.stringify()
PUT /content-items.php?id={id} { article_content: "..." }
```

Save is triggered by the existing "บันทึก" footer button — no separate save for editor.

---

## SEO Panel (Editable)

Below the editor, collapsed by default (expand on click):

| Field | Widget | Constraint |
|---|---|---|
| SEO Title | Input | char counter, warn >60 |
| Slug | Input mono | auto-generate from topic if empty |
| Meta Description | Textarea | char counter, warn >160 |
| Meta Keywords | Input | comma-separated |
| OG Image URL | Input | optional |
| Structured Data (JSON-LD) | Textarea mono | JSON validate on blur |

---

## AI Features

### AI Rewrite (Bubble Menu — selection-based)

1. User selects text in editor
2. Tiptap BubbleMenu appears with AI button
3. Dropdown actions: ปรับปรุง / เขียนใหม่ / ย่อ / ขยาย / แปลเป็นอังกฤษ
4. POST `/chat.php` with:
   ```json
   { "messages": [{ "role": "user", "content": "<action>: <selected_text>" }],
     "model": "<ai_default_model_id>" }
   ```
5. Replace selection with streamed/returned HTML

### AI Generate (Footer Panel — append)

1. Fixed panel at bottom of editor: prompt input + "สร้างเนื้อหาเพิ่ม" button
2. On submit: POST `/chat.php` with prompt + article context (first 500 chars of current HTML stripped)
3. Append returned HTML to editor content via `editor.commands.insertContentAt(editor.state.doc.content.size, html)`

Both AI calls use the same `resolveKiloCredentials` path on the backend. If no API key, show inline error (not toast).

---

## Out of Scope

- Real-time collaboration
- Image upload (existing `image_brief` + AI gen path unchanged)
- Video editing
- Caption field rich text (remains plain Textarea)
- ContentPlannerPage editor (different flow, separate task)

---

## Files Changed

| File | Change |
|---|---|
| `src/components/content/ArticleEditor.tsx` | **New** — Tiptap editor + toolbar + AI panel + SEO panel |
| `src/components/content/ContentCardDialog.tsx` | Replace read-only preview with `<ArticleEditor>`, wire save |
| `src/components/content/types.ts` | Add `SeoFields` interface |
| `package.json` / `pnpm-lock.yaml` | Add Tiptap packages |
