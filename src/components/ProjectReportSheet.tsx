import { useMemo, useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Printer, Mail, CheckCircle2, Clock, AlertTriangle, Circle, Loader2, Headphones } from 'lucide-react';
import { useAllTasks, useCompanySettings } from '@/hooks/useProjectData';
import { calculateProjectReport, deriveProjectStatus, getStatusLabel } from '@/lib/projectUtils';
import { format, endOfMonth, startOfMonth } from 'date-fns';
import { th } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';

// ─── constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  completed:    'bg-green-100 text-green-700',
  'in-progress':'bg-blue-100 text-blue-700',
  pending:      'bg-gray-100 text-gray-600',
  'on-hold':    'bg-yellow-100 text-yellow-700',
  overdue:      'bg-red-100 text-red-700',
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: format(new Date(2000, i, 1), 'MMMM', { locale: th }),
}));

const TICKET_STATUS_LABEL: Record<string, string> = {
  open: 'เปิด', 'in-progress': 'กำลังดำเนินการ',
  pending: 'รอ', resolved: 'แก้ไขแล้ว', closed: 'ปิด',
};
const TICKET_STATUS_COLOR: Record<string, string> = {
  open: 'bg-red-100 text-red-700', 'in-progress': 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700', resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};
const PRIORITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700', low: 'bg-gray-100 text-gray-600',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(d?: string | null) {
  if (!d) return '-';
  try { return format(new Date(d), 'd MMM yyyy', { locale: th }); } catch { return d; }
}
function fmtH(h: number) { return h.toFixed(1) + ' ชม.'; }

// ─── EmailDialog ──────────────────────────────────────────────────────────────

