// src/pages/SurveyPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Eye, Send, CheckCheck, Filter } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCompanies } from '@/hooks/useProjectData';
import { useSurveyTemplates, useDeleteSurveyTemplate, useSurveyTemplate, useSurveyResponsesList, useDeleteSurveyResponse } from '@/hooks/useSurveys';
import { CreateSurveyTemplateDialog } from '@/components/CreateSurveyTemplateDialog';
import { SurveyResponseDetailDialog } from '@/components/SurveyResponseDetailDialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { APP_URL } from '@/lib/api';
import { copyToClipboard } from '@/components/content/views/CopyButton';
import type { SurveyTemplate } from '@/hooks/useSurveys';
import PageShell from '@/components/PageShell';

const INDUSTRY_LABELS: Record<string, string> = {
  general: 'ทั่วไป', it_service: 'IT Service',
  food_pharma: 'อาหาร/ยา', tapioca_factory: 'โรงงานแป้งมัน',
};

const THEME_LABELS: Record<string, string> = {
  general: 'ทั่วไป', it_bottleneck: 'IT Bottleneck',
  ai_governance: 'AI Governance', iso_compliance: 'ISO Compliance',
};


export default function SurveyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { data: templates = [], isLoading } = useSurveyTemplates();
  const deleteMutation = useDeleteSurveyTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<SurveyTemplate | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [tab, setTab] = useState('templates');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const { data: viewTemplate, isLoading: previewLoading } = useSurveyTemplate(viewId);

  const [respTemplateFilter, setRespTemplateFilter] = useState<string>('all');
  const [respCompanyFilter, setRespCompanyFilter] = useState<string>('all');
  const respFilter = useMemo(() => {
    const f: { template_id?: string; company_id?: string } = {};
    if (respTemplateFilter !== 'all') f.template_id = respTemplateFilter;
    if (respCompanyFilter !== 'all') f.company_id = respCompanyFilter;
    return f;
  }, [respTemplateFilter, respCompanyFilter]);
  const { data: companies = [] } = useCompanies(false, tab === 'responses');
  const { data: responses = [], isLoading: responsesLoading } = useSurveyResponsesList(respFilter);
  const [detailResponseId, setDetailResponseId] = useState<string | null>(null);
  const deleteResponseMutation = useDeleteSurveyResponse();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtersContent = (
    <>
      <Select value={respTemplateFilter} onValueChange={v => setRespTemplateFilter(v === 'all' ? 'all' : v)}>
        <SelectTrigger className="w-44 h-9 text-sm shrink-0">
          <SelectValue placeholder="ทุก Template" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุก Template</SelectItem>
          {templates.map(t => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={respCompanyFilter} onValueChange={v => setRespCompanyFilter(v === 'all' ? 'all' : v)}>
        <SelectTrigger className="w-44 h-9 text-sm shrink-0">
          <SelectValue placeholder="ทุกบริษัท" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกบริษัท</SelectItem>
          {companies.map((c: any) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  function handleCopyLink(token: string, id: string) {
    const url = `${APP_URL}/#/survey/public/${token}`;
    copyToClipboard(url);
    setCopiedId(id);
    toast({ title: 'คัดลอกลิงก์แล้ว' });
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDeleteResponse(id: string, templateName: string) {
    if (!await confirm({ title: 'ลบรายการตอบ', description: `ลบรายการตอบ "${templateName}" หรือไม่?`, variant: 'destructive' })) return;
    try {
      await deleteResponseMutation.mutateAsync(id);
      toast({ title: 'ลบรายการสำเร็จ' });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  }

  useEffect(() => {
    if (viewTemplate) setTab('preview');
  }, [viewTemplate]);

  async function handleDelete(id: string, name: string) {
    if (!await confirm({ title: 'ลบ template', description: `ลบ template "${name}" หรือไม่?`, variant: 'destructive' })) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'ลบ template สำเร็จ' });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  }

  return (
    <>
      <PageShell
        breadcrumbs={[{ label: 'การขายและ CRM', href: '/sales' }, { label: 'แบบสอบถาม', isCurrent: true }]}
        title="แบบสอบถาม"
        description="จัดการ template และดูผลการตอบแบบสอบถาม"
        actions={
          <Button onClick={() => { setEditTemplate(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />สร้าง Template
          </Button>
        }
      >

        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0 pb-1">
            <TabsList className="flex sm:grid sm:grid-cols-3">
              <TabsTrigger value="templates" className="shrink-0">Templates</TabsTrigger>
              <TabsTrigger value="preview" disabled={!viewTemplate} onClick={() => { if (!viewId) setTab('templates'); }} className="shrink-0">ดูตัวอย่าง</TabsTrigger>
              <TabsTrigger value="responses" className="shrink-0">ผลการตอบ</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="templates" className="mt-4">
            {isLoading ? (
              <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(t => (
                  <Card key={t.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-sm leading-tight">{t.name}</CardTitle>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{INDUSTRY_LABELS[t.industry] ?? t.industry}</Badge>
                            <Badge variant="outline" className="text-xs">{THEME_LABELS[t.strategic_theme] ?? t.strategic_theme}</Badge>
                            {t.is_global === 1 && <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">Global</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setViewId(t.id); setTab('preview'); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {(user?.is_admin === 1 || t.created_by === user?.id) && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => { setEditTemplate(t); setDialogOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                                onClick={() => handleDelete(t.id, t.name)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {t.description && (
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            {previewLoading ? (
              <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
            ) : viewTemplate ? (
              <div className="max-w-2xl space-y-4">
                <h2 className="font-semibold">{viewTemplate.name}</h2>
                {(viewTemplate.questions ?? []).map((q, i) => (
                  <div key={q.id} className="border rounded p-3 space-y-1">
                    <p className="text-sm font-medium">{i + 1}. {q.question_text}</p>
                    <p className="text-xs text-muted-foreground">
                      ประเภท: {q.question_type} | น้ำหนัก: {q.weight}
                      {q.is_critical === 1 && ` | Critical +${q.critical_bonus}`}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="responses" className="mt-4 space-y-4">
            {/* Filter bar */}
            <div className="rounded-xl border bg-card p-3 space-y-2">
              <div className="flex gap-2 items-center flex-wrap">
                {/* Mobile filter toggle */}
                <button
                  onClick={() => setShowFiltersMobile(v => !v)}
                  className={`h-9 w-9 shrink-0 rounded-md border flex items-center justify-center transition-colors sm:hidden ${showFiltersMobile ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}
                  title="ตัวกรอง"
                >
                  <Filter className="h-4 w-4" />
                </button>

                {/* Desktop filters */}
                <div className="hidden sm:flex gap-2 items-center flex-wrap">
                  {filtersContent}
                </div>
              </div>

              {/* Mobile filters (collapsible) */}
              {showFiltersMobile && (
                <div className="sm:hidden flex flex-wrap items-center gap-2 pt-1 border-t">
                  {filtersContent}
                </div>
              )}
            </div>

            {responsesLoading ? (
              <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
            ) : responses.length === 0 ? (
              <p className="text-muted-foreground text-sm">ยังไม่มีผลการตอบ</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {responses.map((r: any) => (
                    <Card key={r.id}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{r.template_name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{r.company_name}</div>
                            {r.opportunity_name && (
                              <div className="text-xs text-muted-foreground mt-0.5">Opp: {r.opportunity_name}</div>
                            )}
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => handleCopyLink(r.token, r.id)}>
                              {copiedId === r.id ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Send className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => setDetailResponseId(r.id)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                              onClick={() => handleDeleteResponse(r.id, r.template_name)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {r.status === 'completed' ? (
                            <Badge className="text-xs bg-green-100 text-green-800 border-green-200">เสร็จ</Badge>
                          ) : r.status === 'in_progress' ? (
                            <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">กำลังทำ</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">รอ</Badge>
                          )}
                          {r.pain_point_score !== null && (
                            <span className="text-sm font-semibold">{r.pain_point_score}%</span>
                          )}
                          {r.pain_priority === 'critical' ? (
                            <Badge className="text-xs bg-red-100 text-red-800 border-red-200">วิกฤต</Badge>
                          ) : r.pain_priority === 'high' ? (
                            <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200">สูง</Badge>
                          ) : r.pain_priority === 'medium' ? (
                            <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">ปานกลาง</Badge>
                          ) : r.pain_priority === 'low' ? (
                            <Badge className="text-xs bg-slate-100 text-slate-700 border-slate-200">ต่ำ</Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('th-TH') : '-'}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>บริษัท</TableHead>
                        <TableHead>Opportunity</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>วันที่ส่ง</TableHead>
                        <TableHead className="w-28"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {responses.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-sm">{r.template_name}</TableCell>
                          <TableCell className="text-sm">{r.company_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.opportunity_name ?? '-'}</TableCell>
                          <TableCell>
                            {r.status === 'completed' ? (
                              <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">เสร็จ</Badge>
                            ) : r.status === 'in_progress' ? (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 border-blue-200">กำลังทำ</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">รอ</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {r.pain_point_score !== null ? `${r.pain_point_score}%` : '-'}
                          </TableCell>
                          <TableCell>
                            {r.pain_priority === 'critical' ? (
                              <Badge className="text-xs bg-red-100 text-red-800 border-red-200">วิกฤต</Badge>
                            ) : r.pain_priority === 'high' ? (
                              <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200">สูง</Badge>
                            ) : r.pain_priority === 'medium' ? (
                              <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">ปานกลาง</Badge>
                            ) : r.pain_priority === 'low' ? (
                              <Badge className="text-xs bg-slate-100 text-slate-700 border-slate-200">ต่ำ</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('th-TH') : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => handleCopyLink(r.token, r.id)}>
                                {copiedId === r.id ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Send className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => setDetailResponseId(r.id)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                                onClick={() => handleDeleteResponse(r.id, r.template_name)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </PageShell>

      <CreateSurveyTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editTemplate={editTemplate}
      />

      <SurveyResponseDetailDialog
        responseId={detailResponseId}
        open={detailResponseId !== null}
        onOpenChange={v => { if (!v) setDetailResponseId(null); }}
      />
    </>
  );
}
