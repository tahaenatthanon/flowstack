import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AtSign, Search, CheckCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface ChangeItem {
  from: string;
  to: string;
  count: number;
}

interface NoMatchItem {
  value: string;
  count: number;
}

interface ScanResult {
  dry_run: boolean;
  changes: ChangeItem[];
  no_match: NoMatchItem[];
  applied: boolean;
}

export default function FixAssigneeEmailsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [applying, setApplying] = useState(false);

  const scan = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch<ScanResult>('/fix-assignee-emails.php', {
        method: 'POST',
        body: JSON.stringify({ dry_run: true }),
      });
      setResult(data);
    } catch (err: any) {
      toast({ title: 'สแกนล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const applyFix = async () => {
    setApplying(true);
    try {
      const data = await apiFetch<ScanResult>('/fix-assignee-emails.php', {
        method: 'POST',
        body: JSON.stringify({ dry_run: false }),
      });
      setResult(data);
      // Invalidate all task-related queries so UI refreshes
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['resource-workload'] });
      toast({ title: 'ปรับปรุงข้อมูลสำเร็จ', description: `อัปเดต ${data.changes.length} รูปแบบ ใน transaction ทั้งหมด` });
    } catch (err: any) {
      toast({ title: 'ปรับปรุงล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const totalTasks = result?.changes.reduce((s, c) => s + c.count, 0) ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AtSign className="h-5 w-5" />
          ปรับปรุงข้อมูลอีเมลใน Transaction
        </CardTitle>
        <CardDescription>
          งาน (tasks) บางรายการอาจบันทึกผู้รับผิดชอบ (assignee) เป็นอีเมลหรือ alias แทนที่จะเป็นชื่อแสดงผล
          เครื่องมือนี้จะค้นหาและแปลงค่าเหล่านั้นให้เป็นชื่อที่ถูกต้องโดยอัตโนมัติ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={scan} disabled={loading || applying} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'กำลังสแกน...' : 'สแกนหาข้อมูล'}
          </Button>
          {result && !result.applied && result.changes.length > 0 && (
            <Button onClick={applyFix} disabled={applying} variant="default" className="gap-2 bg-green-600 hover:bg-green-700">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              {applying ? 'กำลังปรับปรุง...' : `ปรับปรุงข้อมูล ${totalTasks} งาน`}
            </Button>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary */}
            {result.applied ? (
              <Alert className="border-green-500/30 bg-green-500/10">
                <CheckCheck className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  ปรับปรุงสำเร็จ! อัปเดต {result.changes.length} รูปแบบ รวม {totalTasks} งาน
                </AlertDescription>
              </Alert>
            ) : result.changes.length === 0 && result.no_match.length === 0 ? (
              <Alert>
                <CheckCheck className="h-4 w-4" />
                <AlertDescription>ข้อมูลทั้งหมดถูกต้องแล้ว ไม่พบค่าที่ต้องแก้ไข</AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-yellow-500/30 bg-yellow-500/10">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                  พบ {result.changes.length} รูปแบบที่ต้องแก้ไข รวม {totalTasks} งาน
                  กด <strong>ปรับปรุงข้อมูล</strong> เพื่อดำเนินการ
                </AlertDescription>
              </Alert>
            )}

            {/* Changes Table */}
            {result.changes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">
                  รายการที่{result.applied ? 'อัปเดตแล้ว' : 'จะถูกแก้ไข'}
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ค่าเดิม (อีเมล / alias)</TableHead>
                      <TableHead>ค่าใหม่ (ชื่อแสดงผล)</TableHead>
                      <TableHead className="text-right">จำนวนงาน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.changes.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <span className="font-mono text-sm text-muted-foreground">{c.from}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{c.to}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{c.count}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Unresolvable emails */}
            {result.no_match.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  อีเมลที่ไม่พบในระบบ (ไม่สามารถแก้ไขได้)
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>อีเมล</TableHead>
                      <TableHead className="text-right">จำนวนงาน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.no_match.map((n, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <span className="font-mono text-sm">{n.value}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">{n.count}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-2">
                  อีเมลเหล่านี้ไม่ตรงกับผู้ใช้หรือ alias ในระบบ ให้เพิ่ม alias ก่อน แล้วสแกนใหม่
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
