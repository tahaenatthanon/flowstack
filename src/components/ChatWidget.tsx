import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, X, Send, Bot, Loader2, Maximize2, Minimize2, Plus, History, Trash2, ChevronLeft, Sparkles, Calendar, ListTodo, Gauge, Building2, FileText, Save, RefreshCw, LayoutDashboard, Bell, BellRing, Clock, TrendingUp, ClipboardList, Zap } from 'lucide-react';
import ModelCombobox from '@/components/ModelCombobox';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { getSystemPrompt } from '@/lib/schemaContext';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOverview } from '@/hooks/useCurrentOverview';
import { useProjects } from '@/hooks/useProjects';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tableData?: any[];
}

interface Model {
  id: string;
  name?: string;
}

interface ChatSession {
  id: string;
  title: string;
  model: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface Persona {
  id: string;
  name: string;
  personality: string;
  data_scope: string;
  avatar_emoji: string;
  is_default?: number;
}

interface ChatReport {
  id: string;
  session_id?: string | null;
  title: string;
  report_type: string;
  content: string;
  table_data?: any[];
  created_at: string;
  updated_at: string;
}

function cleanAIContent(content: string): string {
  return content.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/[\n\r\t]/g, '')
    .replace(/[\u00A0\u180E\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060\u2066-\u2069\u3000\uFEFF\uFFF9-\uFFFD]/g, '');
}

function parseToolCall(content: string): any | null {
  const toolCallMatch = content.match(/\[TOOL_CALL\]\s*\{[\s\S]*?\}\s*\[\/TOOL_CALL\]/i);
  if (!toolCallMatch) return null;

  const inner = toolCallMatch[0]
    .replace(/\[\/?\s*TOOL_CALL\]/gi, '')
    .trim();

  const sqlMatch = inner.match(/--sql\s*-->\s*"([\s\S]*?)"\s*\}?\s*\}?/);
  if (sqlMatch) {
    const sql = sqlMatch[1].replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
    return { action: 'query', sql };
  }

  const sqlMatch2 = inner.match(/--sql\s+"([\s\S]*?)"\s*\}?\s*\}?/);
  if (sqlMatch2) {
    const sql = sqlMatch2[1].replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
    return { action: 'query', sql };
  }

  const endpointMatch = inner.match(/--endpoint\s*-->\s*"([^"]+)"/);
  const methodMatch = inner.match(/--method\s*-->\s*"([^"]+)"/);
  const bodyMatch = inner.match(/--body\s*-->\s*(\{[\s\S]*?\})\s*\}?\s*\}?/);
  if (endpointMatch && methodMatch) {
    const result: any = { action: 'execute', endpoint: endpointMatch[1], method: methodMatch[1] };
    if (bodyMatch) { try { result.body = JSON.parse(bodyMatch[1]); } catch {} }
    return result;
  }

  const endpointMatch2 = inner.match(/--endpoint\s+"([^"]+)"/);
  const methodMatch2 = inner.match(/--method\s+"([^"]+)"/);
  const bodyMatch2 = inner.match(/--body\s+(\{[\s\S]*?\})\s*\}?\s*\}?/);
  if (endpointMatch2 && methodMatch2) {
    const result: any = { action: 'execute', endpoint: endpointMatch2[1], method: methodMatch2[1] };
    if (bodyMatch2) { try { result.body = JSON.parse(bodyMatch2[1]); } catch {} }
    return result;
  }
  return null;
}

// Parse <minimax:tool_call> XML-style format that minimax model uses natively
// Parse <tool_call>TOOL_NAME\n<arg_key>K</arg_key><arg_value>V</arg_value>...</tool_call>
function parseArgKeyToolCall(content: string): any | null {
  const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  const steps: any[] = [];
  let m: RegExpExecArray | null;

  while ((m = toolCallRegex.exec(content)) !== null) {
    const inner = m[1];
    // Tool name is text before first <arg_key>, trimmed
    const toolName = inner.replace(/<arg_key>[\s\S]*$/i, '').trim();
    const params: Record<string, string> = {};
    const keys: string[] = [];
    const vals: string[] = [];
    const keyRe = /<arg_key>([\s\S]*?)<\/arg_key>/gi;
    const valRe = /<arg_value>([\s\S]*?)<\/arg_value>/gi;
    let km: RegExpExecArray | null, vm: RegExpExecArray | null;
    while ((km = keyRe.exec(inner)) !== null) keys.push(km[1].trim());
    while ((vm = valRe.exec(inner)) !== null) vals.push(vm[1].trim());
    keys.forEach((k, i) => { if (vals[i] !== undefined) params[k] = vals[i]; });

    let parsed: any = null;
    if (toolName === 'query') {
      parsed = { action: 'query', sql: params.sql || '' };
      if (params.description) parsed.description = params.description;
    } else if (toolName === 'execute') {
      parsed = { action: 'execute', endpoint: params.endpoint || '', method: params.method || 'POST' };
      if (params.body) { try { parsed.body = JSON.parse(params.body); } catch {} }
      if (params.description) parsed.description = params.description;
    } else if (toolName === 'fetch') {
      parsed = { action: 'fetch', endpoint: params.endpoint || '' };
      if (params.description) parsed.description = params.description;
    }
    if (parsed) steps.push(parsed);
  }

  if (steps.length === 0) return null;
  if (steps.length === 1) return steps[0];
  return { action: 'multi', steps, description: 'การดำเนินการหลายขั้นตอน' };
}

function parseMiniMaxToolCall(content: string): any | null {
  const toolCallRegex = /<minimax:tool_call>([\s\S]*?)<\/minimax:tool_call>/gi;
  const steps: any[] = [];
  let m: RegExpExecArray | null;

  while ((m = toolCallRegex.exec(content)) !== null) {
    const inner = m[1];
    const invokeMatch = inner.match(/<invoke\s+name="([^"]+)">/i);
    if (!invokeMatch) continue;

    const toolName = invokeMatch[1];
    const params: Record<string, string> = {};
    const paramRe = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/gi;
    let pm: RegExpExecArray | null;
    while ((pm = paramRe.exec(inner)) !== null) {
      params[pm[1]] = pm[2].trim();
    }

    let parsed: any = null;
    if (toolName === 'execute') {
      parsed = { action: 'execute', endpoint: params.endpoint || '', method: params.method || 'POST' };
      if (params.body) { try { parsed.body = JSON.parse(params.body); } catch {} }
      if (params.description) parsed.description = params.description;
    } else if (toolName === 'query') {
      parsed = { action: 'query', sql: params.sql || '' };
      if (params.description) parsed.description = params.description;
    } else if (toolName === 'fetch') {
      parsed = { action: 'fetch', endpoint: params.endpoint || '' };
      if (params.params) { try { parsed.params = JSON.parse(params.params); } catch {} }
      if (params.description) parsed.description = params.description;
    }
    if (parsed) steps.push(parsed);
  }

  if (steps.length === 0) return null;
  if (steps.length === 1) return steps[0];
  return { action: 'multi', steps, description: 'การดำเนินการหลายขั้นตอน' };
}

