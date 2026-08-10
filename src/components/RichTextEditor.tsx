import { useRef, useCallback, useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import ImageExtension from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiUpload } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Table as TableIcon, Image as ImageIcon,
  Link, Code, Heading1, Heading2, Heading3, Quote, Undo, Redo,
  Loader2,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ticketId?: string;
  contractId?: string;
  className?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'พิมพ์เนื้อหา...',
  ticketId,
  contractId,
  className,
  minHeight = '200px',
}: RichTextEditorProps) {
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[var(--min-height)] p-3',
        style: `--min-height: ${minHeight}`,
      },
    },
    immediatelyRender: false,
  });

  // Sync external value changes into the editor (e.g. AI paste button)
  const lastValueRef = useRef(value);
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== lastValueRef.current) {
      editor.commands.setContent(value);
    }
    lastValueRef.current = value;
  }, [value, editor]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'กรุณาเลือกไฟล์รูปภาพ', variant: 'destructive' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'ไฟล์รูปภาพต้องไม่เกิน 20MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (ticketId) fd.append('ticket_id', ticketId);
      if (contractId) fd.append('contract_id', contractId);
      const res: any = await apiUpload('/support-upload.php', fd);
      const payload = res?.data ?? res;
      const url = payload?.file_path ? `/flowstack/${payload.file_path}` : payload?.url;
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    } catch (err: any) {
      toast({ title: 'อัปโหลดรูปล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }, [editor, ticketId, contractId, toast]);

  const addTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const addLink = useCallback(() => {
    const url = window.prompt('URL:');
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const btn = (action: () => void, active: boolean, icon: React.ReactNode, title: string) => (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="h-7 w-7"
      onClick={action}
      title={title}
    >
      {icon}
    </Button>
  );

  return (
    <div className={cn('rounded-lg border overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b bg-muted/30">
        {btn(() => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), <Bold className="h-3.5 w-3.5" />, 'ตัวหนา')}
        {btn(() => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), <Italic className="h-3.5 w-3.5" />, 'ตัวเอียง')}
        {btn(() => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), <UnderlineIcon className="h-3.5 w-3.5" />, 'ขีดเส้นใต้')}
        {btn(() => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), <Strikethrough className="h-3.5 w-3.5" />, 'ขีดฆ่า')}
        <div className="w-px h-6 bg-border mx-0.5 self-center" />
        {btn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), <Heading1 className="h-3.5 w-3.5" />, 'หัวข้อ 1')}
        {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), <Heading2 className="h-3.5 w-3.5" />, 'หัวข้อ 2')}
        {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), <Heading3 className="h-3.5 w-3.5" />, 'หัวข้อ 3')}
        <div className="w-px h-6 bg-border mx-0.5 self-center" />
        {btn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), <List className="h-3.5 w-3.5" />, 'รายการ')}
        {btn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), <ListOrdered className="h-3.5 w-3.5" />, 'ลำดับเลข')}
        {btn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), <Quote className="h-3.5 w-3.5" />, 'อ้างอิง')}
        {btn(() => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'), <Code className="h-3.5 w-3.5" />, 'โค้ด')}
        <div className="w-px h-6 bg-border mx-0.5 self-center" />
        {btn(addTable, editor.isActive('table'), <TableIcon className="h-3.5 w-3.5" />, 'ตาราง')}
        {btn(addLink, editor.isActive('link'), <Link className="h-3.5 w-3.5" />, 'ลิงก์')}
        {btn(() => imageInputRef.current?.click(), false, uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />, 'รูปภาพ')}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageUpload}
        />
        <div className="w-px h-6 bg-border mx-0.5 self-center" />
        {btn(() => editor.chain().focus().undo().run(), false, <Undo className="h-3.5 w-3.5" />, 'เลิกทำ')}
        {btn(() => editor.chain().focus().redo().run(), false, <Redo className="h-3.5 w-3.5" />, 'ทำซ้ำ')}
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} className="[&_.ProseMirror]:min-h-[var(--min-height)] [&_.ProseMirror]:outline-none [&_.ProseMirror]:p-3 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-muted/50 [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-md [&_.ProseMirror_img]:inline-block [&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:text-sm [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:text-sm [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-primary/30 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6" />
    </div>
  );
}