function EmailDialog({
  open, onClose, project, periodLabel, buildHtml,
}: {
  open: boolean; onClose: () => void;
  project: any; periodLabel: string; buildHtml: () => string;
}) {
  const { toast } = useToast();
  const [to, setTo]           = useState(() => project?.customer_email || project?.company_email || '');
  const [subject, setSubject] = useState(`รายงานโปรเจกต์ ${project?.name} — ${periodLabel}`);
  const [note, setNote]       = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) { toast({ title: 'กรุณาระบุอีเมลผู้รับ', variant: 'destructive' }); return; }
    setSending(true);
    try {
      await apiFetch('/report-email.php', {
        method: 'POST',
        body: JSON.stringify({ to: to.trim(), subject, html_body: buildHtml(), note }),
      });
      toast({ title: 'ส่งอีเมลสำเร็จ' });
      onClose();
    } catch (e: any) {
      toast({ title: 'ส่งอีเมลไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader><DialogTitle>ส่งอีเมลรายงาน</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>ถึง (อีเมล)</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="example@company.com" className="mt-1" /></div>
          <div><Label>หัวข้อ</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1" /></div>
          <div><Label>ข้อความเพิ่มเติม (ไม่บังคับ)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="mt-1" placeholder="ข้อความแนบท้าย..." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
            ส่งอีเมล
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { project: any | null; onClose: () => void; }

export default function ProjectReportSheet({ project, onClose }: Props) {
  const open = !!project;
  const [mode, setMode]   = useState<'monthly' | 'yearly' | 'project' | 'custom'>('project');
  const [year, setYear]   = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [customFrom, setCustomFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customTo, setCustomTo]     = useState(format(new Date(), 'yyyy-MM-dd'));
  const [emailOpen, setEmailOpen]   = useState(false);
  const [tickets, setTickets]       = useState<any[]>([]);

  const currentYear  = new Date().getFullYear();
  const yearOptions  = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  // Company settings (logo)
  const { data: companySettings } = useCompanySettings();

  // Date range
  const { dateFrom, dateTo } = useMemo(() => {
    if (mode === 'monthly') {
      const d = new Date(year, month - 1, 1);
      return { dateFrom: format(startOfMonth(d), 'yyyy-MM-dd'), dateTo: format(endOfMonth(d), 'yyyy-MM-dd') };
    }
    if (mode === 'yearly')  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
    if (mode === 'custom')  return { dateFrom: customFrom, dateTo: customTo };
    return {
      dateFrom: project?.start_date ?? format(new Date(), 'yyyy-MM-dd'),
      dateTo:   project?.end_date   ?? format(new Date(), 'yyyy-MM-dd'),
    };
  }, [mode, year, month, customFrom, customTo, project?.start_date, project?.end_date]);

  // Tasks
  const { data: tasksPage    = { data: [] } } = useAllTasks({ per_page: 5000, year_from: dateFrom, year_to: dateTo }, open);
  const { data: allTasksPage = { data: [] } } = useAllTasks({ per_page: 5000 }, open);

  const projectTasks = useMemo(() =>
    tasksPage.data.filter(t => t.project_id === project?.id && !t.parent_task_id),
    [tasksPage.data, project?.id]);

  const allProjectTasks = useMemo(() =>
    allTasksPage.data.filter(t => t.project_id === project?.id && !t.parent_task_id),
    [allTasksPage.data, project?.id]);

  const report        = useMemo(() => project ? calculateProjectReport(project, allProjectTasks) : null, [project, allProjectTasks]);
  const derivedStatus = useMemo(() => project && report ? deriveProjectStatus(project, report) : 'pending', [project, report]);

  // Counts
  const periodCounts = useMemo(() => ({
    completed:  projectTasks.filter(t => t.status === 'completed').length,
    inProgress: projectTasks.filter(t => t.status === 'in-progress').length,
    pending:    projectTasks.filter(t => t.status === 'pending').length,
    overdue:    projectTasks.filter(t => t.status !== 'completed' && t.end_date && new Date(t.end_date) < new Date()).length,
  }), [projectTasks]);

  // Hours from tasks
  const totalActual    = useMemo(() => projectTasks.reduce((s, t) => s + Number(t.actual_hours    || 0), 0), [projectTasks]);
  const totalEstimated = useMemo(() => projectTasks.reduce((s, t) => s + Number(t.estimated_hours || 0), 0), [projectTasks]);

  // Monthly data (yearly mode)
  const monthlyData = useMemo(() => {
    if (mode !== 'yearly') return [];
    const rows = Array.from({ length: 12 }, (_, i) => ({
      label: format(new Date(year, i, 1), 'MMM', { locale: th }),
      actual: 0, estimated: 0, completed: 0,
    }));
    projectTasks.forEach(t => {
      const m = t.start_date ? parseInt(t.start_date.slice(5, 7), 10) - 1 : -1;
      if (m >= 0 && m < 12) {
        rows[m].actual    += Number(t.actual_hours    || 0);
        rows[m].estimated += Number(t.estimated_hours || 0);
      }
      if (t.status === 'completed' && t.end_date) {
        const mc = parseInt(t.end_date.slice(5, 7), 10) - 1;
        if (mc >= 0 && mc < 12) rows[mc].completed++;
      }
    });
    return rows;
  }, [mode, year, projectTasks]);

  // Support tickets for this project's company
  useEffect(() => {
    if (!open || !project?.company_id) { setTickets([]); return; }
    apiFetch(`/support-tickets.php?company_id=${project.company_id}&limit=20`)
      .then(data => setTickets(Array.isArray(data) ? data : (data?.data ?? [])))
      .catch(() => setTickets([]));
  }, [open, project?.company_id]);

  const periodLabel =
    mode === 'monthly' ? format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: th }) :
    mode === 'yearly'  ? `ปี ${year}` :
    mode === 'project' ? 'ตลอดโครงการ' :
    `${customFrom} – ${customTo}`;

  // ── Build email HTML ────────────────────────────────────────────────────────
  const buildEmailHtml = (): string => {
    const logoUrl    = companySettings?.logo_url || '';
    const orgName    = companySettings?.company_name || 'FlowStack';
    const pct        = report?.completionPercentage ?? 0;
    const STATUS_LABELS: Record<string, string> = {
      completed: 'เสร็จแล้ว', 'in-progress': 'กำลังทำ', pending: 'รอ', 'on-hold': 'พักไว้', overdue: 'เกิน',
    };
    const STATUS_BG: Record<string, string>    = { completed:'#dcfce7','in-progress':'#dbeafe',pending:'#f3f4f6','on-hold':'#fef3c7',overdue:'#fee2e2' };
    const STATUS_COLOR: Record<string, string> = { completed:'#16a34a','in-progress':'#2563eb',pending:'#6b7280','on-hold':'#d97706',overdue:'#dc2626' };

    const taskRows = projectTasks.map(t => {
      const est  = Number(t.estimated_hours || 0);
      const act  = Number(t.actual_hours    || 0);
      const sl   = STATUS_LABELS[t.status] ?? t.status;
      const sBg  = STATUS_BG[t.status]    ?? '#f3f4f6';
      const sCol = STATUS_COLOR[t.status] ?? '#374151';
      const who  = t.assignee || t.user_display_name || '-';
      return `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:9px 14px;font-size:13px">${t.title}</td>
        <td style="padding:9px 14px;font-size:12px;color:#6b7280">${who}</td>
        <td style="padding:9px 14px">
          <span style="font-size:11px;padding:2px 8px;border-radius:4px;font-weight:600;background:${sBg};color:${sCol}">${sl}</span>
        </td>
        <td style="padding:9px 14px;font-size:12px;color:#6b7280;white-space:nowrap">${fmt(t.end_date)}</td>
        <td style="padding:9px 14px;font-size:12px;text-align:right;color:#16a34a;font-weight:600">${act.toFixed(1)}</td>
        <td style="padding:9px 14px;font-size:12px;text-align:right;color:#6b7280">${est.toFixed(1)}</td>
      </tr>`;
    }).join('');

    const ticketRows = tickets.slice(0, 10).map(t => {
      const tsBg  = t.status === 'resolved' || t.status === 'closed' ? '#dcfce7' : '#fee2e2';
      const tsCol = t.status === 'resolved' || t.status === 'closed' ? '#16a34a' : '#dc2626';
      const tsLbl = TICKET_STATUS_LABEL[t.status] ?? t.status;
      return `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:9px 14px;font-size:13px">${t.ticket_number ?? ''}</td>
        <td style="padding:9px 14px;font-size:13px;max-width:240px">${t.title}</td>
        <td style="padding:9px 14px">
          <span style="font-size:11px;padding:2px 8px;border-radius:4px;font-weight:600;background:${tsBg};color:${tsCol}">${tsLbl}</span>
        </td>
        <td style="padding:9px 14px;font-size:12px;color:#6b7280;white-space:nowrap">${fmt(t.created_at)}</td>
        <td style="padding:9px 14px;font-size:12px;color:#6b7280;white-space:nowrap">${fmt(t.resolved_at)}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Prompt',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
<tr><td align="center">
<table width="800" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 36px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${logoUrl ? `<td width="80" style="vertical-align:middle;padding-right:20px">
          <img src="${logoUrl}" alt="logo" style="height:56px;width:auto;object-fit:contain;background:#fff;border-radius:6px;padding:4px">
        </td>` : ''}
        <td style="vertical-align:middle">
          <p style="margin:0 0 2px;font-size:11px;color:#93c5fd;letter-spacing:.08em;text-transform:uppercase">${orgName} · รายงานโปรเจกต์</p>
          <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#fff;line-height:1.3">${project.name}</h1>
          ${project.company_name ? `<p style="margin:0;font-size:13px;color:#bfdbfe">${project.company_name}</p>` : ''}
        </td>
        <td style="text-align:right;vertical-align:middle;white-space:nowrap">
          <p style="margin:0 0 4px;font-size:11px;color:#93c5fd">ช่วงเวลา</p>
          <p style="margin:0;font-size:13px;color:#fff;font-weight:600">${periodLabel}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#bfdbfe">${dateFrom} – ${dateTo}</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Meta row -->
  <tr><td style="padding:14px 36px;background:#f8fafc;border-bottom:1px solid #e2e8f0">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${project.start_date ? `<td style="font-size:12px;color:#64748b;padding-right:32px"><b style="color:#374151;display:block">วันเริ่มต้น</b>${fmt(project.start_date)}</td>` : ''}
        ${project.end_date   ? `<td style="font-size:12px;color:#64748b;padding-right:32px"><b style="color:#374151;display:block">วันสิ้นสุด</b>${fmt(project.end_date)}</td>` : ''}
        ${project.manager_name ? `<td style="font-size:12px;color:#64748b;padding-right:32px"><b style="color:#374151;display:block">ผู้รับผิดชอบ</b>${project.manager_name}</td>` : ''}
        ${project.creator_name ? `<td style="font-size:12px;color:#64748b"><b style="color:#374151;display:block">ผู้สร้าง</b>${project.creator_name}</td>` : ''}
      </tr>
    </table>
  </td></tr>

  <!-- Stat cards -->
  <tr><td style="padding:24px 36px">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="32%" style="background:#f0f9ff;border-radius:10px;padding:16px;text-align:center;vertical-align:top">
          <p style="margin:0 0 4px;font-size:11px;color:#64748b">ความคืบหน้า</p>
          <p style="margin:0 0 8px;font-size:30px;font-weight:700;color:#2563eb">${pct}%</p>
          <div style="background:#dbeafe;border-radius:4px;height:6px;overflow:hidden">
            <div style="background:#2563eb;height:6px;width:${Math.min(pct,100)}%"></div>
          </div>
          <p style="margin:6px 0 0;font-size:11px;color:#64748b">${report?.daysUsed ?? 0} / ${report?.totalDays ?? 0} วัน</p>
        </td>
        <td width="2%"></td>
        <td width="32%" style="background:#f0fdf4;border-radius:10px;padding:16px;text-align:center;vertical-align:top">
          <p style="margin:0 0 4px;font-size:11px;color:#64748b">งานในช่วง</p>
          <p style="margin:0 0 4px;font-size:30px;font-weight:700;color:#16a34a">${projectTasks.length} งาน</p>
          <p style="margin:0;font-size:11px;color:#16a34a">✓ ${periodCounts.completed} เสร็จ &nbsp;● ${periodCounts.inProgress} กำลังทำ</p>
          ${periodCounts.overdue > 0 ? `<p style="margin:4px 0 0;font-size:11px;color:#dc2626">⚠ ${periodCounts.overdue} เกินกำหนด</p>` : ''}
        </td>
        <td width="2%"></td>
        <td width="32%" style="background:#fefce8;border-radius:10px;padding:16px;text-align:center;vertical-align:top">
          <p style="margin:0 0 4px;font-size:11px;color:#64748b">ชั่วโมงงาน</p>
          <p style="margin:0 0 4px;font-size:30px;font-weight:700;color:#ca8a04">${totalActual.toFixed(1)} ชม.</p>
          <p style="margin:0;font-size:11px;color:#64748b">ประมาณ ${totalEstimated.toFixed(1)} ชม.</p>
          ${totalEstimated > 0 ? `<div style="background:#fef9c3;border-radius:4px;height:6px;overflow:hidden;margin-top:8px">
            <div style="background:#ca8a04;height:6px;width:${Math.min(totalEstimated>0?(totalActual/totalEstimated)*100:0,100)}%"></div>
          </div>` : ''}
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Task table -->
  ${projectTasks.length > 0 ? `
  <tr><td style="padding:0 36px 28px">
    <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b">ความคืบหน้างาน</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;text-align:left">ชื่องาน</th>
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;text-align:left">ผู้รับผิดชอบ</th>
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;text-align:left">สถานะ</th>
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;text-align:left">วันกำหนด</th>
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#16a34a;text-align:right">ชม.จริง</th>
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;text-align:right">ชม.ประมาณ</th>
        </tr>
      </thead>
      <tbody>
        ${taskRows}
        <tr style="background:#f8fafc;border-top:2px solid #e5e7eb">
          <td colspan="4" style="padding:10px 14px;font-size:13px;font-weight:700;color:#1e293b">รวมทั้งหมด</td>
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#16a34a;text-align:right">${totalActual.toFixed(1)} ชม.</td>
          <td style="padding:10px 14px;font-size:13px;font-weight:700;text-align:right">${totalEstimated.toFixed(1)} ชม.</td>
        </tr>
      </tbody>
    </table>
  </td></tr>` : ''}

  <!-- Support tickets -->
  ${tickets.length > 0 ? `
  <tr><td style="padding:0 36px 28px">
    <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1e293b">รายละเอียดการแก้ปัญหา (Support)</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;text-align:left">เลขที่</th>
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;text-align:left">หัวข้อ</th>
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;text-align:left">สถานะ</th>
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;text-align:left">วันที่เปิด</th>
          <th style="padding:10px 14px;font-size:12px;font-weight:600;color:#374151;text-align:left">วันที่แก้ไข</th>
        </tr>
      </thead>
      <tbody>${ticketRows}</tbody>
    </table>
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="padding:18px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
    <p style="margin:0;font-size:11px;color:#94a3b8">สร้างโดย ${orgName} · ${format(new Date(), 'd MMM yyyy HH:mm', { locale: th })}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
  };

  if (!project) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={o => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-4xl flex flex-col p-0 overflow-hidden">

          {/* ── Header ── */}
          <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            {/* Title row */}
            <div className="flex items-start gap-4">
              {companySettings?.logo_url && (
                <img src={companySettings.logo_url} alt="logo"
                  className="h-10 w-auto object-contain rounded shrink-0 mt-0.5 bg-muted/30 p-1" />
              )}
              <div className="flex-1 min-w-0">
                <SheetTitle className="truncate text-lg leading-tight">{project.name}</SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {project.company_name && <span className="font-medium">{project.company_name}</span>}
                  {project.start_date && <span> · {fmt(project.start_date)} – {fmt(project.end_date)}</span>}
                  {project.manager_name && <span> · {project.manager_name}</span>}
                </p>
              </div>
              <Badge className={`${STATUS_BADGE[derivedStatus] || 'bg-muted text-muted-foreground'} shrink-0 mt-1`}>
                {getStatusLabel(derivedStatus)}
              </Badge>
            </div>

            {/* Period controls */}
            <div className="flex items-center gap-2 flex-wrap mt-3">
              <div className="flex rounded-md border overflow-hidden text-sm">
                {(['project','monthly','yearly','custom'] as const).map(m => (
                  <button key={m}
                    className={`px-3 py-1.5 font-medium transition-colors border-r last:border-r-0 ${mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    onClick={() => setMode(m)}>
                    {m === 'project' ? 'ตามโครงการ' : m === 'monthly' ? 'รายเดือน' : m === 'yearly' ? 'รายปี' : 'กำหนดเอง'}
                  </button>
                ))}
              </div>
              {(mode === 'monthly' || mode === 'yearly') && (
                <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
                  <SelectTrigger className="h-8 w-24 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {mode === 'monthly' && (
                <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
                  <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {mode === 'custom' && (
                <div className="flex items-center gap-1.5 text-sm">
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className="h-8 rounded border px-2 text-sm bg-background" />
                  <span className="text-muted-foreground">–</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    className="h-8 rounded border px-2 text-sm bg-background" />
                </div>
              )}
              <span className="text-xs text-muted-foreground">{periodLabel} · {dateFrom} – {dateTo}</span>
            </div>
          </SheetHeader>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-4 space-y-1.5">
                <p className="text-xs text-muted-foreground">ความคืบหน้า</p>
                <p className="text-3xl font-bold text-primary">{report?.completionPercentage ?? 0}%</p>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${report?.completionPercentage ?? 0}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{report?.daysUsed ?? 0} / {report?.totalDays ?? 0} วัน</p>
              </div>
              <div className="rounded-lg border p-4 space-y-1.5">
                <p className="text-xs text-muted-foreground">งานในช่วง ({periodLabel})</p>
                <p className="text-3xl font-bold">{projectTasks.length}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" />{periodCounts.completed} เสร็จ</span>
                  <span className="flex items-center gap-1 text-blue-600"><Clock className="h-3 w-3" />{periodCounts.inProgress} กำลังทำ</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><Circle className="h-3 w-3" />{periodCounts.pending} รอ</span>
                  {periodCounts.overdue > 0 && <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" />{periodCounts.overdue} เกิน</span>}
                </div>
              </div>
              <div className="rounded-lg border p-4 space-y-1.5">
                <p className="text-xs text-muted-foreground">ชั่วโมงงาน ({periodLabel})</p>
                <p className="text-3xl font-bold text-green-600">{fmtH(totalActual)}</p>
                <p className="text-xs text-muted-foreground">ประมาณ {fmtH(totalEstimated)}</p>
                {totalEstimated > 0 && (
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, (totalActual / totalEstimated) * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>

            {/* Task table */}
            <div>
              <h3 className="text-sm font-semibold mb-3">ความคืบหน้างาน ({periodLabel})</h3>
              {projectTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg">ไม่มีงานในช่วงนี้</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2 font-medium text-xs">ชื่องาน</th>
                        <th className="text-left px-3 py-2 font-medium text-xs hidden sm:table-cell">ผู้รับผิดชอบ</th>
                        <th className="text-left px-3 py-2 font-medium text-xs">สถานะ</th>
                        <th className="text-left px-3 py-2 font-medium text-xs hidden sm:table-cell">วันกำหนด</th>
                        <th className="text-right px-3 py-2 font-medium text-xs text-green-600">ชม.จริง</th>
                        <th className="text-right px-3 py-2 font-medium text-xs">ชม.ประมาณ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {projectTasks.map((t: any) => (
                        <tr key={t.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 max-w-[200px] truncate text-xs">{t.title}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{t.assignee || t.user_display_name || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[t.status] || 'bg-muted text-muted-foreground'}`}>
                              {getStatusLabel(t.status)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{fmt(t.end_date)}</td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-green-600 tabular-nums">
                            {Number(t.actual_hours || 0).toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
                            {Number(t.estimated_hours || 0).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="px-3 py-2 text-xs" colSpan={4}>รวมทั้งหมด</td>
                        <td className="px-3 py-2 text-right text-xs text-green-600 tabular-nums">{totalActual.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{totalEstimated.toFixed(1)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Monthly breakdown (yearly) */}
            {mode === 'yearly' && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3">สรุปรายเดือน (ปี {year})</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-3 py-2 font-medium text-xs">เดือน</th>
                          <th className="text-right px-3 py-2 font-medium text-xs text-green-600">ชม.จริง</th>
                          <th className="text-right px-3 py-2 font-medium text-xs">ชม.ประมาณ</th>
                          <th className="text-right px-3 py-2 font-medium text-xs">งานเสร็จ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {monthlyData.map((row, i) => (
                          <tr key={i} className={`hover:bg-muted/20 ${row.actual === 0 && row.estimated === 0 && row.completed === 0 ? 'opacity-40' : ''}`}>
                            <td className="px-3 py-1.5 text-xs font-medium">{row.label}</td>
                            <td className="px-3 py-1.5 text-right text-xs text-green-600 tabular-nums">{row.actual > 0 ? fmtH(row.actual) : '-'}</td>
                            <td className="px-3 py-1.5 text-right text-xs text-muted-foreground tabular-nums">{row.estimated > 0 ? fmtH(row.estimated) : '-'}</td>
                            <td className="px-3 py-1.5 text-right text-xs">{row.completed > 0 ? row.completed : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Support tickets */}
            {tickets.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-muted-foreground" />
                    รายละเอียดการแก้ปัญหา — Support ({tickets.length} รายการ)
                  </h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-3 py-2 font-medium text-xs">เลขที่</th>
                          <th className="text-left px-3 py-2 font-medium text-xs">หัวข้อ</th>
                          <th className="text-left px-3 py-2 font-medium text-xs">ประเภท</th>
                          <th className="text-left px-3 py-2 font-medium text-xs">สถานะ</th>
                          <th className="text-left px-3 py-2 font-medium text-xs hidden sm:table-cell">วันที่เปิด</th>
                          <th className="text-left px-3 py-2 font-medium text-xs hidden sm:table-cell">แก้ไขแล้ว</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {tickets.map((t: any) => (
                          <tr key={t.id} className="hover:bg-muted/20">
                            <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{t.ticket_number}</td>
                            <td className="px-3 py-2 text-xs max-w-[200px] truncate">{t.title}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{t.ticket_type || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${TICKET_STATUS_COLOR[t.status] || 'bg-muted text-muted-foreground'}`}>
                                {TICKET_STATUS_LABEL[t.status] || t.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{fmt(t.created_at)}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">{fmt(t.resolved_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <SheetFooter className="px-6 py-4 border-t shrink-0 flex-row gap-2 justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" />พิมพ์ / PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)}>
                <Mail className="h-4 w-4 mr-1" />ส่งอีเมล
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {emailOpen && (
        <EmailDialog
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          project={project}
          periodLabel={periodLabel}
          buildHtml={buildEmailHtml}
        />
      )}
    </>
  );
}
