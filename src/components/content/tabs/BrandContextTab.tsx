import { Loader2, Upload, Plus, FileText, BookOpen, ListChecks, Bot, Zap, Sparkles, Info, Pencil, Trash2, X, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUpload } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { useBrandContexts, useSaveBrandContext, useDeleteBrandContext } from '@/hooks/useContent';
import type { BrandContext } from '@/components/content/types';
import { FILE_TYPE_MAP } from '@/components/content/types';
import { cn } from '@/lib/utils';

export default function BrandContextTab() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<BrandContext | null>(null);
  const [form, setForm]             = useState({ name: '', file_type: 'brand_md', content: '' });

  const fileInputRef              = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [savingPkg, setSavingPkg] = useState(false);
  const [briefPkg, setBriefPkg]   = useState<{
    brand_md: string; brand_md_name: string;
    sop_md: string;   sop_md_name: string;
    skills:   Array<{ name: string; description: string; system_prompt: string; steps: Array<{ instruction: string; output_type: string }> }>;
    triggers: Array<{ command: string; description: string; skill_index: number }>;
    ai_used: boolean;
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const raw = await apiUpload<any>('/brand-content.php?action=convert-brief', fd);
      const res = raw?.data ?? raw;
      const base = res.source_name ?? file.name.replace(/\.[^.]+$/, '');
      setBriefPkg({
        brand_md:      res.brand_md  ?? '',
        brand_md_name: base + ' — brand.md',
        sop_md:        res.sop_md    ?? '',
        sop_md_name:   base + ' — claude.md',
        skills:        res.skills    ?? [],
        triggers:      res.triggers  ?? [],
        ai_used:       !!res.ai_used,
      });
    } catch (err: any) {
      toast({ title: 'แปลงไฟล์ไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleSaveBriefPackage = async () => {
    if (!briefPkg) return;
    setSavingPkg(true);
    try {
      const res = await apiFetch<{ saved: boolean }>('/brand-content.php?action=save-brief-package', {
        method: 'POST',
        body: JSON.stringify({
          brand_md:      briefPkg.brand_md,
          brand_md_name: briefPkg.brand_md_name,
          sop_md:        briefPkg.sop_md,
          sop_md_name:   briefPkg.sop_md_name,
          skills:        briefPkg.skills,
          triggers:      briefPkg.triggers,
        }),
      });
      const saved = res?.saved ?? res;
      qc.invalidateQueries({ queryKey: ['content', 'contexts'] });
      qc.invalidateQueries({ queryKey: ['content', 'skills'] });
      qc.invalidateQueries({ queryKey: ['content', 'triggers'] });
      toast({ title: 'บันทึกสำเร็จ! 🎉', description: `${saved.contexts ?? 0} Contexts · ${saved.skills ?? 0} Skills · ${saved.triggers ?? 0} Triggers` });
      setBriefPkg(null);
    } catch (err: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setSavingPkg(false);
    }
  };

  const { data: contexts = [], isLoading } = useBrandContexts();
  const saveMutation = useSaveBrandContext();
  const deleteMutation = useDeleteBrandContext();

  const openCreate = () => { setEditing(null); setForm({ name: '', file_type: 'brand_md', content: '' }); setDialogOpen(true); };
  const openEdit   = (ctx: BrandContext) => { setEditing(ctx); setForm({ name: ctx.name, file_type: ctx.file_type, content: ctx.content ?? '' }); setDialogOpen(true); };

  return (
    <div className="space-y-5">
      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={handleFileChange} />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg">Knowledge Base & Context Management</h2>
          <p className="text-sm text-muted-foreground">อัปโหลด brand.md และ claude.md เพื่อให้ AI ใช้เป็นบริบทหลักทุกครั้ง</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" className="gap-2 flex-1 sm:flex-none" disabled={importing} onClick={() => fileInputRef.current?.click()}>
            {importing ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">กำลังแปลงไฟล์...</span></> : <><Upload className="h-4 w-4" /><span className="hidden sm:inline">นำเข้า Brand Brief</span><span className="sm:hidden">นำเข้า</span></>}
          </Button>
          <Button className="gap-2 flex-1 sm:flex-none" onClick={openCreate}><Plus className="h-4 w-4" /><span className="hidden sm:inline">เพิ่ม Context</span><span className="sm:hidden">เพิ่ม</span></Button>
        </div>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 flex items-start gap-3">
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">นำเข้า Brand Brief</span> — อัปโหลดไฟล์ <code className="bg-muted px-1 rounded">.pdf</code> <code className="bg-muted px-1 rounded">.docx</code> <code className="bg-muted px-1 rounded">.txt</code> <code className="bg-muted px-1 rounded">.md</code> ระบบจะใช้ AI แปลงเป็น Markdown อัตโนมัติ พร้อมให้ตรวจสอบก่อนบันทึก
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['brand_md', 'sop_md'] as const).map(ft => {
          const fm = FILE_TYPE_MAP[ft];
          const FIcon = fm.icon;
          const exists = contexts.some(c => c.file_type === ft);
          return (
            <div key={ft} className={cn('rounded-lg border p-4', exists ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-dashed')}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded ${fm.color}`}><FIcon className="h-4 w-4" /></div>
                <span className="font-medium text-sm">{fm.label}</span>
                {exists && <Badge className="ml-auto bg-green-100 text-green-700 text-[10px] px-1.5">✓ มีแล้ว</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {ft === 'brand_md'
                  ? 'Brand Identity, Target Audience, Tone of Voice, Color Palette — ดึงตัวแปรอัตโนมัติ'
                  : "SOP Enforcer: กฎ Do's & Don'ts, มาตรฐานการทำงาน, ข้อห้าม AI"}
              </p>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : contexts.length === 0 ? (
        <div className="text-center py-16 border rounded-lg border-dashed text-muted-foreground">
          <Upload className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">ยังไม่มี Context</p>
          <p className="text-sm mt-1">เพิ่ม brand.md หรือ claude.md เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contexts.map(ctx => {
            const fm = FILE_TYPE_MAP[ctx.file_type] ?? FILE_TYPE_MAP.custom;
            const FIcon = fm.icon;
            const parsed = ctx.parsed_data ? (() => { try { return JSON.parse(ctx.parsed_data!); } catch { return null; } })() : null;
            return (
              <Card key={ctx.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${fm.color}`}><FIcon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{ctx.name}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${fm.color}`}>{fm.label}</span>
                      </div>
                      {parsed && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                          {parsed.brand_name    && <span className="text-xs text-muted-foreground">🏷 {parsed.brand_name}</span>}
                          {parsed.tone_of_voice && <span className="text-xs text-muted-foreground">🗣 {parsed.tone_of_voice}</span>}
                          {parsed.target_audience && <span className="text-xs text-muted-foreground">🎯 {parsed.target_audience}</span>}
                          {parsed.colors?.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              🎨 {parsed.colors.slice(0, 6).map((c: string) => (
                                <span key={c} className="inline-block h-3.5 w-3.5 rounded-full border border-border/60" style={{ backgroundColor: c }} title={c} />
                              ))}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1.5">{(ctx.content ?? '').split('\n').length} บรรทัด · {new Date(ctx.created_at).toLocaleDateString('th-TH')}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(ctx)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={async () => { if (await confirm({ title: 'ลบ Context', description: 'ลบ Context นี้?', variant: 'destructive' })) deleteMutation.mutate(ctx.id, { onSuccess: () => toast({ title: 'ลบแล้ว' }) }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!briefPkg} onOpenChange={open => { if (!open) setBriefPkg(null); }}>
        <DialogContent className="w-full sm:max-w-3xl sm:max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />ตรวจสอบ Brand Brief Package
            </DialogTitle>
            <DialogDescription>
              {briefPkg?.ai_used
                ? '✨ AI สร้าง 4 ส่วนครบจาก Brand Brief — แก้ไขได้ก่อนบันทึกทั้งหมด'
                : 'ตรวจสอบและแก้ไขก่อนบันทึก'}
            </DialogDescription>
          </DialogHeader>
          {briefPkg && (
            <Tabs defaultValue="brand" className="flex-1 flex flex-col min-h-0">
              <TabsList className="shrink-0 flex overflow-x-auto w-full h-auto text-xs sm:grid sm:grid-cols-4">
                <TabsTrigger value="brand"    className="gap-1 px-2 sm:px-3 shrink-0 py-2"><BookOpen   className="h-3 w-3 shrink-0" /><span className="hidden sm:inline">brand.md</span></TabsTrigger>
                <TabsTrigger value="sop"      className="gap-1 px-2 sm:px-3 shrink-0 py-2"><ListChecks className="h-3 w-3 shrink-0" /><span className="hidden sm:inline">claude.md</span></TabsTrigger>
                <TabsTrigger value="skills"   className="gap-1 px-2 sm:px-3 shrink-0 py-2"><Bot        className="h-3 w-3 shrink-0" /><span className="hidden sm:inline">Skills ({briefPkg.skills.length})</span></TabsTrigger>
                <TabsTrigger value="triggers" className="gap-1 px-2 sm:px-3 shrink-0 py-2"><Zap        className="h-3 w-3 shrink-0" /><span className="hidden sm:inline">Triggers ({briefPkg.triggers.length})</span></TabsTrigger>
              </TabsList>
              <div className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1">
                <TabsContent value="brand" className="mt-0 space-y-3">
                  <div className="space-y-1.5">
                    <Label>ชื่อ Context</Label>
                    <Input value={briefPkg.brand_md_name} onChange={e => setBriefPkg(p => p ? { ...p, brand_md_name: e.target.value } : null)} />
                  </div>
                  <Textarea value={briefPkg.brand_md} onChange={e => setBriefPkg(p => p ? { ...p, brand_md: e.target.value } : null)} className="min-h-[360px] font-mono text-xs" />
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Info className="h-3 w-3" />ระบบจะดึง Brand Name, Tone, Colors (#HEX) อัตโนมัติ</p>
                </TabsContent>
                <TabsContent value="sop" className="mt-0 space-y-3">
                  <div className="space-y-1.5">
                    <Label>ชื่อ Context</Label>
                    <Input value={briefPkg.sop_md_name} onChange={e => setBriefPkg(p => p ? { ...p, sop_md_name: e.target.value } : null)} />
                  </div>
                  <Textarea value={briefPkg.sop_md} onChange={e => setBriefPkg(p => p ? { ...p, sop_md: e.target.value } : null)} className="min-h-[360px] font-mono text-xs" />
                </TabsContent>
                <TabsContent value="skills" className="mt-0 space-y-3">
                  {briefPkg.skills.map((sk, i) => (
                    <Card key={i}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-950 shrink-0"><Bot className="h-4 w-4 text-violet-600" /></div>
                          <Input
                            value={sk.name}
                            onChange={e => setBriefPkg(p => p ? { ...p, skills: p.skills.map((s, idx) => idx === i ? { ...s, name: e.target.value } : s) } : null)}
                            className="h-8 font-semibold text-sm flex-1" placeholder="ชื่อ Skill..."
                          />
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive shrink-0"
                            onClick={() => setBriefPkg(p => p ? { ...p,
                              skills: p.skills.filter((_, idx) => idx !== i),
                              triggers: p.triggers.map(t => ({
                                ...t,
                                skill_index: t.skill_index === i ? -1 : t.skill_index > i ? t.skill_index - 1 : t.skill_index,
                              })),
                            } : null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">System Prompt</Label>
                          <Textarea
                            value={sk.system_prompt}
                            onChange={e => setBriefPkg(p => p ? { ...p, skills: p.skills.map((s, idx) => idx === i ? { ...s, system_prompt: e.target.value } : s) } : null)}
                            className="min-h-[80px] text-xs"
                          />
                        </div>
                        {(sk.steps?.length ?? 0) > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{sk.steps.length} Steps</Label>
                            {sk.steps.map((st, si) => (
                              <div key={si} className="flex items-center gap-2 text-xs px-3 py-1.5 bg-muted/40 rounded">
                                <span className="font-mono text-muted-foreground w-4 shrink-0">{si + 1}.</span>
                                <span className="flex-1 text-muted-foreground">{st.instruction}</span>
                                <Badge variant="secondary" className="text-[10px] shrink-0">{st.output_type}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <Button size="sm" variant="outline" className="gap-1.5 w-full"
                    onClick={() => setBriefPkg(p => p ? { ...p, skills: [...p.skills, { name: 'New Skill', description: '', system_prompt: '', steps: [] }] } : null)}>
                    <Plus className="h-3.5 w-3.5" />เพิ่ม Skill
                  </Button>
                </TabsContent>
                <TabsContent value="triggers" className="mt-0 space-y-2">
                  {briefPkg.triggers.map((tr, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 border rounded-lg">
                      <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-1" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <Input
                          value={tr.command}
                          onChange={e => setBriefPkg(p => p ? { ...p, triggers: p.triggers.map((t, ti) => ti === i ? { ...t, command: e.target.value } : t) } : null)}
                          className="font-mono text-sm h-8" placeholder="Trigger command..."
                        />
                        <div className="flex gap-2">
                          <Input
                            value={tr.description}
                            onChange={e => setBriefPkg(p => p ? { ...p, triggers: p.triggers.map((t, ti) => ti === i ? { ...t, description: e.target.value } : t) } : null)}
                            className="text-xs h-7 flex-1" placeholder="คำอธิบาย..."
                          />
                          <Select
                            value={tr.skill_index >= 0 ? String(tr.skill_index) : '__none__'}
                            onValueChange={v => setBriefPkg(p => p ? { ...p, triggers: p.triggers.map((t, ti) => ti === i ? { ...t, skill_index: v === '__none__' ? -1 : Number(v) } : t) } : null)}>
                            <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Skill..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">ไม่ระบุ Skill</SelectItem>
                              {briefPkg.skills.map((sk, si) => <SelectItem key={si} value={String(si)}>{sk.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive shrink-0"
                        onClick={() => setBriefPkg(p => p ? { ...p, triggers: p.triggers.filter((_, ti) => ti !== i) } : null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="gap-1.5 w-full"
                    onClick={() => setBriefPkg(p => p ? { ...p, triggers: [...p.triggers, { command: '', description: '', skill_index: -1 }] } : null)}>
                    <Plus className="h-3.5 w-3.5" />เพิ่ม Trigger
                  </Button>
                </TabsContent>
              </div>
            </Tabs>
          )}
          <DialogFooter className="pt-3 border-t shrink-0">
            <Button variant="outline" onClick={() => setBriefPkg(null)}>ยกเลิก</Button>
            <Button disabled={savingPkg || !briefPkg?.brand_md} onClick={handleSaveBriefPackage} className="gap-2">
              {savingPkg ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังบันทึก...</> : <><Save className="h-4 w-4" />บันทึกทั้งหมด</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไข Context' : 'เพิ่ม Context ใหม่'}</DialogTitle>
            <DialogDescription>วางเนื้อหาไฟล์ Markdown (.md) ลงในช่องด้านล่าง</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ชื่อ <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น brand.md" />
              </div>
              <div className="space-y-1.5">
                <Label>ประเภท</Label>
                <Select value={form.file_type} onValueChange={v => setForm(f => ({ ...f, file_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand_md">brand.md (Brand Identity)</SelectItem>
                    <SelectItem value="sop_md">claude.md / SOP (กฎการทำงาน)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>เนื้อหา Markdown</Label>
              <Textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder={form.file_type === 'brand_md'
                  ? `# Brand Identity\n\nBrand Name: MyBrand\nTone of Voice: Professional, Friendly\nTarget Audience: อายุ 25-40 ปี\n\n## Color Palette\n- Primary: #3B82F6\n- Secondary: #F59E0B`
                  : `# SOP Rules\n\n## Do's\n- ...\n\n## Don'ts\n- ห้ามใช้ภาษาที่รุนแรง`
                }
                className="min-h-[280px] font-mono text-xs"
              />
              {form.file_type === 'brand_md' && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Info className="h-3 w-3" />ระบบจะดึง Brand Name, Tone, Target Audience, Color (#HEX) โดยอัตโนมัติ</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button disabled={saveMutation.isPending || !form.name} onClick={() => saveMutation.mutate({ ...form, id: editing?.id }, { onSuccess: () => { setDialogOpen(false); setEditing(null); setForm({ name: '', file_type: 'brand_md', content: '' }); toast({ title: 'บันทึกแล้ว' }); } })}>
              {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังบันทึก...</> : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
