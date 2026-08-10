import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUpload } from '@/lib/api';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, Upload, FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import type { QuotationTemplateListItem, DbQuotationTemplate } from '@/types/project';

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  csv: { label: 'CSV', className: 'bg-blue-100 text-blue-700' },
  excel: { label: 'Excel', className: 'bg-green-100 text-green-700' },
  existing_quotation: { label: 'จากใบเสนอราคา', className: 'bg-purple-100 text-purple-700' },
  manual: { label: 'กำหนดเอง', className: 'bg-gray-100 text-gray-700' },
};

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_CONFIG[source] ?? { label: source, className: 'bg-gray-100 text-gray-700' };
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

function formatThaiDate(iso: string) {
  try { return format(parseISO(iso), 'dd MMM yyyy', { locale: th }); }
  catch { return iso; }
}

type UploadResponse = { id: string; parsed: DbQuotationTemplate['parsed_schema'] & { items?: DbQuotationTemplate['example_items_json'] }; message: string };

export default function QuotationTemplatesPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<UploadResponse['parsed'] | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editActive, setEditActive] = useState(true);

  // Row expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Queries
  const { data: templates = [], isLoading } = useQuery<QuotationTemplateListItem[]>({
    queryKey: ['quotation-templates', 'admin-list'],
    queryFn: () => apiFetch('/quotation-templates.php'),
    staleTime: 60_000,
  });

  const { data: expandedDetail, isFetching: expandingFetch } = useQuery<DbQuotationTemplate>({
    queryKey: ['quotation-template', expandedId],
    queryFn: () => apiFetch(`/quotation-templates.php?id=${expandedId}`),
    enabled: !!expandedId,
  });

  // Mutations
  const uploadMut = useMutation({
    mutationFn: (fd: FormData) => apiUpload<{ data: UploadResponse }>('/quotation-templates.php', fd),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['quotation-templates'] });
      const d = result.data ?? (result as unknown as UploadResponse);
      toast({ title: 'อัปโหลดสำเร็จ', description: d.message });
      setUploadPreview(d.parsed ?? null);
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      apiFetch(`/quotation-templates.php?id=${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation-templates'] });
      toast({ title: 'อัปเดตสำเร็จ' });
      closeEdit();
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/quotation-templates.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotation-templates'] });
      toast({ title: 'ลบสำเร็จ' });
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  // Handlers
  function closeUpload() {
    setUploadOpen(false);
    setUploadName('');
    setUploadDesc('');
    setUploadFile(null);
    setUploadPreview(null);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditId(null);
    setEditName('');
    setEditDesc('');
    setEditActive(true);
  }

  function openEdit(t: QuotationTemplateListItem) {
    setEditId(t.id);
    setEditName(t.name);
    setEditDesc(t.description || '');
    setEditActive(!!t.is_active);
    setEditOpen(true);
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({ title: 'ลบ Template', description: `ยืนยันการลบ "${name}"?`, variant: 'destructive' });
    if (ok) deleteMut.mutate(id);
  }

  function handleUploadSubmit() {
    if (!uploadName.trim()) { toast({ title: 'กรุณาระบุชื่อ template', variant: 'destructive' }); return; }
    if (!uploadFile) { toast({ title: 'กรุณาเลือกไฟล์', variant: 'destructive' }); return; }
    const fd = new FormData();
    fd.append('name', uploadName.trim());
    fd.append('description', uploadDesc);
    fd.append('file', uploadFile);
    uploadMut.mutate(fd);
  }

  function handleEditSubmit() {
    if (!editName.trim()) { toast({ title: 'กรุณาระบุชื่อ template', variant: 'destructive' }); return; }
    updateMut.mutate({ id: editId!, updates: { name: editName.trim(), description: editDesc, is_active: editActive ? 1 : 0 } });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">จัดการ Template ใบเสนอราคา</h3>
          <p className="text-sm text-muted-foreground">อัปโหลดไฟล์ CSV/Excel เพื่อใช้เป็น template สำหรับสร้างใบเสนอราคา</p>
        </div>
        <Button onClick={() => { setUploadOpen(true); }}>
          <Upload className="h-4 w-4 mr-2" /> อัปโหลด Template
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">ยังไม่มี template</p>
            <p className="text-sm text-muted-foreground mt-1">อัปโหลดไฟล์ CSV หรือ Excel เพื่อเริ่มต้น</p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>ชื่อ</TableHead>
              <TableHead className="hidden md:table-cell">คำอธิบาย</TableHead>
              <TableHead>ที่มา</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="hidden sm:table-cell">วันที่สร้าง</TableHead>
              <TableHead className="w-24 text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <React.Fragment key={t.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                >
                  <TableCell>
                    {expandedId === t.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground max-w-48 truncate">{t.description || '-'}</TableCell>
                  <TableCell><SourceBadge source={t.source} /></TableCell>
                  <TableCell>
                    {t.is_active ? (
                      <Badge variant="outline" className="text-green-600 border-green-300">ใช้งาน</Badge>
                    ) : (
                      <Badge variant="secondary">ไม่ใช้งาน</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{formatThaiDate(t.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(t.id, t.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedId === t.id && (
                  <TableRow key={`${t.id}-expanded`}>
                    <TableCell colSpan={7} className="bg-muted/30 p-4">
                      {expandingFetch || expandedId !== t.id ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : expandedDetail ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            ตัวอย่างรายการ ({expandedDetail.example_items_json?.length ?? 0} รายการ)
                          </p>
                          {expandedDetail.example_items_json && expandedDetail.example_items_json.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">รายการ</TableHead>
                                  <TableHead className="text-xs">คำอธิบาย</TableHead>
                                  <TableHead className="text-xs text-right">จำนวน</TableHead>
                                  <TableHead className="text-xs">หน่วย</TableHead>
                                  <TableHead className="text-xs text-right">ราคา/หน่วย</TableHead>
                                  <TableHead className="text-xs text-right">รวม</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {expandedDetail.example_items_json.map((item, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="text-xs">{item.item_name}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{item.description || '-'}</TableCell>
                                    <TableCell className="text-xs text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-xs">{item.unit}</TableCell>
                                    <TableCell className="text-xs text-right">{item.unit_price?.toLocaleString()}</TableCell>
                                    <TableCell className="text-xs text-right">{item.total_price?.toLocaleString()}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <p className="text-xs text-muted-foreground">ไม่มีรายการตัวอย่าง</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">ไม่พบข้อมูล</p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!v) closeUpload(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>อัปโหลด Template ใบเสนอราคา</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>ชื่อ Template *</Label>
              <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="เช่น Template อุปกรณ์ IT" />
            </div>
            <div className="grid gap-2">
              <Label>คำอธิบาย</Label>
              <Textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)" rows={2} />
            </div>
            <div className="grid gap-2">
              <Label>ไฟล์ CSV หรือ Excel *</Label>
              <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">รองรับ .csv, .xlsx, .xls สูงสุด 5MB</p>
            </div>
            {uploadPreview && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="text-sm font-semibold">ผลการอ่านไฟล์</p>
                <p className="text-xs text-muted-foreground">
                  Header: {uploadPreview.headers?.join(', ') || '-'}
                </p>
                <p className="text-xs text-muted-foreground">
                  พบ {uploadPreview.items?.length ?? uploadPreview.sample_rows?.length ?? 0} รายการ
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeUpload}>ยกเลิก</Button>
            <Button onClick={handleUploadSubmit} disabled={uploadMut.isPending || !uploadName.trim() || !uploadFile}>
              {uploadMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {uploadMut.isPending ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) closeEdit(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไข Template</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>ชื่อ Template *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>คำอธิบาย</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <Label>สถานะการใช้งาน</Label>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>ยกเลิก</Button>
            <Button onClick={handleEditSubmit} disabled={updateMut.isPending || !editName.trim()}>
              {updateMut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
