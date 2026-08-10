import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useLeadSourceCatalog } from '@/hooks/useWorkTypes';
import { useUpdateCompanySettings } from '@/hooks/useSales';
import { Save, Plus, Trash2 } from 'lucide-react';
import type { LeadSourceOption } from '@/hooks/useWorkTypes';

function makeDraft(): LeadSourceOption {
  return { key: `source_${Date.now()}`, label: '', active: 1 };
}

export default function LeadSourceSettingsPanel() {
  const { toast } = useToast();
  const { leadSources, isLoading } = useLeadSourceCatalog();
  const updateSettings = useUpdateCompanySettings();

  const [draft, setDraft] = useState<LeadSourceOption[]>([]);

  const canInit = useMemo(() => !isLoading && draft.length === 0, [isLoading, draft.length]);

  useEffect(() => {
    if (canInit) setDraft(leadSources);
  }, [canInit, leadSources]);

  const handleChange = (idx: number, patch: Partial<LeadSourceOption>) => {
    setDraft((rows) => rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeRow = (idx: number) => {
    setDraft((rows) => rows.filter((_, i) => i !== idx));
  };

  const save = async () => {
    const invalid = draft.find((row) => !row.key || !row.label);
    if (invalid) {
      toast({ title: 'กรุณากรอกรหัสและชื่อให้ครบ', variant: 'destructive' });
      return;
    }
    try {
      await updateSettings.mutateAsync({ lead_source_catalog: draft } as any);
      toast({ title: 'บันทึกสำเร็จ', description: 'อัปเดตรายการแหล่งที่มาแล้ว' });
    } catch (error: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">กำหนดรายการแหล่งที่มาของลูกค้า (Lead Source) สำหรับโอกาสการขาย</p>
        <Button onClick={save} disabled={updateSettings.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {updateSettings.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รายการแหล่งที่มา</CardTitle>
          <CardDescription>ใช้กับฟิลด์ "แหล่งที่มา" ในหน้าโอกาสการขาย — สามารถพิมพ์แหล่งที่มาที่ไม่อยู่ในรายการได้</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft.map((row, idx) => (
            <div key={row.key} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-lg p-3">
              <div className="md:col-span-4 space-y-1">
                <Label>รหัส</Label>
                <Input
                  value={row.key}
                  onChange={(e) => handleChange(idx, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                />
              </div>
              <div className="md:col-span-5 space-y-1">
                <Label>ชื่อที่แสดง</Label>
                <Input
                  value={row.label}
                  onChange={(e) => handleChange(idx, { label: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2 h-10">
                <Switch checked={!!row.active} onCheckedChange={(v) => handleChange(idx, { active: v ? 1 : 0 })} />
                <span className="text-sm">เปิดใช้</span>
              </div>
              <div className="md:col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" className="gap-2" onClick={() => setDraft((rows) => [...rows, makeDraft()])}>
          <Plus className="h-4 w-4" /> เพิ่มแหล่งที่มา
        </Button>
      </div>
    </div>
  );
}
