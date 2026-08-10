import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Info, ChevronDown, ChevronRight, Database } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

// ─── Sheet definitions ────────────────────────────────────────────────────────

const SHEETS = [
  { key: 'companies',     name: 'Companies',     label: 'บริษัท',         icon: '🏢' },
  { key: 'customers',     name: 'Customers',     label: 'ลูกค้า/ติดต่อ', icon: '👤' },
  { key: 'projects',      name: 'Projects',      label: 'โปรเจกต์',       icon: '📁' },
  { key: 'tasks',         name: 'Tasks',         label: 'งาน',            icon: '✅' },
  { key: 'subtasks',      name: 'Subtasks',      label: 'งานย่อย',        icon: '📌' },
  { key: 'opportunities', name: 'Opportunities', label: 'โอกาสการขาย',   icon: '💰' },
];

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMN_LABELS: Record<string, Record<string, string>> = {
  companies: {
    name: 'ชื่อบริษัท *', description: 'คำอธิบาย', address: 'ที่อยู่',
    phone: 'โทรศัพท์', email: 'อีเมล', website: 'เว็บไซต์',
    tax_id: 'เลขผู้เสียภาษี', logo_url: 'URL โลโก้', is_active: 'ใช้งาน (true/false)',
  },
  customers: {
    company_name: 'ชื่อบริษัท *', first_name: 'ชื่อ *', last_name: 'นามสกุล *',
    email: 'อีเมล *', phone: 'โทรศัพท์', position: 'ตำแหน่ง',
    is_primary_contact: 'ติดต่อหลัก (true/false)', is_active: 'ใช้งาน (true/false)', notes: 'หมายเหตุ',
  },
  projects: {
    company_name: 'ชื่อบริษัท *', customer_email: 'อีเมลติดต่อหลัก', name: 'ชื่อโปรเจกต์ *',
    description: 'คำอธิบาย', status: 'สถานะ (on-track/at-risk/delayed/completed)',
    start_date: 'วันเริ่ม (YYYY-MM-DD) *', end_date: 'วันสิ้นสุด (YYYY-MM-DD) *',
    project_value: 'มูลค่า (บาท)', payment_status: 'สถานะการชำระ (pending/partial/paid/overdue)',
    payment_terms: 'เงื่อนไขการชำระ',
  },
  tasks: {
    company_name: 'ชื่อบริษัท', project_name: 'ชื่อโปรเจกต์ *', title: 'ชื่องาน *',
    description: 'คำอธิบาย', status: 'สถานะ (pending/in-progress/completed/overdue/cancelled)',
    priority: 'ความสำคัญ (high/medium/low)', assignee_email: 'อีเมลผู้รับผิดชอบ',
    start_date: 'วันเริ่ม (YYYY-MM-DD)', end_date: 'วันสิ้นสุด (YYYY-MM-DD)',
    estimated_days: 'จำนวนวันประมาณ', days_spent: 'จำนวนวันที่ใช้จริง',
    is_ad_hoc: 'งานแทรก (true/false)', task_type: 'ประเภท (task/meeting/leave/holiday/onsite/ot)',
  },
  subtasks: {
    company_name: 'ชื่อบริษัท', project_name: 'ชื่อโปรเจกต์ *',
    parent_task_title: 'ชื่องานหลัก *', title: 'ชื่องานย่อย *',
    description: 'คำอธิบาย', status: 'สถานะ (pending/in-progress/completed/overdue/cancelled)',
    priority: 'ความสำคัญ (high/medium/low)', assignee_email: 'อีเมลผู้รับผิดชอบ',
    start_date: 'วันเริ่ม (YYYY-MM-DD)', end_date: 'วันสิ้นสุด (YYYY-MM-DD)',
    estimated_days: 'จำนวนวันประมาณ', days_spent: 'จำนวนวันที่ใช้จริง',
    task_type: 'ประเภท (task/meeting/leave/holiday/onsite/ot)',
  },
  opportunities: {
    company_name: 'ชื่อบริษัท *', project_name: 'ชื่อโปรเจกต์ที่เกี่ยวข้อง', name: 'ชื่อโอกาสการขาย *',
    description: 'คำอธิบาย', stage: 'ขั้นตอน (lead/qualified/proposal/negotiation/won/lost)',
    value: 'มูลค่า (บาท)', probability: 'ความน่าจะเป็น % (0-100)',
    expected_close_date: 'วันที่คาดปิดดีล (YYYY-MM-DD)', assigned_user_email: 'อีเมลผู้รับผิดชอบ *',
    lead_source: 'แหล่งที่มา', notes: 'หมายเหตุ',
  },
};

