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
          placeholder="เช่น: ก่อนทำงานทุกครั้ง ให้อ่าน brand.md และ claude.md ของโปรเจกต์ก่อนเสมอ"
          className="min-h-[120px] text-sm"
        />
        <Button className="gap-2" disabled={saveMut.isPending} onClick={handleSave}>
          {saveMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังบันทึก...</> : <><Save className="h-4 w-4" />บันทึก</>}
        </Button>
      </CardContent>
    </Card>
  );
}
