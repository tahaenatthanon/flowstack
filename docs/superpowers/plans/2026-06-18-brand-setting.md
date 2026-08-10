# Brand Setting Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างหน้า `/brand-setting` ใหม่ในกลุ่ม "การจัดการระบบ" ที่รวม Knowledge Base, Global Instruction field และ Product References fields ไว้ด้วยกัน เพื่อให้ระบบอื่น ๆ ใช้ข้อมูล Brand ร่วมกันได้

**Architecture:** แยก inner content ของ `KnowledgeBasePage` ออกเป็น `KnowledgeBaseContent` component, แยก Global Instruction และ Product Refs ออกจาก `AISettingsTab` เป็น `BrandInstructionForm` และ `BrandProductRefsForm` แล้วนำทั้ง 3 มาประกอบใน `BrandSettingPage` ใหม่ — API (`brand-content.php`, `knowledge-base.php`) ไม่เปลี่ยนเลย

**Tech Stack:** React 18, TypeScript, TanStack React Query, shadcn-ui, Tailwind CSS, PHP (auth.php สำหรับ menuKey)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/components/brand/KnowledgeBaseContent.tsx` | Inner KB CRUD (ไม่มี PageShell) |
| Create | `src/components/brand/BrandInstructionForm.tsx` | Global Instruction textarea + save |
| Create | `src/components/brand/BrandProductRefsForm.tsx` | Product refs list + upload + save |
| Create | `src/pages/BrandSettingPage.tsx` | หน้าหลัก 3 section |
| Modify | `src/pages/KnowledgeBasePage.tsx` | ใช้ `KnowledgeBaseContent` แทน inline code |
| Modify | `src/components/content/tabs/AISettingsTab.tsx` | ลบ Global Instruction + Product Refs sections, เพิ่ม link |
| Modify | `src/App.tsx` | เพิ่ม route `/brand-setting` |
| Modify | `src/components/AppSidebar.tsx` | เพิ่ม item "ตั้งค่าแบรนด์" |
| Modify | `api/auth.php` | เพิ่ม `brand_setting` ใน `ALL_MENU_KEYS` |

---

## Task 1: สร้าง KnowledgeBaseContent component

แยก inner content ออกจาก `KnowledgeBasePage` เพื่อ reuse ใน `BrandSettingPage` ได้

**Files:**
- Create: `src/components/brand/KnowledgeBaseContent.tsx`

- [ ] **Step 1: สร้างไฟล์ `src/components/brand/KnowledgeBaseContent.tsx`**

คัดลอก logic ทั้งหมดจาก `KnowledgeBasePage.tsx` ยกเว้น `PageShell` wrapper:

```tsx
import { BookOpen, Search, Plus, FileText, Star, Clock, Loader2, Trash2, Pencil, X, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';

const CATEGORIES = ['ทั้งหมด', 'บัญชีผู้ใช้', 'การตั้งค่าระบบ', 'การใช้งาน', 'ทั่วไป'];
const EMPTY_FORM = { title: '', content: '', category: 'ทั่วไป', is_starred: false };

export default function KnowledgeBaseContent() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ทั้งหมด');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: articles = [], isLoading } = useQuery<any[]>({
    queryKey: ['knowledge-base'],
    queryFn: () => apiFetch('/knowledge-base.php'),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof EMPTY_FORM) => apiFetch('/knowledge-base.php', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-base'] }); toast({ title: 'เพิ่มบทความแล้ว' }); setDialogOpen(false); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/knowledge-base.php?id=${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-base'] }); toast({ title: 'บันทึกแล้ว' }); setDialogOpen(false); setEditing(null); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/knowledge-base.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-base'] }); toast({ title: 'ลบบทความแล้ว' }); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const starMutation = useMutation({
    mutationFn: ({ id, is_starred }: { id: string; is_starred: boolean }) =>
      apiFetch(`/knowledge-base.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ is_starred }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-base'] }),
  });

  const filtered = useMemo(() => articles.filter((a: any) => {
    const matchSearch = a.title?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = category === 'ทั้งหมด' || a.category === category;
    return matchSearch && matchCat;
  }), [articles, search, category]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit   = (a: any) => { setEditing(a); setForm({ title: a.title, content: a.content ?? '', category: a.category, is_starred: !!a.is_starred }); setDialogOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, ...form });
    else createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />ฐานความรู้
        </h3>
        <Button size="sm" className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />เพิ่มบทความ</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">บทความทั้งหมด</p><p className="text-3xl font-bold text-primary">{articles.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">ยอดเข้าชมรวม</p><p className="text-3xl font-bold text-blue-500">{articles.reduce((s: number, a: any) => s + (a.views ?? 0), 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">บทความแนะนำ</p><p className="text-3xl font-bold text-amber-500">{articles.filter((a: any) => a.is_starred).length}</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาบทความ..." className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border divide-y">
          {filtered.map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors group">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.category}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => starMutation.mutate({ id: a.id, is_starred: !a.is_starred })}>
                  <Star className={`h-3.5 w-3.5 transition-colors ${a.is_starred ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40 hover:text-amber-400'}`} />
                </button>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{(a.views ?? 0).toLocaleString()} ครั้ง</span>
                <Badge variant="outline" className="text-xs">{a.category}</Badge>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100" onClick={() => openEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={async () => { if (await confirm({ title: 'ลบบทความ', description: 'ลบบทความนี้?', variant: 'destructive' })) deleteMutation.mutate(a.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>ไม่พบบทความ</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไขบทความ' : 'เพิ่มบทความใหม่'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>ชื่อบทความ <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="ชื่อบทความ..." />
            </div>
            <div className="space-y-1.5">
              <Label>หมวดหมู่</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter(c => c !== 'ทั้งหมด').map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>เนื้อหา</Label>
              <Textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} rows={5} placeholder="เนื้อหาบทความ..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/brand/KnowledgeBaseContent.tsx
git commit -m "feat(brand): extract KnowledgeBaseContent reusable component"
```

---

## Task 2: สร้าง BrandInstructionForm component

แยก Global Instruction section ออกจาก `AISettingsTab.tsx`

**Files:**
- Create: `src/components/brand/BrandInstructionForm.tsx`

- [ ] **Step 1: สร้างไฟล์ `src/components/brand/BrandInstructionForm.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Globe, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useContentGlobalSettings, useSaveGlobalSettings } from '@/hooks/useContent';

