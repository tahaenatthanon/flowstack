import { useEffect, useMemo, useRef, useState } from 'react';
import { useCreateCompany, useCreateCustomer, useCompanies } from '@/hooks/useProjectData';
import { apiFetch, apiUpload } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Camera, CreditCard, Loader2, ScanSearch, Sparkles } from 'lucide-react';

type ParsedCard = {
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  email: string;
  phone: string;
  company_name: string;
  website: string;
  address: string;
  confidence: 'high' | 'medium' | 'low' | string;
};

type ScanResponse = {
  parsed: ParsedCard;
  field_confidence?: Record<string, 'high' | 'medium' | 'low' | string>;
  candidates: Array<{ id: string; name: string }>;
  match_reason?: string;
  model_used?: string;
};

const emptyParsed: ParsedCard = {
  full_name: '',
  first_name: '',
  last_name: '',
  position: '',
  email: '',
  phone: '',
  company_name: '',
  website: '',
  address: '',
  confidence: 'medium',
};

async function compressImage(file: File, maxPx = 1920, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ไม่สามารถโหลดรูปภาพได้')); };
    img.src = url;
  });
}

function normalizeName(v: string): string {
  return v
    .toLowerCase()
    .replace(/บริษัท|จำกัด|มหาชน|co\.?\s*,?\s*ltd\.?|ltd\.?|inc\.?|corp\.?|corporation|co\.?/g, '')
    .replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
}

