// src/components/SurveyResponseDetailDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SURVEY_PRIORITY_LABELS } from '@/lib/labels';
import { Lightbulb, AlertTriangle, TrendingUp, Target, DollarSign, Crosshair } from 'lucide-react';
import { useSurveyResponse } from '@/hooks/useSurveys';
interface Props {
  responseId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface RecItem {
  icon: typeof Lightbulb;
  color: string;
  title: string;
  detail: string;
}

function generateRecommendations(response: any): RecItem[] {
  const recs: RecItem[] = [];
  const answers: any[] = response?.answers ?? [];
  const score: number = response?.pain_point_score ?? 0;
  const priority: string = response?.pain_priority ?? '';

  // ── 1. Deal Probability Assessment ──────────────────────────────────────────
  if (priority === 'critical') {
    recs.push({
      icon: DollarSign, color: 'text-emerald-600',
      title: 'โอกาสปิดการขายสูงมาก (≥80%)',
      detail: 'ลูกค้ามีปัญหาเร่งด่วนระดับวิกฤต — Pain Point ชัดเจนและมี Impact สูง แนะนำให้ติดต่อกลับภายใน 24-48 ชั่วโมง พร้อมข้อเสนอ Solution ที่แก้ปัญหาโดยตรง เน้น ROI และความเร่งด่วนในการแก้ไข',
    });
  } else if (priority === 'high') {
    recs.push({
      icon: TrendingUp, color: 'text-green-600',
      title: 'โอกาสปิดการขายสูง (60-79%)',
      detail: 'ลูกค้าตระหนักถึงปัญหาและต้องการแก้ไข — ควรนำเสนอ Solution ภายใน 1 สัปดาห์ ใช้ Case Study จากอุตสาหกรรมเดียวกันเพื่อสร้างความเชื่อมั่น เน้นผลลัพธ์ที่จับต้องได้',
    });
  } else if (priority === 'medium') {
    recs.push({
      icon: Target, color: 'text-amber-600',
      title: 'โอกาสปิดการขายปานกลาง (40-59%)',
      detail: 'ลูกค้ามีปัญหาบางส่วนแต่อาจยังไม่รู้สึกเร่งด่วน — ควร Nurture ด้วยเนื้อหาที่ให้ความรู้ เช่น Case Study, ROI Calculator, หรือ Industry Report นัด Follow-up Call ใน 2-4 สัปดาห์',
    });
  } else {
    recs.push({
      icon: Lightbulb, color: 'text-slate-500',
      title: 'โอกาสปิดการขายต่ำ (<40%)',
      detail: 'ลูกค้ายังไม่มี Pain Point ที่ชัดเจน — ควรติดตามระยะยาวผ่าน Email Campaign หรือ Newsletter รอจังหวะที่ลูกค้าเริ่มมีปัญหาจึงค่อยเสนอ Solution อีกครั้ง',
    });
  }

  // ── 2. Critical Pain Point Analysis ─────────────────────────────────────────
  const criticalQuestions = answers.filter((a: any) => Number(a.is_critical ?? 0) === 1);
  const criticalHigh = criticalQuestions.filter((a: any) => Number(a.score_contribution ?? 0) > 0);
  const criticalZero = criticalQuestions.filter((a: any) => Number(a.score_contribution ?? 0) === 0);

  if (criticalHigh.length >= 2) {
    recs.push({
      icon: AlertTriangle, color: 'text-red-500',
      title: `พบ ${criticalHigh.length} ปัญหาวิกฤตที่ลูกค้ากำลังเผชิญ`,
      detail: criticalHigh.map((a: any) => `• ${a.question_text}`).join('\n') + '\n\nปัญหาเหล่านี้คือ "Pain Point" หลักที่ใช้เป็นจุดขาย — ลูกค้ามีแนวโน้มตัดสินใจซื้อสูงหากคุณนำเสนอ Solution ที่แก้ปัญหาเหล่านี้ได้โดยตรง',
    });
  }

  if (criticalZero.length > 0 && criticalHigh.length === 0) {
    recs.push({
      icon: AlertTriangle, color: 'text-orange-500',
      title: 'ลูกค้ายังไม่มีปัญหาในด้าน Critical',
      detail: 'ลูกค้าอาจยังไม่เห็นความสำคัญของปัญหาในมิติที่ Critical — ควรให้ความรู้และสร้าง Awareness ก่อนนำเสนอ Solution เพราะปัญหาที่ยังไม่เกิด = ความต้องการซื้อยังไม่เกิด',
    });
  }

  // ── 3. Top Pain Points for Sales Pitch ──────────────────────────────────────
  const sortedByScore = [...answers]
    .filter((a: any) => Number(a.score_contribution ?? 0) > 0)
    .sort((a, b) => Number(b.score_contribution ?? 0) - Number(a.score_contribution ?? 0))
    .slice(0, 3);

  if (sortedByScore.length > 0) {
    recs.push({
      icon: Crosshair, color: 'text-blue-600',
      title: 'ประเด็นที่ควรใช้ในการขาย (Top Pain Points)',
      detail: sortedByScore.map((a: any, i: number) =>
        `${i + 1}. ${a.question_text} (คะแนน: ${a.score_contribution}%)`
      ).join('\n') + '\n\nใช้ประเด็นเหล่านี้เปิดบทสนทนาและนำเสนอ Solution — เป็นปัญหาที่ลูกค้าให้คะแนนสูงที่สุด แสดงถึงความต้องการแก้ไขอย่างแท้จริง',
    });
  }

  // ── 4. Buying Signal Analysis ───────────────────────────────────────────────
  const answeredQuestions = answers.length;
  const positiveAnswers = answers.filter((a: any) => {
    const qtype = a.question_type;
    const val = a.answer_value;
    if (qtype === 'yes_no') return val === 'yes';
    if (qtype === 'scale_1_5') return Number(val) >= 4;
    return false;
  }).length;

  if (positiveAnswers >= answeredQuestions * 0.6) {
    recs.push({
      icon: TrendingUp, color: 'text-indigo-600',
      title: 'สัญญาณการซื้อ: เชิงบวก',
      detail: `${positiveAnswers} จาก ${answeredQuestions} ข้อที่ลูกค้าตอบในทิศทางบวก (≥60%) — ลูกค้ารับรู้ถึงปัญหาและเปิดใจรับการแก้ไข เป็นสัญญาณที่ดีในการเข้าพบเพื่อปิดการขาย`,
    });
  } else if (positiveAnswers <= answeredQuestions * 0.3 && answeredQuestions > 0) {
    recs.push({
      icon: AlertTriangle, color: 'text-amber-600',
      title: 'สัญญาณการซื้อ: ต้องสร้างการรับรู้เพิ่ม',
      detail: `มีเพียง ${positiveAnswers} จาก ${answeredQuestions} ข้อที่ลูกค้าตอบในทิศทางบวก (≤30%) — ลูกค้าอาจยังไม่ตระหนักถึงปัญหา ควรใช้การ Consultative Selling เพื่อสร้าง Pain Awareness ก่อนปิดการขาย`,
    });
  }

  return recs;
}

const STATUS: Record<string, string> = { completed: 'เสร็จ', in_progress: 'กำลังทำ', pending: 'รอ' };
const PRIORITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};
const TYPE_LABEL: Record<string, string> = { yes_no: 'ใช่/ไม่ใช่', scale_1_5: 'คะแนน 1-5', multiple_choice: 'หลายตัวเลือก', text: 'ข้อความอิสระ' };

