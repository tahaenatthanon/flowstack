import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, Users, FolderKanban, ClipboardList, ListTodo, TrendingUp,
  FileSpreadsheet, FileJson, CheckCircle2, Loader2,
} from 'lucide-react';
import PageShell from '@/components/PageShell';

const EXPORT_TYPES = [
  { key: 'companies', label: 'บริษัท', description: 'ข้อมูลบริษัทและองค์กร', icon: Building2 },
  { key: 'customers', label: 'ลูกค้า', description: 'ข้อมูลผู้ติดต่อและลูกค้า', icon: Users },
  { key: 'projects', label: 'โปรเจกต์', description: 'ข้อมูลโปรเจกต์ทั้งหมด', icon: FolderKanban },
  { key: 'tasks', label: 'งาน', description: 'ข้อมูลงานหลัก', icon: ClipboardList },
  { key: 'subtasks', label: 'งานย่อย', description: 'ข้อมูลงานย่อย', icon: ListTodo },
  { key: 'opportunities', label: 'โอกาสขาย', description: 'ข้อมูลโอกาสทางการขาย', icon: TrendingUp },
];

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function jsonToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const headerRow = headers.join(',');
  const rows = data.map((row) =>
    headers.map((h) => escapeCsvCell(row[h])).join(','),
  );
  return [headerRow, ...rows].join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const selectAll = () => setSelected(new Set(EXPORT_TYPES.map((t) => t.key)));
  const deselectAll = () => setSelected(new Set());

  async function handleExport() {
    if (selected.size === 0) return;
    setExporting(true);
    try {
      const typesParam = Array.from(selected).join(',');
      const result = await apiFetch<Record<string, Record<string, unknown>[]>>(
        `/export.php?types=${typesParam}`,
      );
      const ts = new Date().toISOString().split('T')[0];
      for (const typeKey of Array.from(selected)) {
        const data = result[typeKey];
        if (!data || !Array.isArray(data) || data.length === 0) continue;
        if (format === 'csv') {
          const BOM = '﻿';
          downloadFile(BOM + jsonToCsv(data), `${typeKey}_${ts}.csv`, 'text/csv;charset=utf-8;');
        } else {
          downloadFile(JSON.stringify(data, null, 2), `${typeKey}_${ts}.json`, 'application/json;charset=utf-8;');
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      toast({ title: 'ส่งออกสำเร็จ', description: `ส่งออกข้อมูล ${selected.size} ประเภทเรียบร้อย` });
    } catch (err: unknown) {
      toast({ title: 'ส่งออกล้มเหลว', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageShell
      breadcrumbs={[{ label: 'การจัดการระบบ', href: '/admin' }, { label: 'ส่งออกข้อมูล', isCurrent: true }]}
      title="ส่งออกข้อมูล"
      description="เลือกประเภทข้อมูลที่ต้องการส่งออก"
    >

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXPORT_TYPES.map(({ key, label, description, icon: Icon }) => {
          const isSelected = selected.has(key);
          return (
            <Card key={key}
              className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/40'}`}
              onClick={() => toggle(key)}>
              <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription className="mt-1 text-xs">{description}</CardDescription>
                </div>
                {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>เลือกทั้งหมด</Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>ยกเลิกเลือก</Button>
          {selected.size > 0 && <Badge variant="secondary" className="ml-2">เลือกแล้ว {selected.size} ประเภท</Badge>}
        </div>
        <Button onClick={handleExport} disabled={selected.size === 0 || exporting} size="lg">
          {exporting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังส่งออก...</>
          ) : format === 'csv' ? (
            <><FileSpreadsheet className="mr-2 h-4 w-4" />ส่งออก CSV</>
          ) : (
            <><FileJson className="mr-2 h-4 w-4" />ส่งออก JSON</>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">รูปแบบไฟล์</CardTitle>
          <CardDescription>เลือกรูปแบบของไฟล์ที่ต้องการส่งออก</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'csv' | 'json')} className="flex gap-6">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="csv" id="fmt-csv" />
              <Label htmlFor="fmt-csv" className="flex items-center gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> CSV
                <span className="text-xs text-muted-foreground">(รองรับภาษาไทย)</span>
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="json" id="fmt-json" />
              <Label htmlFor="fmt-json" className="flex items-center gap-2 cursor-pointer">
                <FileJson className="h-4 w-4 text-blue-600" /> JSON
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </PageShell>
  );
}
