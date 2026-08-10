import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Upload, X, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useContentGlobalSettings, useSaveGlobalSettings } from '@/hooks/useContent';
import { apiFetch, apiUpload } from '@/lib/api';

interface ProductRef {
  name: string;
  url: string;
  metadata?: Record<string, any> | null;
  analyzing?: boolean;
}

export default function BrandProductRefsForm() {
  const { toast } = useToast();
  const { data: globalSettings } = useContentGlobalSettings();
  const [productRefs, setProductRefs] = useState<ProductRef[]>([]);
  const [newRefName, setNewRefName] = useState('');
  const [newRefUrl, setNewRefUrl] = useState('');
  const [uploadingRef, setUploadingRef] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const productRefsDirty = useRef(false);
  const saveMut = useSaveGlobalSettings();

  useEffect(() => {
    if (globalSettings && !productRefsDirty.current) {
      try {
        const refs = JSON.parse(globalSettings.product_refs || '[]');
        if (Array.isArray(refs) && refs.length > 0) {
          setProductRefs(refs);
          return;
        }
      } catch {}
      try {
        const urls = JSON.parse(globalSettings.product_ref_image_url || '[]');
        if (Array.isArray(urls) && urls.length > 0) {
          setProductRefs(urls.map((u: string, i: number) => ({ name: `สินค้า #${i + 1}`, url: u })));
          return;
        }
      } catch {}
      if (globalSettings.product_ref_image_url) {
        setProductRefs([{ name: 'สินค้า', url: globalSettings.product_ref_image_url }]);
      }
    }
  }, [globalSettings]);

  const analyzeProductImage = async (refIndex: number, imageUrl: string) => {
    try {
      const res: any = await apiFetch('/brand-content.php?action=analyze-product-image', {
        method: 'POST',
        body: JSON.stringify({ image_url: imageUrl }),
      });
      if (res?.metadata) {
        setProductRefs(prev => prev.map((r, i) => i === refIndex ? { ...r, metadata: res.metadata, analyzing: false } : r));
        toast({ title: 'วิเคราะห์รูปสินค้าสำเร็จ', description: 'AI ระบุสี รูปทรง และองค์ประกอบแล้ว' });
      }
    } catch {
      setProductRefs(prev => prev.map((r, i) => i === refIndex ? { ...r, analyzing: false } : r));
    }
  };

  const addRef = () => {
    const name = newRefName.trim();
    const url  = newRefUrl.trim();
    if (!url) return;
    productRefsDirty.current = true;
    setProductRefs(prev => [...prev, { name: name || 'สินค้า', url }]);
    setNewRefName(''); setNewRefUrl('');
  };

  const removeRef = (index: number) => {
    productRefsDirty.current = true;
    setProductRefs(prev => prev.filter((_, i) => i !== index));
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingRef(true);
    let addedCount = 0;
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'product_ref');
        const res: any = await apiUpload('/support-upload.php', fd);
        const url = res?.data?.url ?? res?.url ?? '';
        if (url) {
          productRefsDirty.current = true;
          const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
          const idx = productRefs.length + addedCount;
          addedCount++;
          setProductRefs(prev => [...prev, { name: name || 'สินค้า', url, metadata: null, analyzing: true }]);
          analyzeProductImage(idx, url);
        }
      }
      toast({ title: 'อัพโหลดรูปสินค้าอ้างอิงแล้ว — กำลังวิเคราะห์ด้วย AI...' });
    } catch (err: any) {
      toast({ title: 'อัพโหลดไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingRef(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = () => {
    const payload: Record<string, any> = {
      product_ref_image_url: JSON.stringify(productRefs.map(r => r.url)),
      product_refs: JSON.stringify(productRefs),
    };
    saveMut.mutate(payload, {
      onSuccess: () => {
        productRefsDirty.current = false;
        toast({ title: 'บันทึกแล้ว' });
      },
      onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-500" />รูปสินค้าอ้างอิง (Product References)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">ระบุชื่อสินค้าและรูป — AI จะเลือกใช้เฉพาะรูปที่ตรงกับเนื้อหาคอนเทนต์นั้น ๆ โดยอัตโนมัติ</p>

        {/* Add name + URL */}
        <div className="flex items-center gap-2">
          <Input
            value={newRefName}
            onChange={e => setNewRefName(e.target.value)}
            placeholder="ชื่อสินค้า (เช่น: AI Portal, Smart Factory)"
            className="w-40 text-xs"
          />
          <Input
            value={newRefUrl}
            onChange={e => setNewRefUrl(e.target.value)}
            placeholder="https://... หรืออัพโหลด"
            className="flex-1 text-xs font-mono"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRef(); } }}
          />
          <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={addRef} disabled={!newRefUrl.trim()}>
            <Plus className="h-3.5 w-3.5" />เพิ่ม
          </Button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleRefUpload} />
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" disabled={uploadingRef} onClick={() => fileRef.current?.click()}>
            {uploadingRef ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Product list */}
        {productRefs.length > 0 && (
          <div className="space-y-2">
            {productRefs.map((ref, i) => (
              <div key={i} className="p-2.5 border rounded-lg bg-muted/30 group">
                <div className="flex items-center gap-2.5">
                  <div className="w-12 h-12 rounded-md overflow-hidden border bg-muted shrink-0 relative">
                    <img src={ref.url} alt={ref.name} className="w-full h-full object-cover" />
                    {ref.analyzing && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{ref.name}</span>
                      {ref.analyzing && <span className="text-[10px] text-muted-foreground animate-pulse">กำลังวิเคราะห์...</span>}
                    </div>
                    {ref.metadata && (
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {ref.metadata.product_type && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium">
                            {ref.metadata.product_type}
                          </span>
                        )}
                        {ref.metadata.primary_color && (
                          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-muted">
                            <span className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: ref.metadata.primary_color }} />
                            {ref.metadata.primary_color}
                          </span>
                        )}
                        {ref.metadata.mood && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
                            {ref.metadata.mood}
                          </span>
                        )}
                        {ref.metadata.key_elements && (
                          <span className="text-[9px] text-muted-foreground truncate max-w-[200px]" title={ref.metadata.key_elements.join(', ')}>
                            {ref.metadata.key_elements.slice(0, 3).join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                    onClick={() => removeRef(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button className="gap-2" disabled={saveMut.isPending} onClick={handleSave}>
          {saveMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังบันทึก...</> : <><Save className="h-4 w-4" />บันทึก</>}
        </Button>
      </CardContent>
    </Card>
  );
}