function formatAnswer(value: string, qtype: string, optionsJson: any): string {
  if (qtype === 'yes_no') return value === 'yes' ? 'ใช่' : value === 'no' ? 'ไม่ใช่' : value;
  if (qtype === 'scale_1_5') return `${value} / 5`;
  if (qtype === 'multiple_choice' && optionsJson) {
    let opts: any[] = [];
    try { opts = typeof optionsJson === 'string' ? JSON.parse(optionsJson) : optionsJson; } catch { return value; }
    const found = opts.find((o: any) => o.value === value);
    return found ? found.label : value;
  }
  return value || '-';
}

export function SurveyResponseDetailDialog({ responseId, open, onOpenChange }: Props) {
  const { data: response, isLoading } = useSurveyResponse(open ? responseId : null);
  const answers = response?.answers ?? [];
  const tpl = response?.template;

  const recs = response ? generateRecommendations(response) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-3xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ผลการตอบแบบสอบถาม</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-muted-foreground text-sm py-4">กำลังโหลด...</p>
        ) : !response ? null : (
          <div className="space-y-6 py-2">
            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Template</p>
                <p className="text-sm font-medium">{tpl?.name ?? '-'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">บริษัท</p>
                <p className="text-sm font-medium">{response.company_name || response.company_id}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">สถานะ</p>
                <Badge variant="outline" className="text-xs">{STATUS[response.status] ?? response.status}</Badge>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">ส่งเมื่อ</p>
                <p className="text-sm">{response.submitted_at ? new Date(response.submitted_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</p>
              </div>
            </div>

            {/* Score summary */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums">{response.pain_point_score ?? '-'}%</p>
                <p className="text-xs text-muted-foreground">Pain Score</p>
              </div>
              <div>
                {response.pain_priority && (
                  <Badge className={PRIORITY_COLOR[response.pain_priority] ?? ''}>
                    ระดับ{SURVEY_PRIORITY_LABELS[response.pain_priority]}
                  </Badge>
                )}
              </div>
            </div>

            {/* Answers table */}
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>คำถาม</TableHead>
                    <TableHead className="w-24">ประเภท</TableHead>
                    <TableHead className="w-32">คำตอบ</TableHead>
                    <TableHead className="w-20 text-right">คะแนน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {answers.map((a: any, i: number) => {
                    const isLow = Number(a.score_contribution ?? 0) <= (Number(a.max_score ?? 5) * 0.3);
                    return (
                      <TableRow key={a.id ?? i}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm">
                          {a.question_text}
                          {a.is_critical === 1 && (
                            <Badge className="ml-2 text-xs bg-red-100 text-red-700 border-red-200">Critical</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{TYPE_LABEL[a.question_type] ?? a.question_type}</TableCell>
                        <TableCell className="text-sm">{formatAnswer(a.answer_value, a.question_type, a.options_json)}</TableCell>
                        <TableCell className={`text-right text-sm tabular-nums ${isLow ? 'text-red-600 font-medium' : ''}`}>
                          {a.score_contribution != null ? a.score_contribution + '%' : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Recommendations */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                คำแนะนำ
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recs.map((rec, i) => {
                  const Icon = rec.icon;
                  return (
                    <Card key={i} className="border-l-4" style={{ borderLeftColor: rec.color.replace('text-', '') }}>
                      <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${rec.color}`} />
                          <span className={rec.color}>{rec.title}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <p className="text-xs text-muted-foreground whitespace-pre-line">{rec.detail}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
