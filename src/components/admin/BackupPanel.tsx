import { useState } from 'react';
import { getToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, ShieldAlert, Clock } from 'lucide-react';

const LAST_BACKUP_KEY = 'flowstack_last_backup';

export function BackupPanel() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);

  async function handleBackup() {
    setExporting(true);
    try {
      const token = getToken();
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}/api/backup.php`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('สำรองข้อมูลล้มเหลว');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowstack_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.sql`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const now = new Date().toLocaleString('th-TH');
      localStorage.setItem(LAST_BACKUP_KEY, now);
      toast({ title: 'สำรองข้อมูลสำเร็จ', description: `ดาวน์โหลดไฟล์เรียบร้อย` });
    } catch (err: unknown) {
      toast({ title: 'ผิดพลาด', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">สำรองข้อมูล</h3>
        <p className="text-sm text-muted-foreground">สำรองข้อมูลทั้งฐานข้อมูลเป็นไฟล์ SQL</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={handleBackup} disabled={exporting} size="lg">
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              สำรองข้อมูลเดี๋ยวนี้
            </Button>
            {lastBackup && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                สำรองล่าสุด: {lastBackup}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">คำเตือนด้านความปลอดภัย</p>
              <p className="text-amber-700 dark:text-amber-300 mt-1">
                ไฟล์สำรองข้อมูลรวมข้อมูลทั้งหมดในระบบ กรุณาเก็บรักษาอย่างปลอดภัยและไม่แชร์ให้ผู้อื่น
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default BackupPanel;