const TEMPLATE_COLUMNS: Record<string, string[]> = Object.fromEntries(
  Object.entries(COLUMN_LABELS).map(([k, v]) => [k, Object.keys(v)])
);

// ─── Rich sample / test data ──────────────────────────────────────────────────

const TEMPLATE_SAMPLE_DATA: Record<string, any[][]> = {
  companies: [
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'ผู้พัฒนาซอฟต์แวร์ชั้นนำ',  '388 ถ.พหลโยธิน กรุงเทพฯ',       '02-123-4567', 'info@thaisoft.co.th',    'https://thaisoft.co.th',   '0105548012345', '', 'true'],
    ['บริษัท อินโนเวชั่น เทค จำกัด',  'บริการให้คำปรึกษาด้าน IT', '123/4 ถ.นิมมานเหมินท์ เชียงใหม่','053-234-567', 'contact@innovtech.co.th','https://innovtech.co.th', '0105548012346', '', 'true'],
    ['บริษัท ดิจิทัล โซลูชัน จำกัด',  'ดิจิทัล ทรานส์ฟอร์เมชัน & AI','89/5 ถ.สุขุมวิท กรุงเทพฯ',   '02-987-6543', 'hello@digitalsol.co.th',  'https://digitalsol.co.th','0105548012347', '', 'true'],
  ],
  customers: [
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'สมชาย',   'วงศ์สกุล', 'somchai@thaisoft.co.th',  '089-111-2222', 'ผู้จัดการฝ่าย IT',   'true',  'true',  'ผู้ตัดสินใจหลัก'],
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'สมศักดิ์', 'ใจดี',     'somsak@thaisoft.co.th',   '081-333-4444', 'หัวหน้าโปรเจกต์',   'false', 'true',  'ประสานงานด้านเทคนิค'],
    ['บริษัท อินโนเวชั่น เทค จำกัด',  'วิภา',     'รักดี',    'wipa@innovtech.co.th',    '083-555-6666', 'ผู้อำนวยการฝ่ายขาย','true',  'true',  'ลูกค้าประจำตั้งแต่ปี 2565'],
    ['บริษัท อินโนเวชั่น เทค จำกัด',  'ประยุทธ์', 'มั่นคง',   'prayut@innovtech.co.th',  '085-777-8888', 'CFO',               'false', 'true',  'ติดต่อด้านงบประมาณ'],
    ['บริษัท ดิจิทัล โซลูชัน จำกัด',  'นิรันดร์', 'ศรีสว่าง', 'niran@digitalsol.co.th',  '086-999-0000', 'CTO',               'true',  'true',  'สนใจ AI Solution'],
  ],
  projects: [
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'somchai@thaisoft.co.th', 'พัฒนาเว็บไซต์ใหม่',  'พัฒนาเว็บไซต์บริษัทด้วย React/Next.js','in-progress','2026-01-15','2026-06-30','500000', 'partial','ชำระ 50% ล่วงหน้า'],
    ['บริษัท อินโนเวชั่น เทค จำกัด',  'wipa@innovtech.co.th',   'ระบบ CRM องค์กร',    'ระบบ CRM สำหรับทีมขายและบริการลูกค้า','on-track',   '2026-02-01','2026-08-31','750000', 'pending', 'ชำระแบ่ง 3 งวด'],
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'somsak@thaisoft.co.th',  'Mobile App v2.0',    'ปรับปรุงแอปพลิเคชัน iOS/Android',      'on-track',   '2026-03-01','2026-09-30','800000', 'pending', 'ชำระตาม Milestone 25%'],
    ['บริษัท ดิจิทัล โซลูชัน จำกัด',  'niran@digitalsol.co.th', 'ระบบ AI Chatbot',    'AI Chatbot ด้วย LLM สำหรับบริการลูกค้า','on-track',  '2026-02-15','2026-07-31','1200000','pending', 'ชำระเมื่อผ่าน UAT'],
  ],
  tasks: [
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'พัฒนาเว็บไซต์ใหม่','ออกแบบ UI/UX',         'สร้าง Wireframe และ Prototype',   'completed',  'high',  'somchai@thaisoft.co.th', '2026-01-15','2026-01-31','12','12','false','task'],
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'พัฒนาเว็บไซต์ใหม่','พัฒนา Frontend',        'พัฒนา React Components',          'in-progress','high',  'somsak@thaisoft.co.th',  '2026-02-01','2026-03-31','40','20','false','task'],
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'พัฒนาเว็บไซต์ใหม่','พัฒนา Backend API',     'สร้าง REST API ด้วย PHP',         'pending',    'medium','somsak@thaisoft.co.th',  '2026-03-01','2026-04-30','30','0', 'false','task'],
    ['บริษัท อินโนเวชั่น เทค จำกัด',  'ระบบ CRM องค์กร',  'วิเคราะห์ความต้องการ', 'จัดทำ Business Requirement',     'completed',  'high',  'wipa@innovtech.co.th',   '2026-02-01','2026-02-14','10','10','false','task'],
    ['บริษัท อินโนเวชั่น เทค จำกัด',  'ระบบ CRM องค์กร',  'ออกแบบ Database',       'ออกแบบ Schema และ ER Diagram',   'in-progress','high',  'prayut@innovtech.co.th', '2026-02-15','2026-02-28','8', '4', 'false','task'],
    ['บริษัท ดิจิทัล โซลูชัน จำกัด',  'ระบบ AI Chatbot',  'เลือก LLM Model',       'ทดสอบ GPT-4/Gemini/Claude',      'in-progress','high',  'niran@digitalsol.co.th', '2026-02-15','2026-02-28','7', '4', 'false','task'],
    ['บริษัท ดิจิทัล โซลูชัน จำกัด',  'ระบบ AI Chatbot',  'พัฒนา Chatbot Engine',  'สร้าง RAG Pipeline',             'pending',    'medium','niran@digitalsol.co.th', '2026-03-01','2026-04-30','40','0', 'false','task'],
  ],
  subtasks: [
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'พัฒนาเว็บไซต์ใหม่','ออกแบบ UI/UX',        'สร้าง Wireframe หน้าหลัก',     'Layout หน้า Home และ Landing Page','completed',  'high',  'somchai@thaisoft.co.th', '2026-01-15','2026-01-18','3','3','task'],
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'พัฒนาเว็บไซต์ใหม่','ออกแบบ UI/UX',        'ออกแบบ Component Library',     'สร้าง Design System + Storybook','completed',  'high',  'somchai@thaisoft.co.th', '2026-01-19','2026-01-25','5','5','task'],
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'พัฒนาเว็บไซต์ใหม่','ออกแบบ UI/UX',        'ทำ Prototype Interactive',     'Figma Prototype สำหรับ User Testing','completed','medium','somchai@thaisoft.co.th', '2026-01-26','2026-01-31','4','4','task'],
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'พัฒนาเว็บไซต์ใหม่','พัฒนา Frontend',       'ตั้งค่า Project Structure',    'Setup Vite + TypeScript + Tailwind','completed','medium','somsak@thaisoft.co.th',  '2026-02-01','2026-02-02','2','2','task'],
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'พัฒนาเว็บไซต์ใหม่','พัฒนา Frontend',       'พัฒนาหน้า Authentication',    'Login/Register/Forgot Password','completed',  'high',  'somsak@thaisoft.co.th',  '2026-02-03','2026-02-10','6','6','task'],
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'พัฒนาเว็บไซต์ใหม่','พัฒนา Frontend',       'พัฒนาหน้า Dashboard',         'Widget, Charts, Summary Cards','in-progress','medium','somsak@thaisoft.co.th',  '2026-02-11','2026-02-25','10','5','task'],
    ['บริษัท อินโนเวชั่น เทค จำกัด',  'ระบบ CRM องค์กร',  'ออกแบบ Database',      'ออกแบบตาราง Contacts',         'Entity Contacts, Companies, Leads','in-progress','high','prayut@innovtech.co.th', '2026-02-15','2026-02-20','4','2','task'],
    ['บริษัท อินโนเวชั่น เทค จำกัด',  'ระบบ CRM องค์กร',  'ออกแบบ Database',      'ออกแบบตาราง Sales Pipeline',   'Opportunities, Stages, Activities','pending','medium','prayut@innovtech.co.th', '2026-02-21','2026-02-28','4','0','task'],
    ['บริษัท ดิจิทัล โซลูชัน จำกัด',  'ระบบ AI Chatbot',  'เลือก LLM Model',      'Benchmark GPT-4o',             'ทดสอบ Accuracy, Cost, Latency','completed',  'high',  'niran@digitalsol.co.th', '2026-02-15','2026-02-19','3','3','task'],
    ['บริษัท ดิจิทัล โซลูชัน จำกัด',  'ระบบ AI Chatbot',  'เลือก LLM Model',      'Benchmark Claude 3.5 Sonnet',  'ทดสอบ Accuracy, Cost, Latency','in-progress','high', 'niran@digitalsol.co.th', '2026-02-20','2026-02-28','4','1','task'],
  ],
  opportunities: [
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   'พัฒนาเว็บไซต์ใหม่','โครงการเว็บไซต์ Phase 2','Phase 2 เพิ่ม E-Commerce', 'proposal',    '500000', '70','2026-04-30','somchai@thaisoft.co.th', 'Referral', 'ลูกค้าต้องการต่อยอด'],
    ['บริษัท อินโนเวชั่น เทค จำกัด',  'ระบบ CRM องค์กร',  'CRM Phase 2',           'Mobile App + Analytics',   'qualified',   '400000', '60','2026-06-30','wipa@innovtech.co.th',   'Website',  'ต่อเนื่องจาก Phase 1'],
    ['บริษัท ไทย ซอฟต์แวร์ จำกัด',   '',                 'ระบบ ERP สำหรับ HR',    'HR Management System',     'lead',        '900000', '25','2026-09-30','somsak@thaisoft.co.th',  'Cold Call','ลูกค้าสนใจจากการโทร'],
    ['บริษัท ดิจิทัล โซลูชัน จำกัด',  'ระบบ AI Chatbot',  'AI Chatbot Phase 2',    'ขยายไป Line OA + Facebook','proposal',    '600000', '55','2026-08-31','niran@digitalsol.co.th', 'Referral', 'พอใจผลลัพธ์ Phase 1'],
    ['บริษัท อินโนเวชั่น เทค จำกัด',  '',                 'Cloud Migration',        'ย้าย Infrastructure ไป AWS','negotiation','1500000','80','2026-05-31','prayut@innovtech.co.th', 'LinkedIn', 'เจรจาในรายละเอียดสัญญา'],
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

function formatUTCDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function stripInvisible(s: string): string {
  // eslint-disable-next-line no-misleading-character-class
  return s.replace(/[\uFEFF\u200B\u200C\u200D\u00A0]/g, '');
}

function convertExcelDate(value: any): string {
  if (typeof value === 'string') {
    const t = stripInvisible(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{1,2})[-/.x](\d{1,2})[-/.x](\d{4})$/);
    if (m) {
      const [, a, b, y] = m;
      const [mm, dd] = parseInt(a, 10) > 12 ? [b, a] : [a, b];
      return `${y}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return t;
  }
  if (typeof value === 'number') return formatUTCDate(EXCEL_EPOCH_UTC + value * 86400000);
  if (value instanceof Date && !isNaN(value.getTime())) return formatUTCDate(value.getTime());
  if (value && typeof value === 'object' && value.year !== undefined)
    return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.date).padStart(2, '0')}`;
  return String(value ?? '');
}

function convertDateFields(row: Record<string, any>, dateFields: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) out[k] = dateFields.includes(k) ? convertExcelDate(v) : v;
  return out;
}

const emptyRow = (row: Record<string, any>) =>
  Object.values(row).every((v) => String(v ?? '').trim() === '');

const DATE_FIELDS: Record<string, string[]> = {
  projects:      ['start_date', 'end_date'],
  tasks:         ['start_date', 'end_date'],
  subtasks:      ['start_date', 'end_date'],
  opportunities: ['expected_close_date'],
};