function extractJSON(content: string): any | null {
  // 1. Try <tool_call>NAME<arg_key>...</arg_key><arg_value>...</arg_value></tool_call>
  const argKeyResult = parseArgKeyToolCall(content);
  if (argKeyResult) return argKeyResult;

  // 2. Try <minimax:tool_call> XML format (minimax native)
  const miniMaxResult = parseMiniMaxToolCall(content);
  if (miniMaxResult) return miniMaxResult;

  // 3. Try [TOOL_CALL] format
  const toolCallResult = parseToolCall(content);
  if (toolCallResult) return toolCallResult;

  // 4. Try raw JSON – use balanced-brace scan so multiple top-level blocks are detected
  try {
    const clean = cleanAIContent(content);
    const blocks: any[] = [];
    let depth = 0, start = -1;
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (ch === '{') { if (depth === 0) start = i; depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            const raw = clean.slice(start, i + 1).replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            const parsed = JSON.parse(raw);
            if (parsed?.action) blocks.push(parsed);
          } catch { /* skip invalid block */ }
          start = -1;
        }
      }
    }
    if (blocks.length === 1) return blocks[0];
    if (blocks.length > 1) return { action: 'multi', steps: blocks, description: 'การดำเนินการหลายขั้นตอน' };
    return null;
  } catch {
    return null;
  }
}

function resolveTemplateVars(obj: any, stepResults: Record<string, any>): any {
  const str = JSON.stringify(obj);
  const resolved = str.replace(/"{{(step\d+)\.(\w+)}}"/g, (_, stepKey, field) => {
    const result = stepResults[stepKey];
    if (result && result[field] !== undefined) return JSON.stringify(String(result[field]));
    return `"{{${stepKey}.${field}}}"`;
  });
  const resolved2 = resolved.replace(/\{\{(step\d+)\.(\w+)\}\}/g, (_, stepKey, field) => {
    const result = stepResults[stepKey];
    if (result && result[field] !== undefined) return String(result[field]);
    return `{{${stepKey}.${field}}}`;
  });
  return JSON.parse(resolved2);
}

// Simple inline markdown renderer
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    // Heading
    const h3Match = line.match(/^###\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match || h2Match || h3Match) {
      const headText = (h1Match || h2Match || h3Match)![1];
      nodes.push(
        <div key={lineIdx} className="font-semibold mt-2 mb-0.5 text-foreground">
          {inlineFormat(headText)}
        </div>
      );
      return;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={lineIdx} className="my-2 border-slate-200 dark:border-slate-700" />);
      return;
    }

    // Bullet list
    const bulletMatch = line.match(/^[\s]*[-*•]\s+(.+)/);
    if (bulletMatch) {
      nodes.push(
        <div key={lineIdx} className="flex gap-1.5 pl-1">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
          <span>{inlineFormat(bulletMatch[1])}</span>
        </div>
      );
      return;
    }

    // Numbered list
    const numMatch = line.match(/^[\s]*(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      nodes.push(
        <div key={lineIdx} className="flex gap-1.5 pl-1">
          <span className="shrink-0 text-primary/70 font-medium">{numMatch[1]}.</span>
          <span>{inlineFormat(numMatch[2])}</span>
        </div>
      );
      return;
    }

    // Empty line → small gap
    if (line.trim() === '') {
      nodes.push(<div key={lineIdx} className="h-1" />);
      return;
    }

    // Normal line
    nodes.push(<div key={lineIdx}>{inlineFormat(line)}</div>);
  });

  return nodes;
}