export default function BusinessCardScanDialog() {
  const { toast } = useToast();
  const createCompany = useCreateCompany();
  const createCustomer = useCreateCustomer();
  const { data: companies = [] } = useCompanies(true);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cameraActiveRef = useRef(false);
  const cameraWasBlurredRef = useRef(false);
  // Shared timer ref — cancel previous timer before scheduling a new one to
  // prevent Timer A (from clearGuardAfterReturn) from overriding the re-arm
  // that onSelectFile sets when the file is actually chosen.
  const cameraGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleGuardClear = (delayMs = 1200) => {
    if (cameraGuardTimerRef.current) clearTimeout(cameraGuardTimerRef.current);
    cameraGuardTimerRef.current = setTimeout(() => {
      cameraActiveRef.current = false;
      cameraGuardTimerRef.current = null;
    }, delayMs);
  };

  useEffect(() => {
    const onBlur = () => {
      if (cameraActiveRef.current) cameraWasBlurredRef.current = true;
    };
    const clearGuardAfterReturn = () => {
      if (cameraActiveRef.current && cameraWasBlurredRef.current) {
        cameraWasBlurredRef.current = false;
        // 5000ms: mobile cameras can be slow to fire onChange after user confirms
        // the photo. onSelectFile cancels this timer and re-arms a short 300ms
        // one once the file is actually in hand.
        scheduleGuardClear(5000);
      }
      // Premature focus (before picker fully opened) — leave guard armed.
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (cameraActiveRef.current) cameraWasBlurredRef.current = true;
      } else {
        clearGuardAfterReturn();
      }
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', clearGuardAfterReturn);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', clearGuardAfterReturn);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const [parsed, setParsed] = useState<ParsedCard>(emptyParsed);
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string }>>([]);
  const [scanned, setScanned] = useState(false);
  const [fieldConfidence, setFieldConfidence] = useState<Record<string, string>>({});
  const [matchReason, setMatchReason] = useState('none');
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>('existing');
  const [selectedCompanyId, setSelectedCompanyId] = useState('__none__');

  const hasResult = scanned;

  const allCompanyOptions = useMemo(() => {
    const fromApi = candidates ?? [];
    const ids = new Set(fromApi.map((x) => x.id));
    const extra = companies
      .filter((c) => !ids.has(c.id))
      .map((c) => ({ id: c.id, name: c.name }));
    return [...fromApi, ...extra];
  }, [candidates, companies]);

  function resetState() {
    setFile(null);
    setPreviewUrl('');
    setScanning(false);
    setSaving(false);
    setParsed(emptyParsed);
    setFieldConfidence({});
    setCandidates([]);
    setMatchReason('none');
    setScanned(false);
    setCompanyMode('existing');
    setSelectedCompanyId('__none__');
  }

  function onOpenChange(v: boolean) {
    // Block close when camera/file picker is active (ref stays true for 300ms after selection)
    if (!v && cameraActiveRef.current) return;
    // Block close while scanning or saving to prevent accidental dismissal
    if (!v && (scanning || saving)) return;
    setOpen(v);
    if (!v) resetState();
  }

  function onSelectFile(f: File | null) {
    // Ignore null — mobile browsers often fire a second onChange with no file
    // (input reset) right after the real one, which would clear the preview.
    // If the user cancels the picker without selecting, keep the previous file.
    if (!f) return;

    // File chosen — cancel any pending 5000ms guard-clear timer and replace with
    // a short 300ms one; we already have the file so we only need to absorb
    // residual ghost taps from the native picker UI.
    cameraWasBlurredRef.current = false;
    cameraActiveRef.current = true;
    scheduleGuardClear(300);
    setFile(f);
    setScanned(false);
    setParsed(emptyParsed);
    setFieldConfidence({});
    setCandidates([]);
    setMatchReason('none');
    setSelectedCompanyId('__none__');
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  }

  async function handleScan() {
    if (!file) {
      toast({ title: 'กรุณาเลือกไฟล์ภาพนามบัตร', variant: 'destructive' });
      return;
    }

    setScanning(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append('file', compressed);
      const res = await apiUpload<any>('/business-card-scan.php', fd);
      const payload: ScanResponse = (res?.data ?? res) as ScanResponse;

      const nextParsed = payload?.parsed ?? emptyParsed;
      setParsed(nextParsed);
      setFieldConfidence(payload?.field_confidence ?? {});
      setCandidates(payload?.candidates ?? []);
      setMatchReason(payload?.match_reason ?? 'none');
      setScanned(true);

      const nameNeedle = normalizeName(nextParsed.company_name || '');
      const mergedCompanies = [
        ...(payload?.candidates ?? []),
        ...(companies.map((c) => ({ id: c.id, name: c.name }))),
      ];

      const matched = mergedCompanies.find((c) => normalizeName(c.name || '') === nameNeedle)
        ?? mergedCompanies.find((c) => {
          const n = normalizeName(c.name || '');
          return nameNeedle && (n.includes(nameNeedle) || nameNeedle.includes(n));
        });

      if (matched) {
        setCompanyMode('existing');
        setSelectedCompanyId(matched.id);
      } else {
        setCompanyMode('new');
      }

      toast({ title: 'สแกนนามบัตรสำเร็จ', description: 'ตรวจสอบข้อมูลก่อนบันทึกได้เลย' });
    } catch (e: any) {
      toast({ title: 'สแกนนามบัตรไม่สำเร็จ', description: e?.message || 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  }

  function normalizePhone(v: string): string {
    return (v || '').replace(/[^0-9+]/g, '');
  }

  async function handleSave(closeAfterSave = true) {
    const firstName = (parsed.first_name || '').trim();
    if (!firstName) {
      toast({ title: 'กรุณากรอกชื่อผู้ติดต่อ', variant: 'destructive' });
      return;
    }

    let companyId = selectedCompanyId;
    const companyName = (parsed.company_name || '').trim();

    if (companyMode === 'existing') {
      if (companyId === '__none__') {
        toast({ title: 'กรุณาเลือกบริษัท', variant: 'destructive' });
        return;
      }
    } else {
      if (!companyName) {
        toast({ title: 'กรุณากรอกชื่อบริษัทใหม่', variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      if (companyMode === 'new') {
        const createdCompany: any = await createCompany.mutateAsync({
          name: companyName,
          website: parsed.website || '',
          address: parsed.address || '',
          phone: parsed.phone || '',
          email: parsed.email || '',
        });
        companyId = createdCompany?.id;
        if (companyId) {
          setCompanyMode('existing');
          setSelectedCompanyId(companyId);
        }
      }

      if (!companyId || companyId === '__none__') {
        throw new Error('ไม่พบบริษัทสำหรับบันทึกผู้ติดต่อ');
      }

      const phoneKey = normalizePhone(parsed.phone || '');
      if (phoneKey) {
        const existing = await apiFetch<any[]>(`/customers.php?company_id=${companyId}`);
        const rows = Array.isArray(existing) ? existing : [];
        const dupPhone = rows.some((x: any) => normalizePhone(String(x?.phone || '')) === phoneKey);
        if (dupPhone) {
          throw new Error('เบอร์โทรนี้มีอยู่แล้วในบริษัทนี้');
        }
      }

      await createCustomer.mutateAsync({
        company_id: companyId,
        first_name: firstName,
        last_name: (parsed.last_name || '').trim(),
        email: (parsed.email || '').trim(),
        phone: (parsed.phone || '').trim(),
        position: (parsed.position || '').trim(),
        is_primary_contact: true,
        is_active: true,
      });

      toast({ title: 'บันทึกข้อมูลจากนามบัตรสำเร็จ' });
      if (closeAfterSave) {
        setOpen(false);
        resetState();
      } else {
        setParsed((prev) => ({
          ...prev,
          full_name: '',
          first_name: '',
          last_name: '',
          position: '',
          email: '',
          phone: '',
          confidence: 'medium',
        }));
      }
    } catch (e: any) {
      toast({ title: 'บันทึกข้อมูลไม่สำเร็จ', description: e?.message || 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const confidenceLabel = parsed.confidence === 'high' ? 'ความมั่นใจสูง' : parsed.confidence === 'low' ? 'ความมั่นใจต่ำ' : 'ความมั่นใจปานกลาง';
  const confidenceText = (k: string) => {
    const v = fieldConfidence[k] || 'medium';
    return v === 'high' ? 'สูง' : v === 'low' ? 'ต่ำ' : 'กลาง';
  };
  const matchReasonLabel =
    matchReason === 'exact-normalized'
      ? 'จับคู่บริษัท: ตรงกันแบบ normalize'
      : matchReason === 'partial-normalized'
        ? 'จับคู่บริษัท: ใกล้เคียงแบบ normalize'
        : matchReason === 'name-contains'
          ? 'จับคู่บริษัท: ชื่อใกล้เคียง'
          : 'จับคู่บริษัท: ไม่พบตรง';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ScanSearch className="h-4 w-4" />
          สแกนนามบัตร
        </Button>
      </DialogTrigger>
      <DialogContent
        className="w-full sm:max-w-3xl sm:max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { if (cameraActiveRef.current || scanning || saving) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">สแกนนามบัตร</DialogTitle>
          <DialogDescription>
            อัปโหลดรูปนามบัตร แล้วตรวจสอบข้อมูลก่อนสร้างบริษัทและผู้ติดต่อ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ไฟล์ภาพนามบัตร</Label>
              {/* hidden camera-only input */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="flex-1"
                  onClick={() => {
                    cameraActiveRef.current = true;
                    cameraWasBlurredRef.current = false;
                    if (cameraGuardTimerRef.current) clearTimeout(cameraGuardTimerRef.current);
                  }}
                  onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="ถ่ายรูปจากกล้อง"
                  onClick={() => {
                    cameraActiveRef.current = true;
                    cameraWasBlurredRef.current = false;
                    if (cameraGuardTimerRef.current) clearTimeout(cameraGuardTimerRef.current);
                    cameraInputRef.current?.click();
                  }}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">รองรับ .jpg .png .webp ขนาดไม่เกิน 8 MB · กดกล้องเพื่อถ่ายรูป</p>

              <Button type="button" onClick={handleScan} disabled={!file || scanning} className="gap-2">
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {scanning ? 'กำลังสแกน...' : 'สแกนด้วย AI'}
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 flex items-center justify-center min-h-[180px]">
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="max-h-44 object-contain rounded" />
              ) : (
                <div className="text-center text-muted-foreground text-sm">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  ยังไม่ได้เลือกรูปนามบัตร
                </div>
              )}
            </div>
          </div>

          {hasResult && (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{confidenceLabel}</Badge>
                <Badge variant="secondary">{matchReasonLabel}</Badge>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ชื่อ</Label>
                  <Input value={parsed.first_name} onChange={(e) => setParsed((p) => ({ ...p, first_name: e.target.value }))} />
                  <p className="text-[11px] text-muted-foreground">ความมั่นใจ: {confidenceText('first_name')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>นามสกุล</Label>
                  <Input value={parsed.last_name} onChange={(e) => setParsed((p) => ({ ...p, last_name: e.target.value }))} />
                  <p className="text-[11px] text-muted-foreground">ความมั่นใจ: {confidenceText('last_name')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>ตำแหน่ง</Label>
                  <Input value={parsed.position} onChange={(e) => setParsed((p) => ({ ...p, position: e.target.value }))} />
                  <p className="text-[11px] text-muted-foreground">ความมั่นใจ: {confidenceText('position')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>อีเมล</Label>
                  <Input value={parsed.email} onChange={(e) => setParsed((p) => ({ ...p, email: e.target.value }))} />
                  <p className="text-[11px] text-muted-foreground">ความมั่นใจ: {confidenceText('email')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>เบอร์โทร</Label>
                  <Input value={parsed.phone} onChange={(e) => setParsed((p) => ({ ...p, phone: e.target.value }))} />
                  <p className="text-[11px] text-muted-foreground">ความมั่นใจ: {confidenceText('phone')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>เว็บไซต์บริษัท</Label>
                  <Input value={parsed.website} onChange={(e) => setParsed((p) => ({ ...p, website: e.target.value }))} />
                  <p className="text-[11px] text-muted-foreground">ความมั่นใจ: {confidenceText('website')}</p>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>บันทึกเข้าบริษัทแบบ</Label>
                    <Select value={companyMode} onValueChange={(v: 'existing' | 'new') => setCompanyMode(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="existing">เลือกบริษัทเดิม</SelectItem>
                        <SelectItem value="new">สร้างบริษัทใหม่</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {companyMode === 'existing' ? (
                    <div className="space-y-1.5">
                      <Label>บริษัท</Label>
                      <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกบริษัท" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">เลือกบริษัท</SelectItem>
                          {allCompanyOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label>ชื่อบริษัทใหม่</Label>
                      <Input
                        value={parsed.company_name}
                        onChange={(e) => setParsed((p) => ({ ...p, company_name: e.target.value }))}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>ที่อยู่บริษัท</Label>
                  <Input value={parsed.address} onChange={(e) => setParsed((p) => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={scanning || saving}>ยกเลิก</Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={!hasResult || scanning || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {saving ? 'กำลังบันทึก...' : 'บันทึกและเพิ่มผู้ติดต่ออีกคน'}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={!hasResult || scanning || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {saving ? 'กำลังบันทึก...' : 'ยืนยันและบันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
