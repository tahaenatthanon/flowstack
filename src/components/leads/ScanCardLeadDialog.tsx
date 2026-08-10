import { useState } from 'react';
import { apiFetch, apiUpload } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScanLine, Loader2, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const COMPANY_TYPES: { value: string; label: string }[] = [
  { value: 'customer', label: 'ลูกค้า' },
  { value: 'partner', label: 'คู่ค้า' },
  { value: 'manufacturer', label: 'ผู้ผลิต' },
];

interface Parsed {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  position?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
}

interface CardEntry {
  key: string;
  fileName: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  business_type: string;
  company_type: string;
  saved: boolean;
  saving: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

let cardSeq = 0;

export default function ScanCardLeadDialog({ open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [cards, setCards] = useState<CardEntry[]>([]);

  const reset = () => { setCards([]); setProgress(null); };

  const update = (key: string, patch: Partial<CardEntry>) =>
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const handleScan = async (files: FileList) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setScanning(true);
    setProgress({ done: 0, total: list.length });
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await apiUpload<{ parsed?: Parsed; data?: { parsed?: Parsed } }>('/business-card-scan.php', fd);
        const p = (res?.data?.parsed ?? res?.parsed ?? {}) as Parsed;
        const contact = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
        setCards((prev) => [...prev, {
          key: `c${++cardSeq}`,
          fileName: file.name,
          name: p.company_name || contact || '',
          contact_name: contact,
          email: p.email || '',
          phone: p.phone || '',
          website: p.website || '',
          address: p.address || '',
          business_type: p.position || '',
          company_type: 'customer',
          saved: false,
          saving: false,
        }]);
        ok++;
      } catch (e) {
        toast({ title: `สแกน "${file.name}" ไม่สำเร็จ`, description: (e as Error).message, variant: 'destructive' });
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setScanning(false);
    setProgress(null);
    if (ok > 0) toast({ title: `สแกนสำเร็จ ${ok} ใบ — ตรวจสอบข้อมูลก่อนบันทึก` });
  };

  const saveCard = async (card: CardEntry): Promise<boolean> => {
    if (!card.name.trim()) {
      toast({ title: `กรุณาระบุชื่อ (${card.fileName})`, variant: 'destructive' });
      return false;
    }
    update(card.key, { saving: true });
    try {
      await apiFetch('/leads.php', {
        method: 'POST',
        body: JSON.stringify({
          name: card.name, contact_name: card.contact_name, email: card.email, phone: card.phone,
          website: card.website, address: card.address, business_type: card.business_type,
          company_type: card.company_type, source: 'business_card', source_note: 'จากการสแกนนามบัตร',
        }),
      });
      update(card.key, { saved: true, saving: false });
      return true;
    } catch (e) {
      update(card.key, { saving: false });
      toast({ title: 'บันทึกไม่สำเร็จ', description: (e as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const handleSaveOne = async (card: CardEntry) => {
    const ok = await saveCard(card);
    if (ok) { onSaved(); toast({ title: 'บันทึกเป็น lead แล้ว' }); }
  };

  const handleSaveAll = async () => {
    const pending = cards.filter((c) => !c.saved);
    let saved = 0;
    for (const c of pending) {
      // อ่านค่าล่าสุดจาก state ผ่าน closure ไม่ได้ตรง ๆ จึงใช้ค่า c (อัปเดตแล้วผ่าน update ระหว่างพิมพ์)
      const latest = cards.find((x) => x.key === c.key) ?? c;
      if (await saveCard(latest)) saved++;
    }
    if (saved > 0) {
      onSaved();
      toast({ title: `บันทึก ${saved} lead แล้ว` });
    }
  };

  const unsavedCount = cards.filter((c) => !c.saved).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>สแกนนามบัตรเป็น lead</DialogTitle>
          <DialogDescription>อัปโหลดรูปนามบัตรได้หลายใบพร้อมกัน ระบบจะใช้ AI อ่านข้อมูลให้ — ตรวจสอบแล้วบันทึกทีละใบหรือทั้งหมด</DialogDescription>
        </DialogHeader>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-6 cursor-pointer hover:bg-muted/50 transition">
          {scanning
            ? <><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  กำลังอ่านนามบัตร{progress ? ` ${progress.done}/${progress.total}` : ''}...
                </span></>
            : <><ScanLine className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">คลิกเพื่อเลือกรูปนามบัตร (เลือกได้หลายใบ)</span></>}
          <input
            type="file" accept="image/*" multiple className="hidden" disabled={scanning}
            onChange={(e) => { if (e.target.files) handleScan(e.target.files); e.target.value = ''; }}
          />
        </label>

        {cards.length > 0 && (
          <div className="space-y-3">
            {cards.map((card) => (
              <div key={card.key} className={`rounded-md border p-3 space-y-2 ${card.saved ? 'opacity-60 bg-muted/30' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">{card.fileName}</span>
                  <div className="flex items-center gap-1">
                    {card.saved ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> บันทึกแล้ว
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleSaveOne(card)} disabled={card.saving}>
                        {card.saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                        บันทึก
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                      onClick={() => setCards((prev) => prev.filter((c) => c.key !== card.key))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {!card.saved && (
                  <div className="grid gap-2">
                    <Input placeholder="ชื่อบริษัท/ลูกค้า *" value={card.name}
                      onChange={(e) => update(card.key, { name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="ชื่อผู้ติดต่อ" value={card.contact_name}
                        onChange={(e) => update(card.key, { contact_name: e.target.value })} />
                      <Input placeholder="ตำแหน่ง/ประเภท" value={card.business_type}
                        onChange={(e) => update(card.key, { business_type: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="อีเมล" value={card.email}
                        onChange={(e) => update(card.key, { email: e.target.value })} />
                      <Input placeholder="เบอร์โทร" value={card.phone}
                        onChange={(e) => update(card.key, { phone: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="เว็บไซต์" value={card.website}
                        onChange={(e) => update(card.key, { website: e.target.value })} />
                      <Select value={card.company_type} onValueChange={(v) => update(card.key, { company_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMPANY_TYPES.map((ct) => (
                            <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input placeholder="ที่อยู่" value={card.address}
                      onChange={(e) => update(card.key, { address: e.target.value })} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ปิด</Button>
          <Button onClick={handleSaveAll} disabled={scanning || unsavedCount === 0}>
            <Plus className="h-4 w-4 mr-2" /> บันทึกทั้งหมด ({unsavedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
