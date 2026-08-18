import { useState, useEffect } from 'react';
import { Target, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useContentGlobalSettings, useSaveGlobalSettings } from '@/hooks/useContent';

export default function ContentGoalForm() {
  const { toast } = useToast();
  const { data: globalSettings } = useContentGlobalSettings();
  const [weeklyTarget, setWeeklyTarget] = useState('0');
  const saveMut = useSaveGlobalSettings();

  useEffect(() => {
    if (globalSettings) {
      setWeeklyTarget(String(globalSettings.weekly_posts_target ?? 0));
    }
  }, [globalSettings]);

  const handleSave = () => {
    const parsed = Math.max(0, Math.floor(Number(weeklyTarget) || 0));
    saveMut.mutate({ weekly_posts_target: parsed }, {
      onSuccess: () => {
        setWeeklyTarget(String(parsed));
        toast({ title: 'บันทึกแล้ว' });
      },
      onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-500" />เป้าหมายคอนเทนต์
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">ใช้เปรียบเทียบกับจำนวนโพสต์ที่เผยแพร่จริงในรอบ 7 วันล่าสุด บนแท็บวิเคราะห์ของแดชบอร์ดคอนเทนต์ — ใส่ 0 หากยังไม่ต้องการตั้งเป้าหมาย</p>
        <div className="space-y-1.5">
          <Label htmlFor="weekly-posts-target" className="text-sm">เป้าหมายโพสต์/สัปดาห์</Label>
          <Input
            id="weekly-posts-target"
            type="number"
            min={0}
            step={1}
            value={weeklyTarget}
            onChange={e => setWeeklyTarget(e.target.value)}
            className="max-w-[140px] text-sm"
          />
        </div>
        <Button className="gap-2" disabled={saveMut.isPending} onClick={handleSave}>
          {saveMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังบันทึก...</> : <><Save className="h-4 w-4" />บันทึก</>}
        </Button>
      </CardContent>
    </Card>
  );
}