export default function BrandInstructionForm() {
  const { toast } = useToast();
  const { data: globalSettings } = useContentGlobalSettings();
  const [globalInstruction, setGlobalInstruction] = useState('');
  const saveMut = useSaveGlobalSettings();

  useEffect(() => {
    if (globalSettings) {
      setGlobalInstruction(globalSettings.global_instruction || '');
    }
  }, [globalSettings]);

  const handleSave = () => {
    saveMut.mutate({ global_instruction: globalInstruction }, {
      onSuccess: () => toast({ title: 'บันทึกแล้ว' }),
      onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-500" />คำสั่งหลัก (Global Instruction)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">คำสั่งระดับราก บังคับ AI ก่อนทุก Workflow — แก้ปัญหา AI หลุดกรอบหรือลืมอ่าน Guideline</p>
        <Textarea
          value={globalInstruction}
          onChange={e => setGlobalInstruction(e.target.value)}
          placeholder="เช่น: ก่อนทำงานทุกครั้ง ให้อ่าน brand.md และ claude.md ของโปรเจกต์ก่อนเสมอ จงปฏิบัติตามกฎ Do's & Don'ts อย่างเคร่งครัด อย่าเพิ่มเนื้อหาที่ไม่ได้อยู่ใน Brand Identity"
          className="min-h-[120px] text-sm"
        />
        <Button className="gap-2" disabled={saveMut.isPending} onClick={handleSave}>
          {saveMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังบันทึก...</> : <><Save className="h-4 w-4" />บันทึก</>}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/brand/BrandInstructionForm.tsx
git commit -m "feat(brand): extract BrandInstructionForm component"
```

---

## Task 3: สร้าง BrandProductRefsForm component

แยก Product References section ออกจาก `AISettingsTab.tsx`

**Files:**
- Create: `src/components/brand/BrandProductRefsForm.tsx`

- [ ] **Step 1: สร้างไฟล์ `src/components/brand/BrandProductRefsForm.tsx`**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Upload, X, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useContentGlobalSettings, useSaveGlobalSettings } from '@/hooks/useContent';
import { apiUpload, apiFetch } from '@/lib/api';

interface ProductRef { name: string; url: string; metadata?: Record<string, any> | null; analyzing?: boolean }

export default function BrandProductRefsForm() {
  const { toast } = useToast();
  const { data: globalSettings } = useContentGlobalSettings();
  const [productRefs, setProductRefs] = useState<ProductRef[]>([]);
  const [newRefName, setNewRefName] = useState('');
  const [newRefUrl, setNewRefUrl]   = useState('');
  const [uploadingRef, setUploadingRef] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const productRefsDirty = useRef(false);
  const saveMut = useSaveGlobalSettings();

  useEffect(() => {
    if (globalSettings && !productRefsDirty.current) {
      try {
        const refs = JSON.parse(globalSettings.product_refs || '[]');
        if (Array.isArray(refs) && refs.length > 0) { setProductRefs(refs); return; }
      } catch {}
      try {
        const urls = JSON.parse(globalSettings.product_ref_image_url || '[]');
        if (Array.isArray(urls) && urls.length > 0) {
          setProductRefs(urls.map((u: string, i: number) => ({ name: `สินค้า #${i + 1}`, url: u })));
          return;
        }
      } catch {}
      if (globalSettings.product_ref_image_url) {
        setProductRefs([{ name: 'สินค้า', url: globalSettings.product_ref_image_url }]);
      }
    }
  }, [globalSettings]);

  const analyzeProductImage = async (refIndex: number, imageUrl: string) => {
    try {
      const res: any = await apiFetch('/brand-content.php?action=analyze-product-image', {
        method: 'POST',
        body: JSON.stringify({ image_url: imageUrl }),
      });
      if (res?.metadata) {
        setProductRefs(prev => prev.map((r, i) => i === refIndex ? { ...r, metadata: res.metadata, analyzing: false } : r));
        toast({ title: 'วิเคราะห์รูปสินค้าสำเร็จ' });
      }
    } catch {
      setProductRefs(prev => prev.map((r, i) => i === refIndex ? { ...r, analyzing: false } : r));
    }
  };

  const addRef = () => {
    const name = newRefName.trim();
    const url  = newRefUrl.trim();
    if (!url) return;
    productRefsDirty.current = true;
    setProductRefs(prev => [...prev, { name: name || 'สินค้า', url }]);
    setNewRefName(''); setNewRefUrl('');
  };

  const removeRef = (index: number) => {
    productRefsDirty.current = true;
    setProductRefs(prev => prev.filter((_, i) => i !== index));
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingRef(true);
    let addedCount = 0;
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'product_ref');
        const res: any = await apiUpload('/support-upload.php', fd);
        const url = res?.data?.url ?? res?.url ?? '';
        if (url) {
          productRefsDirty.current = true;
          const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
          const idx = productRefs.length + addedCount;
          addedCount++;
          setProductRefs(prev => [...prev, { name: name || 'สินค้า', url, metadata: null, analyzing: true }]);
          analyzeProductImage(idx, url);
        }
      }
      toast({ title: 'อัพโหลดรูปสินค้าอ้างอิงแล้ว — กำลังวิเคราะห์ด้วย AI...' });
    } catch (err: any) {
      toast({ title: 'อัพโหลดไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingRef(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = () => {
    saveMut.mutate({
      product_ref_image_url: JSON.stringify(productRefs.map(r => r.url)),
      product_refs: JSON.stringify(productRefs),
    }, {
      onSuccess: () => { productRefsDirty.current = false; toast({ title: 'บันทึกแล้ว' }); },
      onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-500" />รูปสินค้าอ้างอิง (Product References)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">ระบุชื่อสินค้าและรูป — AI จะเลือกใช้เฉพาะรูปที่ตรงกับเนื้อหาคอนเทนต์นั้น ๆ โดยอัตโนมัติ</p>

        <div className="flex items-center gap-2">
          <Input value={newRefName} onChange={e => setNewRefName(e.target.value)} placeholder="ชื่อสินค้า" className="w-40 text-xs" />
          <Input value={newRefUrl} onChange={e => setNewRefUrl(e.target.value)} placeholder="https://... หรืออัพโหลด" className="flex-1 text-xs font-mono"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRef(); } }} />
          <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={addRef} disabled={!newRefUrl.trim()}>
            <Plus className="h-3.5 w-3.5" />เพิ่ม
          </Button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRefUpload} />
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" disabled={uploadingRef} onClick={() => fileRef.current?.click()}>
            {uploadingRef ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {productRefs.length > 0 && (
          <div className="space-y-2">
            {productRefs.map((ref, i) => (
              <div key={i} className="p-2.5 border rounded-lg bg-muted/30 group">
                <div className="flex items-center gap-2.5">
                  <div className="w-12 h-12 rounded-md overflow-hidden border bg-muted shrink-0 relative">
                    <img src={ref.url} alt={ref.name} className="w-full h-full object-cover" />
                    {ref.analyzing && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{ref.name}</span>
                      {ref.analyzing && <span className="text-[10px] text-muted-foreground animate-pulse">กำลังวิเคราะห์...</span>}
                    </div>
                    {ref.metadata && (
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {ref.metadata.product_type && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium">{ref.metadata.product_type}</span>
                        )}
                        {ref.metadata.primary_color && (
                          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-muted">
                            <span className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: ref.metadata.primary_color }} />
                            {ref.metadata.primary_color}
                          </span>
                        )}
                        {ref.metadata.mood && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">{ref.metadata.mood}</span>
                        )}
                        {ref.metadata.key_elements && (
                          <span className="text-[9px] text-muted-foreground truncate max-w-[200px]" title={ref.metadata.key_elements.join(', ')}>
                            {ref.metadata.key_elements.slice(0, 3).join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive" onClick={() => removeRef(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button className="gap-2" disabled={saveMut.isPending} onClick={handleSave}>
          {saveMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังบันทึก...</> : <><Save className="h-4 w-4" />บันทึกสินค้าอ้างอิง</>}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/brand/BrandProductRefsForm.tsx
git commit -m "feat(brand): extract BrandProductRefsForm component"
```

---

## Task 4: สร้าง BrandSettingPage

ประกอบ 3 component เข้าด้วยกันในหน้าใหม่

**Files:**
- Create: `src/pages/BrandSettingPage.tsx`

- [ ] **Step 1: สร้างไฟล์ `src/pages/BrandSettingPage.tsx`**

```tsx
import { Palette } from 'lucide-react';
import PageShell from '@/components/PageShell';
import KnowledgeBaseContent from '@/components/brand/KnowledgeBaseContent';
import BrandInstructionForm from '@/components/brand/BrandInstructionForm';
import BrandProductRefsForm from '@/components/brand/BrandProductRefsForm';

export default function BrandSettingPage() {
  return (
    <PageShell
      breadcrumbs={[{ label: 'การจัดการระบบ' }, { label: 'ตั้งค่าแบรนด์', isCurrent: true }]}
      title="ตั้งค่าแบรนด์"
      description="จัดการฐานความรู้ คำสั่งหลัก และสินค้าอ้างอิงสำหรับ AI ทั้งระบบ"
    >
      <div className="space-y-8 max-w-3xl">
        <KnowledgeBaseContent />
        <BrandInstructionForm />
        <BrandProductRefsForm />
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/BrandSettingPage.tsx
git commit -m "feat(brand): create BrandSettingPage with 3 sections"
```

---

## Task 5: เพิ่ม route, sidebar, และ menuKey

เชื่อมหน้าใหม่เข้ากับระบบ routing และ permission

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `api/auth.php`

- [ ] **Step 1: เพิ่ม lazy import และ route ใน `src/App.tsx`**

หา block imports ที่มี `const KnowledgeBasePage = lazy(...)` (บรรทัดประมาณ 38) แล้วเพิ่มบรรทัดใต้:

```tsx
const BrandSettingPage = lazy(() => import('./pages/BrandSettingPage'));
```

หา route `/knowledge-base` (บรรทัดประมาณ 151) แล้วเพิ่มด้านล่าง:

```tsx
<Route path="/brand-setting" element={<PermissionRoute menuKey="brand_setting"><BrandSettingPage /></PermissionRoute>} />
```

- [ ] **Step 2: เพิ่ม sidebar item ใน `src/components/AppSidebar.tsx`**

หา block `key: 'admin'` (บรรทัดประมาณ 104) แล้วเพิ่ม item ใน `items` array:

```tsx
{ title: 'ตั้งค่าแบรนด์', href: '/brand-setting', icon: Palette, menuKey: 'brand_setting' },
```

เพิ่ม `Palette` ใน import จาก `lucide-react` ที่บรรทัดบนสุดของไฟล์

- [ ] **Step 3: เพิ่ม `brand_setting` ใน `api/auth.php`**

หาบรรทัด 149:
```php
const ALL_MENU_KEYS = ['home','projects','sales','quotations','companies','revenue','resources','task_hours','reports','analytics','marketing','goals','automation','budget','support','admin','inbox','calendar','task_intelligence','workflow'];
```

แก้เป็น:
```php
const ALL_MENU_KEYS = ['home','projects','sales','quotations','companies','revenue','resources','task_hours','reports','analytics','marketing','goals','automation','budget','support','admin','inbox','calendar','task_intelligence','workflow','brand_setting'];
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/AppSidebar.tsx api/auth.php
git commit -m "feat(brand): add /brand-setting route, sidebar item, and menuKey"
```

---

## Task 6: อัปเดต KnowledgeBasePage ให้ใช้ KnowledgeBaseContent

**Files:**
- Modify: `src/pages/KnowledgeBasePage.tsx`

- [ ] **Step 1: แทนที่เนื้อหาทั้งหมดใน `src/pages/KnowledgeBasePage.tsx`**

```tsx
import PageShell from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import KnowledgeBaseContent from '@/components/brand/KnowledgeBaseContent';

export default function KnowledgeBasePage() {
  return (
    <PageShell
      breadcrumbs={[{ label: 'ศูนย์ช่วยเหลือ', href: '/support' }, { label: 'ฐานความรู้', isCurrent: true }]}
      title="ฐานความรู้"
      description="บทความและคู่มือการใช้งาน"
    >
      <KnowledgeBaseContent />
    </PageShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/KnowledgeBasePage.tsx
git commit -m "refactor: KnowledgeBasePage reuses KnowledgeBaseContent component"
```

---

## Task 7: ลบ Global Instruction และ Product Refs ออกจาก AISettingsTab

แทนด้วย link ไป `/brand-setting`

**Files:**
- Modify: `src/components/content/tabs/AISettingsTab.tsx`

- [ ] **Step 1: แก้ไข `AISettingsTab.tsx`**

ลบ state และ refs เหล่านี้ออก (บรรทัด 16-25):
- `interface ProductRef`, `globalInstruction`, `productRefs`, `newRefName`, `newRefUrl`, `uploadingRef`, `fileRef`, `productRefsDirty`

ลบ `useEffect` ที่โหลด `globalInstruction` และ `productRefs` (บรรทัด 26-48)

ลบ `saveMut`, `addRef`, `removeRef`, `analyzeProductImage`, `handleRefUpload`, `handleSave` functions (บรรทัด 49-125)

ลบ imports ที่ไม่ใช้แล้ว: `Save`, `Package`, `Plus`, `Upload`, `Globe` จาก lucide-react, และ `useSaveGlobalSettings` จาก hooks

ลบ Card blocks: `Global Instruction` (บรรทัด 198-214) และ `Product Reference Images` (บรรทัด 216-305) และ Save button (บรรทัด 307-309)

เพิ่ม note แทนที่ในตำแหน่งเดิม (ก่อน Card ช่องทางเผยแพร่):

```tsx
import { useNavigate } from 'react-router-dom';
// เพิ่มใน imports บน

// เพิ่ม hook ภายใน component
const navigate = useNavigate();
```

และ JSX:
```tsx
{/* ── Brand Settings Link ── */}
<div className="rounded-lg border border-dashed p-4 flex items-center justify-between gap-3">
  <div>
    <p className="text-sm font-medium">คำสั่งหลัก และสินค้าอ้างอิง</p>
    <p className="text-xs text-muted-foreground mt-0.5">จัดการ Global Instruction และ Product References ได้ที่ ตั้งค่าแบรนด์</p>
  </div>
  <Button variant="outline" size="sm" onClick={() => navigate('/brand-setting')}>
    ไปที่ตั้งค่าแบรนด์ →
  </Button>
</div>
```

- [ ] **Step 2: ตรวจสอบว่า AISettingsTab ยังมี imports ครบ (ไม่มี unused imports)**

รัน:
```bash
pnpm lint 2>&1 | grep AISettingsTab
```

ถ้ามี unused import ให้ลบออก

- [ ] **Step 3: Commit**

```bash
git add src/components/content/tabs/AISettingsTab.tsx
git commit -m "refactor(content): remove global instruction and product refs from AISettingsTab, add link to brand-setting"
```

---

## Task 8: Build และตรวจสอบ

- [ ] **Step 1: รัน lint**

```bash
pnpm lint
```

Expected: ไม่มี error (warning ได้)

- [ ] **Step 2: รัน build**

```bash
pnpm build
```

Expected: `dist/` สร้างสำเร็จ ไม่มี TypeScript error

- [ ] **Step 3: ทดสอบ manual**

1. เปิด `http://localhost:8080/#/brand-setting` → ต้องเห็นหน้า "ตั้งค่าแบรนด์" พร้อม 3 section
2. เพิ่ม/ลบ/แก้ไขบทความ KB → ต้องทำงานได้
3. แก้ Global Instruction กด "บันทึก" → ต้องบันทึกสำเร็จ toast ขึ้น
4. เพิ่ม product ref + อัพโหลด → ต้องทำงานได้
5. ไปที่ `/content` → tab settings → ต้องไม่เห็น Global Instruction และ Product Refs อีกต่อไป แต่เห็น link "ไปที่ตั้งค่าแบรนด์ →"
6. คลิก link → redirect ไป `/brand-setting` ถูกต้อง
7. `/knowledge-base` ยังโหลดได้ตามเดิม

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: brand-setting feature complete"
```