function inlineFormat(text: string): React.ReactNode {
  // Split by inline code, bold, italic patterns
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-[11px] font-mono">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function DataTable({ data, forceTable }: { data: any[]; forceTable?: boolean }) {
  if (!data || data.length === 0) return <p className="text-xs text-muted-foreground">ไม่พบข้อมูล</p>;

  const hiddenCols = new Set(['id', 'ID', 'Id', 'iD', 'created_at', 'updated_at', 'createdAt', 'updatedAt', 'modified_at', 'deleted_at', 'tenant_id']);

  const labelMap: Record<string, string> = {
    title: 'ชื่องาน', task_title: 'ชื่องาน', entry_title: 'รายการ',
    name: 'ชื่อ', project_name: 'โปรเจกต์', company_name: 'บริษัท',
    status: 'สถานะ', priority: 'ความสำคัญ', stage: 'ขั้นตอน',
    start_date: 'วันที่เริ่ม', end_date: 'วันที่สิ้นสุด', expected_close_date: 'วันปิดที่คาด',
    estimated_hours: 'ชม.ประมาณ', actual_hours: 'ชม.จริง', hours_worked: 'ชม.ทำงาน',
    estimated_days: 'วันประมาณ', days_spent: 'วันที่ใช้',
    task_type: 'ประเภทงาน', event_type: 'ประเภท',
    description: 'รายละเอียด', notes: 'หมายเหตุ',
    display_name: 'ผู้รับผิดชอบ', user_name: 'ผู้ใช้', assignee: 'ผู้รับผิดชอบ',
    email: 'อีเมล', phone: 'เบอร์โทร', address: 'ที่อยู่', website: 'เว็บไซต์',
    value: 'มูลค่า', total_amount: 'ยอดรวม', grand_total: 'ยอดสุทธิ',
    probability: 'ความน่าจะเป็น', lead_source: 'ที่มา',
    is_active: 'ใช้งาน', is_primary_contact: 'ผู้ติดต่อหลัก',
    start_at: 'เริ่ม', end_at: 'สิ้นสุด', all_day: 'ทั้งวัน',
    time_start: 'เวลาเริ่ม', time_end: 'เวลาสิ้นสุด',
  };

  const primaryCols = ['title', 'name', 'task_title', 'entry_title'];
  const statusCols = ['status', 'stage', 'priority'];

  const allColumns = Object.keys(data[0]);
  const columns = allColumns.filter(col => !hiddenCols.has(col));
  if (columns.length === 0) return <p className="text-xs text-muted-foreground">ไม่พบข้อมูลที่แสดงได้</p>;

  const thLabel = (col: string) => labelMap[col] || col.replace(/_/g, ' ');

  const fmtVal = (col: string, val: any): string => {
    if (val === null || val === undefined) return '-';
    const s = String(val);
    if (s.length > 50 && (col === 'description' || col === 'notes' || col === 'address')) return s.substring(0, 47) + '...';
    return s;
  };

  const statusColor = (val: string) => {
    switch (val) {
      case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'in-progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'completed': case 'won': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'overdue': case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'cancelled': case 'lost': return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const primaryCol = primaryCols.find(c => columns.includes(c));
  const statusCol = statusCols.find(c => columns.includes(c));
  const detailCols = columns.filter(c => !primaryCols.includes(c) && !statusCols.includes(c));

  // Mobile card view — always shown on small viewports
  const cardView = (
    <div className={`mt-2 space-y-2 ${forceTable ? 'hidden' : 'sm:hidden'}`}>
      {data.map((row, i) => (
        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 overflow-hidden text-xs shadow-sm">
          {/* Card header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100 flex-1 min-w-0 truncate">
              {primaryCol ? fmtVal(primaryCol, row[primaryCol]) : `รายการที่ ${i + 1}`}
            </span>
            {statusCol && row[statusCol] != null && (
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(String(row[statusCol]))}`}>
                {String(row[statusCol])}
              </span>
            )}
          </div>
          {/* Detail grid */}
          {detailCols.length > 0 && (
            <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {detailCols.map(col => (
                <div key={col} className={detailCols.length === 1 || String(fmtVal(col, row[col])).length > 20 ? 'col-span-2' : ''}>
                  <span className="text-[10px] text-muted-foreground leading-none block mb-0.5">{thLabel(col)}</span>
                  <span className="text-slate-700 dark:text-slate-200 break-words leading-snug">{fmtVal(col, row[col])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <p className="text-center text-[10px] text-muted-foreground pt-1">{data.length} รายการ</p>
    </div>
  );

  // Scrollable table view — shown on sm+ or when forceTable
  const tableView = (
    <div className={`mt-2 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${forceTable ? 'block' : 'hidden sm:block'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[320px]">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="px-2 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 w-7 shrink-0">#</th>
              {columns.map((col) => (
                <th key={col} className="px-2 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 whitespace-nowrap">{thLabel(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900/50">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 text-muted-foreground text-center">{i + 1}</td>
                {columns.map((col) => (
                  <td key={col} className={`px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 ${statusCols.includes(col) ? '' : 'max-w-[180px]'}`}>
                    {row[col] === null || row[col] === undefined
                      ? <span className="text-muted-foreground italic">-</span>
                      : statusCols.includes(col)
                        ? <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${statusColor(String(row[col]))}`}>{String(row[col])}</span>
                        : <span className="block truncate">{String(row[col])}</span>
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
        {data.length} รายการ
      </div>
    </div>
  );

  return <>{cardView}{tableView}</>;
}

function MessageBubble({
  msg,
  isMaximized,
  onSaveReport,
  disableSaveReport,
}: {
  msg: Message;
  isMaximized: boolean;
  onSaveReport?: () => void;
  disableSaveReport?: boolean;
}) {
  const isUser = msg.role === 'user';
  const canSaveReport = msg.role === 'assistant' && !msg.content.startsWith('ข้อผิดพลาด:') && !!onSaveReport;
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 w-full`}>
      <div className={`w-full max-w-full px-3.5 py-2.5 rounded-2xl text-sm shadow-sm overflow-visible ${
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-none'
          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-none text-slate-800 dark:text-slate-100'
      }`}>
        {isUser ? (
          <div className="whitespace-pre-wrap leading-relaxed break-words">{msg.content}</div>
        ) : (
          <div className="leading-relaxed space-y-0.5">{renderMarkdown(msg.content)}</div>
        )}
        {msg.tableData && msg.tableData.length > 0 && <DataTable data={msg.tableData} forceTable={isMaximized} />}
        {canSaveReport && (
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-[11px]"
              onClick={onSaveReport}
              disabled={disableSaveReport}
            >
              <Save className="h-3 w-3" />
              บันทึกรายงาน
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Format date for sidebar
function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชม.ที่แล้ว`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [reports, setReports] = useState<ChatReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [savingReportIndex, setSavingReportIndex] = useState<number | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [chatContextPrompt, setChatContextPrompt] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const briefingTriggeredRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: projects = [] } = useProjects(isOpen);
  const { data: overviewData, isLoading: overviewLoading, isError: overviewError } = useCurrentOverview(isOpen && showDashboard);

  // Load personas once on mount
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const [list, pref]: any[] = await Promise.all([
          apiFetch('/personas.php'),
          apiFetch('/personas.php?action=my_preference').catch(() => null),
        ]);
        const arr: Persona[] = Array.isArray(list) ? list : [];
        setPersonas(arr);
        if (pref?.persona) {
          setActivePersona(pref.persona);
        } else if (arr.length > 0) {
          setActivePersona(arr.find(p => p.is_default) || arr[0]);
        }
      } catch {
        // personas stay empty
      }
    };
    loadPersonas();
  }, []);

  // Load unread notifications (badge when closed, full list when open)
  useEffect(() => {
    apiFetch<any[]>('/ai-notifications.php?unread=1').then(setNotifications).catch(() => {});
  }, [isOpen]);

  const dismissNotification = useCallback(async (id: string) => {
    await apiFetch(`/ai-notifications.php?action=read&id=${id}`, { method: 'POST' }).catch(() => {});
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Daily briefing: trigger once per day on first open with no messages
  useEffect(() => {
    if (!isOpen || !selectedModel) return;
    if (briefingTriggeredRef.current) return;
    // Check only inside effect body to avoid extra deps
    const msgCount = messages.length;
    if (msgCount > 0) return;
    const today = new Date().toISOString().split('T')[0];
    const lastDate = localStorage.getItem('flowstack_briefing_date');
    if (lastDate === today) return;
    briefingTriggeredRef.current = true;
    localStorage.setItem('flowstack_briefing_date', today);
    const timer = setTimeout(() => {
      handleQuickAction('สวัสดีตอนเช้า! ช่วยสรุปวันนี้ให้หน่อยได้ไหม: มีงานอะไรบ้างที่ต้องทำวันนี้? และมีนัดหมายหรือ calendar events วันนี้ไหม?');
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedModel]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  useEffect(() => {
    adjustTextarea();
  }, [input, adjustTextarea]);

  // Card class based on state
  const cardClass = useMemo(() => {
    if (isMaximized) return 'w-full h-full shadow-2xl flex flex-col border-0 sm:border sm:border-primary/20 rounded-none sm:rounded-2xl';
    // Mobile: bottom sheet style (rounded top, flat bottom)
    return 'w-full h-full shadow-2xl flex flex-col border border-primary/20 border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl';
  }, [isMaximized]);

   // Load models
   useEffect(() => {
     const fetchModels = async () => {
       try {
         // First, fetch the default model from AI settings
         let defaultModelId: string | null = null;
         try {
           const settings: any = await apiFetch('/ai-settings.php');
           defaultModelId = settings.ai_default_model_id || null;
           setChatContextPrompt(settings.ai_chat_context_prompt || '');
         } catch {
           // fall through: use default model selection below
         }

         // Then, fetch available models
         const response: any = await apiFetch('/chat.php?action=models');
         let modelList: Model[] = [];
         if (response.data && Array.isArray(response.data)) modelList = response.data;
         else if (Array.isArray(response)) modelList = response;
         else if (response.data?.data && Array.isArray(response.data.data)) modelList = response.data.data;

         setModels(modelList);
          if (modelList.length > 0) {
            // Priority: 1) default model from settings, 2) kilo-auto/free, 3) first model
            const selected = defaultModelId && modelList.some((m: any) => m.id === defaultModelId)
              ? defaultModelId
              : (modelList.find((m: any) => m.id.toLowerCase().includes('kilo-auto/free'))?.id || modelList[0].id);
            setSelectedModel(selected);
          }
       } catch (err: any) {
         const msg = err?.message || '';
         if (msg.includes('API key not configured') || msg.includes('AI API key')) {
           setMessages([{ role: 'assistant', content: 'ยังไม่ได้ตั้งค่า API Key — กรุณาไปที่ **Admin > AI Settings** เพื่อเพิ่ม API Key ก่อนใช้งาน AI Chat' }]);
         }
       }
     };
     if (isOpen && models.length === 0) fetchModels();
   }, [isOpen, models.length]);

  // Load sessions when opening history
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data: any = await apiFetch('/chat-history.php?action=sessions');
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      // sessions stay empty
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const data: any = await apiFetch('/chat-history.php?action=reports&limit=200');
      setReports(Array.isArray(data) ? data : []);
    } catch {
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadSessions();
  }, [isOpen, loadSessions]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  // Save message to backend
  const saveMessage = useCallback(async (sessionId: string, msg: Message) => {
    try {
      await apiFetch('/chat-history.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save_message',
          session_id: sessionId,
          role: msg.role,
          content: msg.content,
          table_data: msg.tableData || null,
        }),
      });
    } catch {
      // non-critical: message still shown locally
    }
  }, []);

  // Create or get current session
  const ensureSession = useCallback(async (firstMessage: string): Promise<string> => {
    if (currentSessionId) return currentSessionId;
    const title = firstMessage.substring(0, 80) || 'แชทใหม่';
    try {
      const session: any = await apiFetch('/chat-history.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'create_session', title, model: selectedModel }),
      });
      const id = session.id;
      setCurrentSessionId(id);
      loadSessions();
      return id;
    } catch {
      return '';
    }
  }, [currentSessionId, selectedModel, loadSessions]);

  // Load a session's messages
  const loadSession = useCallback(async (session: ChatSession) => {
    try {
      const data: any = await apiFetch(`/chat-history.php?action=messages&session_id=${session.id}`);
      const msgs: Message[] = (Array.isArray(data) ? data : [])
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => ({ role: m.role, content: m.content, tableData: m.table_data || undefined }));
      setMessages(msgs);
      setCurrentSessionId(session.id);
      if (session.model) setSelectedModel(session.model);
      setShowHistory(false);
      setShowReports(false);
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถโหลดประวัติแชทได้', variant: 'destructive' });
    }
  }, [toast]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/chat-history.php?id=${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) { setCurrentSessionId(null); setMessages([]); }
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถลบประวัติแชทได้', variant: 'destructive' });
    }
  }, [currentSessionId]);

  // Switch persona + persist preference
  const handlePersonaChange = useCallback(async (personaId: string) => {
    const p = personas.find(x => x.id === personaId);
    if (!p) return;
    setActivePersona(p);
    try {
      await apiFetch('/personas.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'set_preference', persona_id: personaId }),
      });
    } catch {
      // preference not persisted; local state still updated
    }
  }, [personas]);

  // New chat
  const startNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setShowHistory(false);
    setShowReports(false);
    setShowDashboard(false);
  }, []);

  const saveReportFromMessage = useCallback(async (msg: Message, index: number) => {
    if (!msg.content.trim()) return;
    setSavingReportIndex(index);
    try {
      const firstLine = msg.content.split('\n').find(line => line.trim()) || 'รายงาน AI';
      const cleanedTitle = firstLine.replace(/^#+\s*/, '').trim().substring(0, 120) || 'รายงาน AI';
      await apiFetch('/chat-history.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'save_report',
          session_id: currentSessionId,
          title: cleanedTitle,
          report_type: msg.tableData?.length ? 'table' : 'analysis',
          content: msg.content,
          table_data: msg.tableData || null,
        }),
      });
      toast({ title: 'บันทึกรายงานสำเร็จ' });
      if (showReports) loadReports();
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถบันทึกรายงานได้', variant: 'destructive' });
    } finally {
      setSavingReportIndex(null);
    }
  }, [currentSessionId, showReports, loadReports, toast]);

  const deleteReport = useCallback(async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/chat-history.php?action=report&id=${reportId}`, { method: 'DELETE' });
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถลบรายงานได้', variant: 'destructive' });
    }
  }, [toast]);

  // Execute action
  const executeAction = async (actionData: any, stepResults: Record<string, any> = {}): Promise<{ success: boolean; data?: any; error?: string; description?: string }> => {
    const resolved = Object.keys(stepResults).length > 0 ? resolveTemplateVars(actionData, stepResults) : actionData;
    if (resolved.action === 'query') {
      try {
        const queryRes: any = await apiFetch('/query.php', { method: 'POST', body: JSON.stringify({ sql: resolved.sql }) });
        return { success: true, data: Array.isArray(queryRes) ? queryRes : [], description: resolved.description };
      } catch (err: any) {
        return { success: false, error: err.message, description: resolved.description };
      }
    }
    if (resolved.action === 'execute') {
      try {
        if (!resolved.endpoint) throw new Error('Missing endpoint in execute action');
        // Validate ID fields — reject obvious placeholder/hallucination values
        const body = resolved.body || {};
        for (const [key, val] of Object.entries(body)) {
          // tax_id is a 13-digit tax number, not a UUID — skip UUID check for it
          const isUuidField = key !== 'tax_id' && (key === 'task_id' || key === 'parent_task_id' || key.endsWith('_id'));
          if (typeof val === 'string' && isUuidField) {
            const looksFake = val.includes('PLACEHOLDER') || val.includes('placeholder') || val === 'ไม่ทราบ' || val === 'unknown' || /^[0-9a-f]{8}$/.test(val) || val.length < 20;
            if (looksFake) throw new Error(`ค่า ${key}="${val}" ไม่ถูกต้อง — AI สร้างค่าปลอมขึ้นมา กรุณาลองใหม่อีกครั้ง`);
          }
        }
        const result: any = await apiFetch(resolved.endpoint, {
          method: (resolved.method || 'POST').toUpperCase(),
          body: JSON.stringify(resolved.body || {}),
        });
        queryClient.invalidateQueries();
        return { success: true, data: result, description: resolved.description };
      } catch (err: any) {
        return { success: false, error: err.message, description: resolved.description };
      }
    }
    if (resolved.action === 'fetch') {
      try {
        const params = new URLSearchParams(resolved.params || {});
        const qs = params.toString();
        const url = resolved.endpoint + (qs ? '?' + qs : '');
        const fetchRes: any = await apiFetch(url);
        const data = fetchRes && typeof fetchRes === 'object' ? fetchRes : {};
        return { success: true, data, description: resolved.description };
      } catch (err: any) {
        return { success: false, error: err.message, description: resolved.description };
      }
    }
    return { success: false, error: 'Unknown action: ' + resolved.action };
  };

  const executeMulti = async (actionData: any): Promise<{ text: string; tableData?: any[] }> => {
    const steps = actionData.steps || [];
    const stepResults: Record<string, any> = {};
    const results: string[] = [];
    let lastData: any[] | undefined;
    let hasExecuted = false; // track whether any execute/fetch step already succeeded

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const result = await executeAction(step, stepResults);
      const label = result.description || `Step ${i + 1}`;

      if (!result.success) {
        results.push(`✗ ${label}: ${result.error}`);
        break;
      }

      if (step.action === 'query' && Array.isArray(result.data) && result.data.length === 0) {
        // If execute steps already succeeded, this is just a trailing verification — skip silently
        if (hasExecuted) break;
        results.push(`✗ ${label}: ไม่พบข้อมูลที่ตรงกัน (0 รายการ) — กรุณาตรวจสอบชื่อที่ถูกต้องแล้วลองใหม่`);
        break;
      }

      if (step.action === 'execute' || step.action === 'fetch') hasExecuted = true;

      if (result.data) {
        const firstRow = Array.isArray(result.data) ? result.data[0] : result.data;
        stepResults[`step${i + 1}`] = firstRow || {};
        if (Array.isArray(result.data) && result.data.length > 0) lastData = result.data;
      }

      let stepLabel = 'สำเร็จ';
      if (result.data) {
        if (Array.isArray(result.data)) stepLabel = `${result.data.length} รายการ`;
        else if (step.action === 'fetch' && result.data.name) stepLabel = `พบข้อมูล: ${result.data.name}`;
        else if (result.data.created !== undefined) stepLabel = `บันทึกแล้ว ${result.data.created} รายการ`;
        else if (step.action === 'execute' && result.data.id) stepLabel = 'สร้างสำเร็จ';
        else stepLabel = 'สำเร็จ';
      }
      results.push(`✓ ${label}: ${stepLabel}`);
    }
    return { text: `${actionData.description || 'Automation'}\n\n${results.join('\n')}`, tableData: lastData };
  };

  // Shared logic: process AI response content → finalContent + tableData
  const processAIContent = async (content: string, prompt: string): Promise<{ finalContent: string; tableData?: any[] }> => {
    let finalContent = content;
    let tableData: any[] | undefined;
    const actionData = extractJSON(content);

    if (!actionData?.action) return { finalContent, tableData };

    try {
      if (actionData.action === 'query') {
        const result = await executeAction(actionData);
        if (result.success && result.data?.length > 0) {
          tableData = result.data;
          const queryResult = JSON.stringify(result.data).substring(0, 15000);
          try {
            const followUp: any = await apiFetch('/chat.php', {
              method: 'POST',
              body: JSON.stringify({
                model: selectedModel,
                messages: [
                  { role: 'system', content: 'You are a helpful data analyst. Analyze the query results and answer in Thai. Be concise.' },
                  { role: 'user', content: `คำถามเดิม: ${prompt}\n\nSQL: ${actionData.sql}\n\nผลลัพธ์:\n${queryResult}\n\nวิเคราะห์ข้อมูลนี้และตอบเป็นภาษาไทย` },
                ],
              }),
            });
            // apiFetch returns json.data already — so followUp is the data object
            const choices = followUp?.choices ?? followUp?.data?.choices;
            if (choices?.[0]?.message?.content) {
              finalContent = choices[0].message.content;
            } else {
              finalContent = `ผลลัพธ์จากฐานข้อมูล (${result.data.length} รายการ):`;
            }
          } catch {
            finalContent = `ผลลัพธ์จากฐานข้อมูล (${result.data.length} รายการ):`;
          }
        } else if (result.success) {
          finalContent = 'ไม่พบข้อมูลที่ตรงกับเงื่อนไข (0 rows)';
        } else {
          finalContent = `เกิดข้อผิดพลาดในการ query: ${result.error}`;
        }
      } else if (actionData.action === 'execute') {
        const result = await executeAction(actionData);
        if (result.success) {
          const desc = actionData.description || actionData.endpoint;
          const extra = result.data?.created !== undefined ? ` (${result.data.created} รายการ)` : '';
          finalContent = `✓ ดำเนินการสำเร็จ: ${desc}${extra}`;
          if (result.data && typeof result.data === 'object') {
            tableData = Array.isArray(result.data) ? result.data : [result.data];
          }
        } else {
          finalContent = `✗ ดำเนินการไม่สำเร็จ: ${result.error}`;
        }
      } else if (actionData.action === 'multi') {
        // If ALL steps are queries → run them in parallel and do a combined AI analysis
        const steps: any[] = actionData.steps || [];
        const allQueries = steps.length > 0 && steps.every((s: any) => s.action === 'query');
        if (allQueries) {
          const queryResults: Array<{ description: string; data: any[] }> = [];
          for (const step of steps) {
            try {
              const r = await executeAction(step);
              queryResults.push({ description: step.description || 'ข้อมูล', data: Array.isArray(r.data) ? r.data : [] });
            } catch { queryResults.push({ description: step.description || 'ข้อมูล', data: [] }); }
          }
          const allData = queryResults.flatMap(r => r.data);
          tableData = allData.length > 0 ? allData : undefined;
          const combinedCtx = queryResults
            .map(r => `## ${r.description} (${r.data.length} รายการ)\n${JSON.stringify(r.data.slice(0, 200)).substring(0, 8000)}`)
            .join('\n\n');
          try {
            const followUp: any = await apiFetch('/chat.php', {
              method: 'POST',
              body: JSON.stringify({
                model: selectedModel,
                messages: [
                  { role: 'system', content: 'You are a helpful assistant. Analyze the query results and answer in Thai. Be concise and friendly.' },
                  { role: 'user', content: `คำถามเดิม: ${prompt}\n\nข้อมูลจากระบบ:\n${combinedCtx}\n\nสรุปและตอบเป็นภาษาไทย` },
                ],
              }),
            });
            const choices = followUp?.choices ?? followUp?.data?.choices;
            finalContent = choices?.[0]?.message?.content
              || queryResults.map(r => `**${r.description}**: ${r.data.length} รายการ`).join('\n');
          } catch {
            finalContent = queryResults.map(r => `**${r.description}**: ${r.data.length} รายการ`).join('\n');
          }
        } else {
          const multiResult = await executeMulti(actionData);
          finalContent = multiResult.text;
          tableData = multiResult.tableData;
        }
      }
    } catch (execError: any) {
      finalContent = `เกิดข้อผิดพลาดในการดำเนินการ: ${execError.message}`;
    }

    return { finalContent, tableData };
  };

  // Quick action handler
  const handleQuickAction = useCallback((prompt: string) => {
    if (!selectedModel) {
      toast({ title: 'Select Model', description: 'กรุณาเลือก AI model ก่อน', variant: 'destructive' });
      return;
    }
    const userMessage: Message = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    (async () => {
      try {
        const sessionId = await ensureSession(prompt);
        if (sessionId) saveMessage(sessionId, userMessage);

        const systemMessage: Message = { role: 'system', content: getSystemPrompt(user ?? undefined, activePersona, chatContextPrompt) };
        const response: any = await apiFetch('/chat.php', {
          method: 'POST',
          body: JSON.stringify({
            model: selectedModel,
            messages: [systemMessage, userMessage].map(m => ({ role: m.role, content: m.content })),
          }),
        });

        const choices = response?.choices ?? response?.data?.choices;
        if (!choices?.[0]?.message?.content) {
          const err = response?.error?.message || response?.data?.error?.message;
          throw new Error(err || 'No content received');
        }
        const content = choices[0].message.content;
        const { finalContent, tableData } = await processAIContent(content, prompt);

        const assistantMessage: Message = { role: 'assistant', content: finalContent, tableData };
        setMessages(prev => [...prev, assistantMessage]);
        if (sessionId) saveMessage(sessionId, assistantMessage);
      } catch (err: any) {
        const errorMsg = err.message || 'เกิดข้อผิดพลาด';
        const errorMessage: Message = { role: 'assistant', content: `ข้อผิดพลาด: ${errorMsg}` };
        setMessages(prev => [...prev, errorMessage]);
        toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedModel, ensureSession, saveMessage, toast, user, activePersona, chatContextPrompt]);

  const handleNotificationAction = useCallback((notif: any) => {
    dismissNotification(notif.id);
    if (notif.action_data) {
      try {
        const d = JSON.parse(notif.action_data);
        if (d.prompt) handleQuickAction(d.prompt);
      } catch {}
    }
  }, [dismissNotification, handleQuickAction]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    if (!selectedModel) {
      toast({ title: 'Select Model', description: 'กรุณาเลือก AI model ก่อน', variant: 'destructive' });
      return;
    }

    const userMessage: Message = { role: 'user', content: input.trim() };
    const currentInput = input.trim();
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const sessionId = await ensureSession(currentInput);
      if (sessionId) saveMessage(sessionId, userMessage);

      const systemMessage: Message = { role: 'system', content: getSystemPrompt(user ?? undefined, activePersona, chatContextPrompt) };
      const response: any = await apiFetch('/chat.php', {
        method: 'POST',
        body: JSON.stringify({
          model: selectedModel,
          messages: [systemMessage, ...messages.slice(-12), userMessage].map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const choices = response?.choices ?? response?.data?.choices;
      if (!choices?.[0]?.message?.content) {
        const err = response?.error?.message || response?.data?.error?.message;
        throw new Error(err || 'No content received');
      }
      const content = choices[0].message.content;
      const { finalContent, tableData } = await processAIContent(content, currentInput);

      const aiMessage: Message = { role: 'assistant', content: finalContent, tableData };
      setMessages(prev => [...prev, aiMessage]);
      if (sessionId) saveMessage(sessionId, aiMessage);

      if (sessionId && messages.length === 0) {
        try {
          await apiFetch('/chat-history.php', {
            method: 'POST',
            body: JSON.stringify({ action: 'update_title', session_id: sessionId, title: currentInput.substring(0, 80) }),
          });
          loadSessions();
        } catch {}
      }
    } catch (error: any) {
      const errMsg = error.message || 'Failed to send message';
      let displayMsg = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
      if (errMsg.includes('API key not configured') || errMsg.includes('AI API key')) displayMsg = 'ยังไม่ได้ตั้งค่า API Key — กรุณาไปที่ Admin > AI Settings เพื่อเพิ่ม API Key ก่อนใช้งาน AI Chat';
      else if (errMsg.includes('401') || errMsg.includes('User not found')) displayMsg = 'API Token หมดอายุหรือไม่ถูกต้อง กรุณาอัปเดต Token ใน api/chat.php';
      else if (errMsg.includes('429')) displayMsg = 'AI Service ใช้งานเกินขีดจำกัดชั่วคราว (Rate Limit) — กรุณารอสักครู่แล้วลองใหม่ หรือเปลี่ยน Model';
      else if (errMsg.includes('context_length_exceeded') || errMsg.includes('maximum context length') || errMsg.includes('token limit')) displayMsg = 'ข้อความยาวเกินขีดจำกัด — ลองแบ่งส่งเป็นวันละ 2-3 task หรือลองเปลี่ยน Model ที่รองรับ context ยาวกว่า';
      else if (errMsg.includes('500')) displayMsg = 'AI Service ไม่สามารถใช้งานได้ชั่วคราว ลองเปลี่ยน Model หรือลองใหม่ภายหลัง';
      else if (errMsg.includes('timeout') || errMsg.includes('Timeout')) displayMsg = 'หมดเวลาการเชื่อมต่อ ลองส่งข้อความสั้นลงหรือเปลี่ยน Model';
      const toastMsg = (errMsg.includes('API key not configured') || errMsg.includes('AI API key'))
        ? 'ยังไม่ได้ตั้งค่า AI API Key — ไปที่ Admin > AI Settings'
        : errMsg;
      toast({ title: 'Error', description: toastMsg, variant: 'destructive' });
      setMessages(prev => [...prev, { role: 'assistant', content: displayMsg }]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key in textarea (Enter = send, Shift+Enter = newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Render: Closed state (FAB) ---
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-4 sm:right-6 z-50">
        <button
          className="relative h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground flex items-center justify-center transition-all duration-300 active:scale-95 hover:bg-primary/90 hover:scale-105"
          onClick={() => setIsOpen(true)}
          aria-label="เปิด AI Chat"
        >
          <MessageSquare className="h-6 w-6" />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  // --- Render: History sidebar ---
  const renderHistory = () => (
    <div className="flex flex-col h-full">
      {/* History header */}
      <div className="px-3 py-3 border-b flex items-center justify-between bg-primary/5 shrink-0">
        <div className="flex items-center gap-1">
          <button
            className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            onClick={() => { setShowHistory(false); }}
            aria-label="กลับ"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">ประวัติแชท</span>
        </div>
        <button
          className="h-11 px-4 flex items-center gap-1.5 text-sm font-medium rounded-xl border border-border hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          onClick={startNewChat}
        >
          <Plus className="h-4 w-4" /> แชทใหม่
        </button>
      </div>

      <ScrollArea className="flex-1">
        {sessionsLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center p-8 text-sm text-muted-foreground">ยังไม่มีประวัติแชท</div>
        ) : (
          <div className="p-2 space-y-0.5">
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadSession(s)}
                className={`group flex items-center gap-2 px-3 py-3 rounded-xl cursor-pointer transition-colors ${
                  currentSessionId === s.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{s.message_count} ข้อความ</span>
                    <span className="text-[10px] text-muted-foreground">{formatSessionDate(s.updated_at)}</span>
                  </div>
                </div>
                {/* Delete — always visible on touch devices, hover-only on desktop */}
                <button
                  className="h-9 w-9 flex items-center justify-center rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-all"
                  onClick={(e) => deleteSession(s.id, e)}
                  aria-label="ลบ"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const renderDashboard = () => {
    if (overviewLoading || (!overviewData && !overviewError)) {
      return (
        <div className="flex flex-col h-full">
          <div className="px-3 py-3 border-b flex items-center justify-between bg-primary/5 shrink-0">
            <div className="flex items-center gap-1">
              <button
                className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                onClick={() => { setShowDashboard(false); }}
                aria-label="กลับ"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-semibold">ภาพรวมข้อมูลปัจจุบัน</span>
            </div>
          </div>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      );
    }

    if (overviewError || !overviewData) {
      return (
        <div className="flex flex-col h-full">
          <div className="px-3 py-3 border-b flex items-center justify-between bg-primary/5 shrink-0">
            <div className="flex items-center gap-1">
              <button
                className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                onClick={() => { setShowDashboard(false); }}
                aria-label="กลับ"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-semibold">ภาพรวมข้อมูลปัจจุบัน</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center p-8 gap-3 text-center">
            <span className="text-sm text-muted-foreground">ไม่สามารถโหลดข้อมูลได้</span>
            <button
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['current-overview'] })}
            >
              ลองใหม่
            </button>
          </div>
        </div>
      );
    }

    const stats = overviewData.stats;
    const recent = overviewData.recent_items;

    return (
      <div className="flex flex-col h-full">
        {/* Dashboard header */}
        <div className="px-3 py-3 border-b flex items-center justify-between bg-primary/5 shrink-0">
          <div className="flex items-center gap-1">
            <button
              className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              onClick={() => { setShowDashboard(false); }}
              aria-label="กลับ"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold">ภาพรวมข้อมูลปัจจุบัน</span>
          </div>
          <button
            className="h-9 px-3 flex items-center gap-1.5 text-xs font-medium rounded-xl border border-border hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            onClick={() => { setShowDashboard(false); handleQuickAction('สรุปภาพรวมสถานะงาน โปรเจกต์ และ opportunity ให้หน่อย'); }}
          >
            <Sparkles className="h-3.5 w-3.5" /> ถามเกี่ยวกับข้อมูลนี้
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {/* Overview stats cards */}
            <div className="grid grid-cols-2 gap-2">
              {/* Projects */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <ListTodo className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">โปรเจกต์</span>
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.projects.total}</div>
                <div className="text-[10px] text-blue-700 dark:text-blue-300 mt-1">
                  กำลังทำ {stats.projects.active} | เสี่ยง {stats.projects.at_risk}
                </div>
              </div>

              {/* Tasks */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold text-amber-900 dark:text-amber-100">งานของฉัน</span>
                </div>
                <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">{stats.tasks.total}</div>
                <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">
                  รอดำเนินการ {stats.tasks.pending} | กำลังทำ {stats.tasks.in_progress}
                </div>
              </div>

              {/* Opportunities */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-3 rounded-xl border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-semibold text-green-900 dark:text-green-100">โอกาสขาย</span>
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.opportunities.total}</div>
                <div className="text-[10px] text-green-700 dark:text-green-300 mt-1">
                  มูลค่า pipeline {stats.opportunities.pipeline_value.toLocaleString()} ฿
                </div>
              </div>

              {/* Support Tickets */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-3 rounded-xl border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-semibold text-purple-900 dark:text-purple-100">Ticket ที่เปิดอยู่</span>
                </div>
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.support_tickets.total}</div>
                <div className="text-[10px] text-purple-700 dark:text-purple-300 mt-1">
                  วิกฤต {stats.support_tickets.critical} | สูง {stats.support_tickets.high}
                </div>
              </div>
            </div>

            {/* Timesheet & Companies row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 p-3 rounded-xl border border-cyan-200 dark:border-cyan-800">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-semibold text-cyan-900 dark:text-cyan-100">เวลาทำงานสัปดาห์นี้</span>
                </div>
                <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{stats.task_hours.this_week_hours.toFixed(1)}</div>
                <div className="text-[10px] text-cyan-700 dark:text-cyan-300 mt-1">
                  {stats.task_hours.this_week_entries} รายการ
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">บริษัท & ลูกค้า</span>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.companies.total}</div>
                <div className="text-[10px] text-slate-700 dark:text-slate-300 mt-1">
                  {stats.companies.customers} ลูกค้า
                </div>
              </div>
            </div>

            {/* Recent items tables */}
            {recent.tasks && recent.tasks.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                  <span className="text-xs font-semibold text-amber-900 dark:text-amber-100">งานล่าสุด</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recent.tasks.slice(0, 5).map((task: any, i: number) => (
                    <div key={i} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{task.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              task.status === 'completed' ? 'bg-green-100 text-green-700' :
                              task.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                              task.status === 'overdue' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {task.status}
                            </span>
                            {task.priority && (
                              <span className="text-[10px] text-muted-foreground">{task.priority}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recent.projects && recent.projects.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                  <span className="text-xs font-semibold text-blue-900 dark:text-blue-100">โปรเจกต์ล่าสุด</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recent.projects.slice(0, 5).map((project: any, i: number) => (
                    <div key={i} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{project.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              project.status === 'completed' ? 'bg-green-100 text-green-700' :
                              project.status === 'at-risk' || project.status === 'delayed' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {project.status}
                            </span>
                            {project.company_name && (
                              <span className="text-[10px] text-muted-foreground">{project.company_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recent.opportunities && recent.opportunities.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
                  <span className="text-xs font-semibold text-green-900 dark:text-green-100">โอกาสขายล่าสุด</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recent.opportunities.slice(0, 5).map((opp: any, i: number) => (
                    <div key={i} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{opp.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              opp.stage === 'won' ? 'bg-green-100 text-green-700' :
                              opp.stage === 'lost' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {opp.stage}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{Number(opp.value).toLocaleString()} ฿</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recent.support_tickets && recent.support_tickets.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800">
                  <span className="text-xs font-semibold text-purple-900 dark:text-purple-100">Ticket ล่าสุด</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recent.support_tickets.slice(0, 5).map((ticket: any, i: number) => (
                    <div key={i} className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{ticket.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              ticket.priority === 'critical' ? 'bg-red-100 text-red-700' :
                              ticket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                              ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {ticket.priority}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{ticket.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderReports = () => (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b flex items-center justify-between bg-primary/5 shrink-0">
        <div className="flex items-center gap-1">
          <button
            className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setShowReports(false)}
            aria-label="กลับ"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">รายงาน AI ทั้งหมด</span>
        </div>
        <button
          className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          onClick={loadReports}
          title="รีเฟรช"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        {reportsLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center p-8 text-sm text-muted-foreground">ยังไม่มีรายงานที่บันทึกไว้</div>
        ) : (
          <div className="p-2 space-y-0.5">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => {
                  setMessages([{ role: 'assistant', content: report.content, tableData: Array.isArray(report.table_data) ? report.table_data : undefined }]);
                  setCurrentSessionId(null);
                  setShowReports(false);
                }}
                className="group flex items-center gap-2 px-3 py-3 rounded-xl cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{report.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{report.report_type}</span>
                    <span className="text-[10px] text-muted-foreground">{formatSessionDate(report.created_at)}</span>
                  </div>
                </div>
                <button
                  className="h-9 w-9 flex items-center justify-center rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-all"
                  onClick={(e) => deleteReport(report.id, e)}
                  aria-label="ลบ"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // --- Render: Main chat ---
  const wrapperClass = isMaximized
    ? 'fixed inset-0 sm:inset-4 z-50'
    : 'fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[390px]';

  const wrapperStyle = isMaximized
    ? {}
    : { height: 'min(84dvh, 640px)' };

  // Safe-area bottom padding for footer (iOS home bar)
  const footerPb = 'pb-[max(0.625rem,calc(env(safe-area-inset-bottom,0px)+0.25rem))]';

  return (
    <>
      {isMaximized && (
        <div className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200" onClick={() => setIsMaximized(false)} />
      )}
      <div
        className={`${wrapperClass} animate-in fade-in slide-in-from-bottom-4 duration-300`}
        style={wrapperStyle}
      >
        <Card className={cardClass}>
          {showHistory ? renderHistory() : showReports ? renderReports() : showDashboard ? renderDashboard() : (
            <>
              {/* ── Header ── */}
              <CardHeader className="p-0 border-b bg-primary/5 shrink-0">
                {/* Row 1: title + action buttons */}
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bot className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold truncate">Flowstack AI</span>
                  </div>
                  <div className="flex items-center shrink-0">
                    {/* Dashboard */}
                    <button
                      className={`h-11 w-11 flex items-center justify-center rounded-xl transition-colors ${showDashboard ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 active:bg-primary/20'}`}
                      onClick={() => { setShowDashboard(v => !v); setShowHistory(false); setShowReports(false); }}
                      title="ภาพรวมข้อมูล"
                    >
                      <LayoutDashboard className="h-[18px] w-[18px]" />
                    </button>
                    {/* History */}
                    <button
                      className={`h-11 w-11 flex items-center justify-center rounded-xl transition-colors ${showHistory ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 active:bg-primary/20'}`}
                      onClick={() => { loadSessions(); setShowHistory(v => !v); setShowReports(false); setShowDashboard(false); }}
                      title="ประวัติแชท"
                    >
                      <History className="h-[18px] w-[18px]" />
                    </button>
                    <button
                      className={`h-11 w-11 flex items-center justify-center rounded-xl transition-colors ${showReports ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10 active:bg-primary/20'}`}
                      onClick={() => { loadReports(); setShowReports(v => !v); setShowHistory(false); setShowDashboard(false); }}
                      title="รายงานทั้งหมด"
                    >
                      <FileText className="h-[18px] w-[18px]" />
                    </button>
                    {/* New chat */}
                    <button
                      className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-primary/10 active:bg-primary/20 transition-colors"
                      onClick={startNewChat}
                      title="แชทใหม่"
                    >
                      <Plus className="h-[18px] w-[18px]" />
                    </button>
                    {/* Maximize — hide on mobile (they get full screen by default) */}
                    <button
                      className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl hover:bg-primary/10 active:bg-primary/20 transition-colors"
                      onClick={() => setIsMaximized(!isMaximized)}
                      title={isMaximized ? 'ย่อ' : 'ขยาย'}
                    >
                      {isMaximized ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}
                    </button>
                    {/* Close */}
                    <button
                      className="h-11 w-11 flex items-center justify-center rounded-xl hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20 transition-colors"
                      onClick={() => { setIsOpen(false); setIsMaximized(false); }}
                      aria-label="ปิด"
                    >
                      <X className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>

                {/* Row 2: model + persona selectors */}
                <div className="flex items-center gap-1.5 px-3 pb-2.5 min-w-0">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium shrink-0">Model:</span>
                  <div className="flex-1 min-w-0">
                    <ModelCombobox
                      models={models}
                      value={selectedModel}
                      onChange={setSelectedModel}
                      placeholder={models.length ? 'ค้นหาโมเดล...' : 'Loading...'}
                      disabled={models.length === 0 || loading}
                      emptyMessage="ไม่พบโมเดล"
                    />
                  </div>
                  {personas.length > 0 && (
                    <Select value={activePersona?.id || ''} onValueChange={handlePersonaChange} disabled={loading}>
                      <SelectTrigger className="h-8 text-[11px] bg-background w-24 sm:w-32 shrink-0 border-primary/20 focus:ring-primary/20">
                        <SelectValue placeholder="บทบาท" />
                      </SelectTrigger>
                      <SelectContent>
                        {personas.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.avatar_emoji} {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>

              {/* ── Messages ── */}
              <CardContent className="flex-1 p-0 overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 min-h-0">
                <ScrollArea className="h-full">
                  <div className={`flex flex-col gap-3 p-4 pb-2 ${isMaximized ? 'max-w-3xl mx-auto' : ''}`}>

                    {/* Empty state */}
                    {messages.length === 0 && (
                      <>
                        <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in duration-500">
                          <div className="bg-primary/10 p-4 rounded-full mb-3">
                            <Bot className="h-8 w-8 text-primary/60" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">สวัสดี! มีอะไรให้ช่วยไหม?</p>
                          <p className="text-xs mt-1 text-muted-foreground">สอบถาม สร้างข้อมูล หรือบันทึกเวลาทำงาน</p>
                        </div>

                        {/* Proactive notifications */}
                        {notifications.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {notifications.map(n => (
                              <div key={n.id} className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
                                <BellRing className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-tight">{n.title}</p>
                                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 leading-tight">{n.body}</p>
                                  {n.action_label && (
                                    <button onClick={() => handleNotificationAction(n)} className="text-xs font-medium text-primary mt-1 hover:underline">
                                      {n.action_label} →
                                    </button>
                                  )}
                                </div>
                                <button onClick={() => dismissNotification(n.id)} className="shrink-0 text-amber-400 hover:text-amber-600">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Quick actions — 2-column grid, tap-friendly */}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { icon: <ListTodo className="h-4 w-4 text-primary" />, label: 'สร้าง task', action: 'create-task' },
                            { icon: <Zap className="h-4 w-4 text-amber-500" />, label: 'งานค้าง', prompt: 'แสดงงานที่เกินกำหนดทั้งหมดของฉัน พร้อมแนะนำวิธีจัดการ' },
                            { icon: <ClipboardList className="h-4 w-4 text-blue-500" />, label: 'งานของฉัน', prompt: 'แสดงงานทั้งหมดของฉันที่ยังไม่เสร็จ' },
                            { icon: <Gauge className="h-4 w-4 text-green-500" />, label: 'โอกาสขาย', action: 'create-opportunity' },
                            { icon: <TrendingUp className="h-4 w-4 text-green-600" />, label: 'พยากรณ์รายได้', prompt: 'คำนวณ weighted pipeline forecast สำหรับ opportunities ที่ยังเปิดอยู่ทั้งหมด' },
                            { icon: <Sparkles className="h-4 w-4 text-violet-500" />, label: 'ใบเสนอราคา', action: 'create-quotation' },
                            { icon: <Building2 className="h-4 w-4 text-slate-500" />, label: 'เพิ่มบริษัท', action: 'create-company' },
                            { icon: <LayoutDashboard className="h-4 w-4 text-primary" />, label: 'ดูภาพรวม', action: 'dashboard' },
                          ].map(({ icon, label, prompt, action }) => (
                            <button
                              key={label}
                              disabled={loading}
                              onClick={() => {
                                if (action === 'dashboard') {
                                  setShowDashboard(true);
                                } else if (action === 'create-task') {
                                  const activeProjects = (projects as any[]).filter(p => p.status !== 'cancelled' && p.status !== 'completed');
                                  const projectNames = activeProjects.map((p: any) => p.name);
                                  const prefill = projectNames.length > 0
                                    ? `สร้าง task ใน project "${projectNames[0]}" ชื่อ: `
                                    : 'สร้าง task ใน project ';
                                  setInput(prefill);
                                  setTimeout(() => textareaRef.current?.focus(), 50);
                                } else if (action === 'create-opportunity') {
                                  setInput('สร้าง opportunity ใหม่ บริษัท: ');
                                  setTimeout(() => textareaRef.current?.focus(), 50);
                                } else if (action === 'create-quotation') {
                                  setInput('สร้างใบเสนอราคาใหม่ บริษัท: ');
                                  setTimeout(() => textareaRef.current?.focus(), 50);
                                } else if (action === 'create-company') {
                                  setInput('เพิ่มบริษัทใหม่ ชื่อ: ');
                                  setTimeout(() => textareaRef.current?.focus(), 50);
                                } else {
                                  handleQuickAction(prompt!);
                                }
                              }}
                              className="flex items-center gap-2.5 px-3 py-3 rounded-xl border border-border bg-background hover:bg-primary/5 active:bg-primary/10 active:scale-[0.98] transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span className="shrink-0">{icon}</span>
                              <span className="text-sm font-medium leading-tight">{label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Messages */}
                    {messages.map((msg, i) => (
                      <MessageBubble
                        key={i}
                        msg={msg}
                        isMaximized={isMaximized}
                        onSaveReport={msg.role === 'assistant' ? () => saveReportFromMessage(msg, i) : undefined}
                        disableSaveReport={savingReportIndex === i}
                      />
                    ))}

                    {/* Loading indicator */}
                    {loading && (
                      <div className="flex justify-start animate-in fade-in zoom-in duration-300">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground font-medium">กำลังประมวลผล...</span>
                        </div>
                      </div>
                    )}
                    <div ref={scrollRef} className="h-1 w-full" />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* ── Input footer ── */}
              <CardFooter className={`px-2.5 pt-2.5 ${footerPb} border-t bg-background shrink-0`}>
                <form className="flex w-full gap-2 items-end" onSubmit={handleSend}>
                  <Textarea
                    ref={textareaRef}
                    placeholder="พิมพ์ข้อความ..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    rows={1}
                    className="flex-1 min-h-[44px] max-h-[120px] resize-none focus-visible:ring-1 focus-visible:ring-primary/30 border-primary/20 bg-background text-sm py-3 leading-normal overflow-y-auto"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim() || !selectedModel}
                    className="h-11 w-11 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center transition-all active:scale-95 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="ส่ง"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </form>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