const IMPORT_ORDER = ['companies', 'customers', 'projects', 'tasks', 'subtasks', 'opportunities'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportResult {
  type: string;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportDataPanel() {
  const { toast } = useToast();
  const [fileName, setFileName] = useState('');
  const [rowsByType, setRowsByType] = useState<Record<string, any[]>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [resultMap, setResultMap] = useState<Record<string, ImportResult>>({});
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('companies');

  // ── Export state ──────────────────────────────────────────────────────────
  const [exportSelected, setExportSelected] = useState<Set<string>>(
    new Set(SHEETS.map((s) => s.key))
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const allExportSelected = exportSelected.size === SHEETS.length;
  const toggleExport = (key: string) =>
    setExportSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleAllExport = () =>
    setExportSelected(allExportSelected ? new Set() : new Set(SHEETS.map((s) => s.key)));

  const totalRows = useMemo(
    () => Object.values(rowsByType).reduce((s, r) => s + r.length, 0),
    [rowsByType],
  );

  // ── Download workbook ─────────────────────────────────────────────────────

  const downloadWorkbook = (keys: string[], filename: string) => {
    const wb = XLSX.utils.book_new();
    for (const key of keys) {
      const sheet = SHEETS.find((s) => s.key === key);
      if (!sheet) continue;
      const cols   = TEMPLATE_COLUMNS[key] ?? [];
      const sample = TEMPLATE_SAMPLE_DATA[key] ?? [];
      const ws = XLSX.utils.aoa_to_sheet([cols, ...sample]);
      ws['!cols'] = cols.map(() => ({ wch: 26 }));
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }
    const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Export single type ─────────────────────────────────────────────────────

  const handleExportSingle = async (key: string) => {
    setExportingKey(key);
    try {
      const data = await apiFetch<Record<string, any[]>>(`/export.php?types=${key}`);
      const sheet = SHEETS.find((s) => s.key === key)!;
      const cols  = TEMPLATE_COLUMNS[key] ?? [];
      const rows  = (data[key] ?? []).map((r: any) => cols.map((c: string) => r[c] ?? ''));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
      ws['!cols'] = cols.map(() => ({ wch: 26 }));
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `flowstack-${key}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Export ${sheet.label} สำเร็จ`, description: `${(data[key] ?? []).length} แถว` });
    } catch (err: any) {
      toast({ title: 'Export ล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setExportingKey(null);
    }
  };

  // ── Export real data (multi) ──────────────────────────────────────────────

  const handleExportData = async () => {
    if (!exportSelected.size) return;
    setIsExporting(true);
    try {
      const keys = IMPORT_ORDER.filter((k) => exportSelected.has(k));
      const data = await apiFetch<Record<string, any[]>>(`/export.php?types=${keys.join(',')}`);
      const wb = XLSX.utils.book_new();
      for (const key of keys) {
        const sheet = SHEETS.find((s) => s.key === key);
        if (!sheet) continue;
        const cols = TEMPLATE_COLUMNS[key] ?? [];
        const rows = (data[key] ?? []).map((r) => cols.map((c) => r[c] ?? ''));
        const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
        ws['!cols'] = cols.map(() => ({ wch: 26 }));
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      }
      const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `flowstack-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      const total = Object.values(data).reduce((s, r) => s + (Array.isArray(r) ? r.length : 0), 0);
      toast({ title: 'Export สำเร็จ', description: `${total} แถว จาก ${keys.length} ประเภท` });
    } catch (err: any) {
      toast({ title: 'Export ล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  // ── File upload ───────────────────────────────────────────────────────────

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResultMap({});
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const next: Record<string, any[]> = {};
      SHEETS.forEach(({ key, name }) => {
        const ws = wb.Sheets[name];
        if (!ws) return;
        const rows = (XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[])
          .filter((r) => !emptyRow(r));
        if (rows.length > 0) next[key] = rows;
      });
      setRowsByType(next);
      const total = Object.values(next).reduce((s, r) => s + r.length, 0);
      if (total === 0) {
        toast({ title: 'ไม่พบข้อมูลในไฟล์', description: 'ตรวจสอบชื่อ Sheet ให้ตรงกับ Template', variant: 'destructive' });
      } else {
        toast({ title: 'โหลดไฟล์สำเร็จ', description: `พบ ${total} แถว จาก ${Object.keys(next).length} Sheet` });
        const firstKey = IMPORT_ORDER.find((k) => next[k]?.length);
        if (firstKey) setActiveTab(firstKey);
      }
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const toImport = IMPORT_ORDER.filter((k) => rowsByType[k]?.length);
    if (!toImport.length) {
      toast({ title: 'ไม่มีข้อมูลสำหรับนำเข้า', variant: 'destructive' });
      return;
    }
    setIsImporting(true);
    const next: Record<string, ImportResult> = {};
    try {
      for (const type of toImport) {
        const rows = rowsByType[type];
        const df   = DATE_FIELDS[type] ?? [];
        const converted = df.length ? rows.map((r) => convertDateFields(r, df)) : rows;
        next[type] = await apiFetch<ImportResult>('/import.php', {
          method: 'POST',
          body: JSON.stringify({ type, rows: converted }),
        });
      }
      setResultMap(next);
      const total = Object.values(next).reduce((s, r) => s + r.inserted + r.updated, 0);
      toast({ title: `นำเข้าสำเร็จ ${total} รายการ` });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const toggleErrors = (key: string) =>
    setExpandedErrors((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Tabs defaultValue="export">
      <TabsList className="mb-4">
        <TabsTrigger value="export" className="gap-2">
          <Download className="h-4 w-4" />Export ข้อมูล
        </TabsTrigger>
        <TabsTrigger value="import" className="gap-2">
          <Upload className="h-4 w-4" />Import ข้อมูล
        </TabsTrigger>
      </TabsList>

      {/* ═══ EXPORT TAB ═══════════════════════════════════════════════════════ */}
      <TabsContent value="export" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-500" />Export ข้อมูล
            </CardTitle>
            <CardDescription>
              เลือกแต่ละประเภทเพื่อ Export ข้อมูล หรือ Export หลายประเภทพร้อมกันด้านล่าง
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* ── Per-type export tabs ── */}
            <Tabs defaultValue="companies">
              <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                {SHEETS.map(({ key, label, icon }) => (
                  <TabsTrigger key={key} value={key} className="gap-1 text-xs px-3 py-1.5">
                    <span>{icon}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {SHEETS.map(({ key, label, icon }) => {
                const cols      = TEMPLATE_COLUMNS[key] ?? [];
                const colLabels = COLUMN_LABELS[key] ?? {};
                const sampleRows = TEMPLATE_SAMPLE_DATA[key] ?? [];
                const isThis    = exportingKey === key;
                return (
                  <TabsContent key={key} value={key} className="space-y-4 mt-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="text-xl">{icon}</span>
                      <span>{label}</span>
                      <span className="text-xs text-muted-foreground font-normal ml-1">({cols.length} คอลัมน์)</span>
                    </div>

                    {/* Export buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 rounded-lg border p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />Template
                        </div>
                        <p className="text-xs text-muted-foreground">ไฟล์ว่างพร้อมคอลัมน์ + ตัวอย่างข้อมูล</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => downloadWorkbook([key], `flowstack-${key}-template.xlsx`)}
                        >
                          <Download className="h-3.5 w-3.5" />ดาวน์โหลด Template
                        </Button>
                      </div>
                      <div className="flex-1 rounded-lg border p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Database className="h-4 w-4 text-blue-500" />ข้อมูลจริง
                        </div>
                        <p className="text-xs text-muted-foreground">Export จากฐานข้อมูลปัจจุบัน</p>
                        <Button
                          size="sm"
                          className="w-full gap-2"
                          disabled={isThis || exportingKey !== null}
                          onClick={() => handleExportSingle(key)}
                        >
                          {isThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          {isThis ? 'กำลัง Export...' : `Export ${label}`}
                        </Button>
                      </div>
                    </div>

                    {/* Column chips */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" />คอลัมน์ที่รองรับ — <span className="text-red-500">*</span> = จำเป็น
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {cols.map((col) => (
                          <div key={col} className="text-[11px] px-2 py-0.5 rounded bg-muted border font-mono" title={colLabels[col] ?? col}>
                            {col}{colLabels[col]?.includes('*') && <span className="text-red-500 ml-0.5">*</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sample preview */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">ตัวอย่างข้อมูล ({sampleRows.length} แถว)</p>
                      <div className="rounded-lg border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              {cols.map((col) => (
                                <TableHead key={col} className="py-1.5 px-2 min-w-[100px] text-xs align-top">
                                  <div className="font-mono text-[9px] text-muted-foreground/60 leading-tight">{col}</div>
                                  <div className="font-normal text-[10px] leading-tight">{colLabels[col]?.replace(' *','') ?? col}</div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sampleRows.slice(0, 3).map((row, ri) => (
                              <TableRow key={ri} className="hover:bg-muted/20">
                                {cols.map((col, ci) => {
                                  const val = String(row[ci] ?? '');
                                  return (
                                    <TableCell key={col} className="text-xs py-1 px-2 max-w-[160px]">
                                      <span className="line-clamp-1 block" title={val}>
                                        {val || <span className="text-muted-foreground/30">—</span>}
                                      </span>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>

            <Separator />

            {/* ── Batch export ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Export หลายประเภทพร้อมกัน</p>
                <button onClick={toggleAllExport} className="text-xs text-primary hover:underline">
                  {allExportSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SHEETS.map(({ key, label, icon }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      exportSelected.has(key) ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <Checkbox checked={exportSelected.has(key)} onCheckedChange={() => toggleExport(key)} />
                    <span className="text-base leading-none">{icon}</span>
                    <span className="text-xs font-medium">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  disabled={!exportSelected.size}
                  onClick={() => downloadWorkbook(IMPORT_ORDER.filter((k) => exportSelected.has(k)), 'flowstack-import-template.xlsx')}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Template ที่เลือก ({exportSelected.size} Sheet)
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!exportSelected.size || isExporting || exportingKey !== null}
                  onClick={handleExportData}
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                  {isExporting ? 'กำลัง Export...' : `Export ข้อมูลจริง (${exportSelected.size} Sheet)`}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs space-y-1">
              <div className="font-medium text-blue-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />หมายเหตุ
              </div>
              <ul className="space-y-0.5 list-disc list-inside text-blue-600">
                <li>ข้อมูลจริง: assignee จะแสดงเป็น <strong>อีเมล</strong> เพื่อนำกลับมา Import ได้ทันที</li>
                <li>ไฟล์ .xlsx รองรับ Multi-Sheet ในไฟล์เดียว (Export หลายประเภทพร้อมกัน)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ═══ IMPORT TAB ════════════════════════════════════════════════════════ */}
      <TabsContent value="import">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
              นำเข้าข้อมูลจาก Excel
            </CardTitle>
            <CardDescription>
              รองรับ Companies, Customers, Projects, Tasks, Subtasks และ Sales Opportunities
              — นำเข้าพร้อมกันหลาย Sheet ในไฟล์เดียว
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Action bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <label className="flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 hover:bg-muted/50 transition-colors text-sm w-full sm:w-auto">
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground truncate max-w-[220px]">
                  {fileName || 'เลือกไฟล์ Excel (.xlsx)'}
                </span>
                <Input type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
              </label>
              {totalRows > 0 && (
                <Button onClick={handleImport} disabled={isImporting} className="gap-2 shrink-0">
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  นำเข้า {totalRows} แถว
                </Button>
              )}
            </div>

            {/* Sheet tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {SHEETS.map(({ key, label, icon }) => {
              const count = rowsByType[key]?.length ?? 0;
              const res   = resultMap[key];
              return (
                <TabsTrigger key={key} value={key} className="gap-1 text-xs px-3 py-1.5 relative">
                  <span>{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                  {count > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-0.5">
                      {count}
                    </Badge>
                  )}
                  {res && (
                    <span
                      className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                        res.errors?.length ? 'bg-red-500' : 'bg-green-500'
                      }`}
                    />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {SHEETS.map(({ key, label, icon }) => {
            const cols      = TEMPLATE_COLUMNS[key] ?? [];
            const colLabels = COLUMN_LABELS[key] ?? {};
            const sampleRows   = TEMPLATE_SAMPLE_DATA[key] ?? [];
            const loadedRows   = rowsByType[key] ?? [];
            const res          = resultMap[key];
            const displayRows  = loadedRows.length > 0 ? loadedRows.slice(0, 5) : sampleRows.slice(0, 5);
            const displayCount = loadedRows.length > 0 ? loadedRows.length : sampleRows.length;

            return (
              <TabsContent key={key} value={key} className="space-y-3 mt-3">

                {/* Sheet header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="text-lg">{icon}</span>
                    <span>{label}</span>
                    {loadedRows.length > 0 && (
                      <Badge className="bg-blue-100 text-blue-700 text-xs border-0">
                        {loadedRows.length} แถวโหลดแล้ว
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => downloadWorkbook([key], `flowstack-${key}-template.xlsx`)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    ดาวน์โหลด Sheet นี้
                  </Button>
                </div>

                {/* Import result */}
                {res && (
                  <div
                    className={`rounded-lg border p-3 text-sm ${
                      res.errors?.length ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium mb-1">
                      {res.errors?.length
                        ? <AlertCircle className="w-4 h-4 text-red-500" />
                        : <CheckCircle className="w-4 h-4 text-green-500" />}
                      ผลการนำเข้า {label}
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-green-600 font-medium">+{res.inserted} เพิ่ม</span>
                      <span className="text-blue-600 font-medium">↺ {res.updated} อัปเดต</span>
                      <span className="text-gray-500">⊘ {res.skipped} ข้าม</span>
                      {res.errors?.length > 0 && (
                        <span className="text-red-600 font-medium">✕ {res.errors.length} ผิดพลาด</span>
                      )}
                    </div>
                    {res.errors?.length > 0 && (
                      <div className="mt-2">
                        <button
                          className="text-xs text-red-600 flex items-center gap-1"
                          onClick={() => toggleErrors(key)}
                        >
                          {expandedErrors.has(key)
                            ? <ChevronDown className="w-3 h-3" />
                            : <ChevronRight className="w-3 h-3" />}
                          รายละเอียดข้อผิดพลาด ({res.errors.length})
                        </button>
                        {expandedErrors.has(key) && (
                          <div className="mt-1 space-y-0.5 text-xs text-red-700 max-h-28 overflow-y-auto">
                            {res.errors.map((e, i) => (
                              <div key={i}>แถว {e.row}: {e.message}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Column reference */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    คอลัมน์ที่รองรับ ({cols.length} คอลัมน์) —{' '}
                    <span className="text-red-500">*</span> = จำเป็น
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cols.map((col) => (
                      <div
                        key={col}
                        className="text-[11px] px-2 py-0.5 rounded bg-muted border font-mono"
                        title={colLabels[col] ?? col}
                      >
                        {col}
                        {colLabels[col]?.includes('*') && (
                          <span className="text-red-500 ml-0.5">*</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data preview */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {loadedRows.length > 0
                      ? `ข้อมูลจากไฟล์ (${Math.min(loadedRows.length, 5)}/${loadedRows.length} แถว)`
                      : 'ตัวอย่างข้อมูลทดสอบ'}
                  </p>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          {cols.map((col) => (
                            <TableHead key={col} className="py-1.5 px-2 min-w-[110px] text-xs align-top">
                              <div className="font-mono text-[9px] text-muted-foreground/60 leading-tight">{col}</div>
                              <div className="font-normal text-[10px] leading-tight">
                                {colLabels[col]?.replace(' *', '') ?? col}
                              </div>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayRows.map((row, ri) => (
                          <TableRow key={ri} className="hover:bg-muted/20">
                            {cols.map((col, ci) => {
                              const val = loadedRows.length > 0
                                ? String(row[col] ?? '')
                                : String((sampleRows[ri] ?? [])[ci] ?? '');
                              return (
                                <TableCell key={col} className="text-xs py-1 px-2 max-w-[180px]">
                                  <span className="line-clamp-1 block" title={val}>
                                    {val || <span className="text-muted-foreground/30">—</span>}
                                  </span>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {displayCount > 5 && (
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      ... และอีก {displayCount - 5} แถว
                    </p>
                  )}
                </div>

              </TabsContent>
            );
          })}
        </Tabs>

            {/* Notes */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs space-y-1">
              <div className="font-medium text-blue-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />หมายเหตุการนำเข้า
              </div>
              <ul className="space-y-0.5 list-disc list-inside text-blue-600">
                <li>นำเข้าตามลำดับ: Companies → Customers → Projects → Tasks → <strong>Subtasks</strong> → Opportunities</li>
                <li>หากมีข้อมูลซ้ำ (ชื่อเดิม) จะ <strong>อัปเดต</strong> แทนการสร้างใหม่</li>
                <li><strong>Subtasks</strong>: ระบุ parent_task_title ให้ตรงกับชื่องานหลักใน Tasks Sheet</li>
                <li>หากไม่พบบริษัท/โปรเจกต์ ระบบจะ <strong>สร้างให้อัตโนมัติ</strong></li>
                <li>วันที่รับรูปแบบ: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, Excel Serial Number</li>
              </ul>
            </div>

          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
