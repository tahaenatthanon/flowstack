import { useState } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// field ปลายทางในตาราง leads ที่ผู้ใช้ map คอลัมน์เข้าไปได้
const LEAD_FIELDS: { key: string; label: string }[] = [
  { key: 'name', label: 'ชื่อบริษัท/ลูกค้า *' },
  { key: 'contact_name', label: 'ชื่อผู้ติดต่อ' },
  { key: 'email', label: 'อีเมล' },
  { key: 'phone', label: 'เบอร์โทร' },
  { key: 'website', label: 'เว็บไซต์' },
  { key: 'business_type', label: 'ประเภทธุรกิจ' },
  { key: 'company_desc', label: 'รายละเอียด' },
];

const NONE = '__none__';

const COMPANY_TYPES: { value: string; label: string }[] = [
  { value: 'customer', label: 'ลูกค้า' },
  { value: 'partner', label: 'คู่ค้า' },
  { value: 'manufacturer', label: 'ผู้ผลิต' },
];

type Row = Record<string, unknown>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

export default function ImportLeadsDialog({ open, onOpenChange, onImported }: Props) {
  const { toast } = useToast();
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [companyType, setCompanyType] = useState('customer');

  const reset = () => {
    setColumns([]); setRows([]); setMapping({}); setFileName(''); setCompanyType('customer');
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' });
      if (json.length === 0) { toast({ title: 'ไฟล์ว่างเปล่า', variant: 'destructive' }); return; }
      const cols = Object.keys(json[0]);
      setColumns(cols);
      setRows(json);
      setFileName(file.name);
      // auto-map คอลัมน์ที่ชื่อใกล้เคียง
      const auto: Record<string, string> = {};
      for (const f of LEAD_FIELDS) {
        const hit = cols.find((c) => {
          const lc = c.toLowerCase().trim();
          return lc === f.key || lc.includes(f.key) ||
            (f.key === 'name' && (lc.includes('บริษัท') || lc.includes('ชื่อ') || lc === 'company')) ||
            (f.key === 'email' && lc.includes('อีเมล')) ||
            (f.key === 'phone' && (lc.includes('โทร') || lc.includes('tel')));
        });
        if (hit) auto[f.key] = hit;
      }
      setMapping(auto);
    } catch (e) {
      toast({ title: 'อ่านไฟล์ไม่สำเร็จ', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const doImport = async () => {
    const nameCol = mapping['name'];
    if (!nameCol) { toast({ title: 'กรุณา map คอลัมน์ "ชื่อบริษัท/ลูกค้า"', variant: 'destructive' }); return; }
    const payload = rows.map((r) => {
      const lead: Record<string, string> = {};
      for (const f of LEAD_FIELDS) {
        const col = mapping[f.key];
        if (col) lead[f.key] = String(r[col] ?? '').trim();
      }
      return lead;
    }).filter((l) => l.name);

    if (payload.length === 0) { toast({ title: 'ไม่มีแถวที่มีชื่อ', variant: 'destructive' }); return; }

    setImporting(true);
    try {
      const res = await apiFetch<{ inserted: number; skipped: number }>(
        '/leads.php?action=bulk',
        { method: 'POST', body: JSON.stringify({ source: 'csv', company_type: companyType, leads: payload }) },
      );
      toast({ title: `นำเข้า ${res.inserted} รายการสำเร็จ`, description: res.skipped ? `ข้าม ${res.skipped} รายการ` : undefined });
      onImported();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'นำเข้าไม่สำเร็จ', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>นำเข้า leads จากไฟล์ CSV/Excel</DialogTitle>
          <DialogDescription>อัปโหลดไฟล์ จับคู่คอลัมน์กับฟิลด์ แล้วนำเข้า</DialogDescription>
        </DialogHeader>

        {columns.length === 0 ? (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-12 cursor-pointer hover:bg-muted/50 transition">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground/50" />
            <span className="text-sm text-muted-foreground">คลิกเพื่อเลือกไฟล์ .csv / .xlsx</span>
            <input
              type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> {fileName} — {rows.length} แถว
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">นำเข้าเป็นประเภท</span>
              <Select value={companyType} onValueChange={setCompanyType}>
                <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border divide-y max-h-[40vh] overflow-y-auto">
              {LEAD_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3 p-2">
                  <span className="text-sm">{f.label}</span>
                  <Select
                    value={mapping[f.key] ?? NONE}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === NONE ? '' : v }))}
                  >
                    <SelectTrigger className="w-[220px] h-8"><SelectValue placeholder="— ไม่ใช้ —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— ไม่ใช้ —</SelectItem>
                      {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {columns.length > 0 && (
            <Button variant="ghost" onClick={reset}>เลือกไฟล์ใหม่</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={doImport} disabled={columns.length === 0 || importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            นำเข้า
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
