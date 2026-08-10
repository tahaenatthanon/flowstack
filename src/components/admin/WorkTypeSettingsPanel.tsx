import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useWorkTypeCatalog, useUpdateWorkTypeCatalog, type WorkTypeOption } from '@/hooks/useWorkTypes';
import { Save, Plus, Trash2 } from 'lucide-react';

function makeDraft(prefix: string): WorkTypeOption {
  return {
    key: `${prefix}_${Date.now()}`,
    label: '',
    color: '#6b7280',
    active: 1,
    system: 0,
  };
}

function CatalogEditor({
  title,
  description,
  rows,
  onChange,
}: {
  title: string;
  description: string;
  rows: WorkTypeOption[];
  onChange: (rows: WorkTypeOption[]) => void;
}) {
  const handleRowChange = (idx: number, patch: Partial<WorkTypeOption>) => {
    onChange(rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeRow = (idx: number) => {
    const row = rows[idx];
    if (row?.system) return;
    onChange(rows.filter((_, i) => i !== idx));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row, idx) => (
          <div key={row.key} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-lg p-3">
            <div className="md:col-span-3 space-y-1">
              <Label>รหัส</Label>
              <Input
                value={row.key}
                disabled={!!row.system}
                onChange={(e) => handleRowChange(idx, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
              />
            </div>
            <div className="md:col-span-4 space-y-1">
              <Label>ชื่อที่แสดง</Label>
              <Input
                value={row.label}
                onChange={(e) => handleRowChange(idx, { label: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>สี</Label>
              <Input
                type="color"
                value={row.color}
                onChange={(e) => handleRowChange(idx, { color: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2 h-10">
              <Switch checked={!!row.active} onCheckedChange={(v) => handleRowChange(idx, { active: v ? 1 : 0 })} />
              <span className="text-sm">เปิดใช้งาน</span>
            </div>
            <div className="md:col-span-1 flex justify-end">
              {row.system ? (
                <Badge variant="secondary">System</Badge>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => removeRow(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function WorkTypeSettingsPanel() {
  const { toast } = useToast();
  const { taskTypes, eventTypes, isLoading } = useWorkTypeCatalog();
  const updateSettings = useUpdateWorkTypeCatalog();

  const [draftTaskTypes, setDraftTaskTypes] = useState<WorkTypeOption[]>([]);
  const [draftEventTypes, setDraftEventTypes] = useState<WorkTypeOption[]>([]);

  const canInit = useMemo(
    () => !isLoading && draftTaskTypes.length === 0 && draftEventTypes.length === 0,
    [isLoading, draftTaskTypes.length, draftEventTypes.length]
  );

  useEffect(() => {
    if (canInit) {
      setDraftTaskTypes(taskTypes);
      setDraftEventTypes(eventTypes);
    }
  }, [canInit, taskTypes, eventTypes]);

  const save = async () => {
    const invalidTask = draftTaskTypes.find((row) => !row.key || !row.label);
    const invalidEvent = draftEventTypes.find((row) => !row.key || !row.label);
    if (invalidTask || invalidEvent) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', variant: 'destructive' });
      return;
    }

    try {
      await updateSettings.mutateAsync({
        task_type_catalog: draftTaskTypes,
        calendar_event_type_catalog: draftEventTypes,
      } as any);
      toast({ title: 'บันทึกสำเร็จ', description: 'อัปเดตประเภทงานและปฏิทินแล้ว' });
    } catch (error: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">กำหนดประเภทที่อนุญาตให้ทุกหน้าจอใช้งานร่วมกันจากแหล่งเดียว</p>
        <Button onClick={save} disabled={updateSettings.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {updateSettings.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>แนวทางการใช้งาน (สำคัญ)</CardTitle>
          <CardDescription>แยกการบันทึกให้ชัดเจน เพื่อลดข้อมูลซ้ำและให้รายงาน capacity/effort ถูกต้อง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>ประเภทงาน (tasks):</strong> ใช้กับปุ่ม "บันทึกงาน" — ครอบคลุม งานปกติ, ประชุม, ลาหยุด, OT, งานลูกค้า ฯลฯ ทุกรายการ<strong>นับชั่วโมงและติดตามได้</strong></p>
          <p><strong>ประเภทปฏิทิน (calendar_events):</strong> ใช้กับปุ่ม "วันหยุด" (admin เท่านั้น) — เฉพาะ <strong>วันหยุดบริษัท</strong> และ <strong>กิจกรรมอื่นๆ</strong> ที่ไม่นับชั่วโมง</p>
          <p><strong>หลักการ:</strong> ทุกงาน ประชุม ลา → บันทึกในงาน (tasks) | วันหยุดบริษัทและกิจกรรมทั่วไป → บันทึกในปฏิทิน (calendar_events)</p>
        </CardContent>
      </Card>

      <CatalogEditor
        title="ประเภทงาน (Task Types)"
        description="ใช้กับการสร้าง/แก้ไขงานในระบบ"
        rows={draftTaskTypes}
        onChange={setDraftTaskTypes}
      />
      <div className="flex justify-end">
        <Button variant="outline" className="gap-2" onClick={() => setDraftTaskTypes((rows) => [...rows, makeDraft('custom_task')])}>
          <Plus className="h-4 w-4" /> เพิ่มประเภทงาน
        </Button>
      </div>

      <CatalogEditor
        title="ประเภทปฏิทิน (Calendar Event Types)"
        description="ใช้กับปุ่ม 'วันหยุด' (admin) — วันหยุดบริษัทและกิจกรรมที่ไม่นับชั่วโมง ไม่รวมประชุม/ลา (บันทึกผ่านงาน)"
        rows={draftEventTypes}
        onChange={setDraftEventTypes}
      />
      <div className="flex justify-end">
        <Button variant="outline" className="gap-2" onClick={() => setDraftEventTypes((rows) => [...rows, makeDraft('custom_event')])}>
          <Plus className="h-4 w-4" /> เพิ่มประเภทปฏิทิน
        </Button>
      </div>
    </div>
  );
}
