import { useRef, useState } from 'react';
import { Package, Plus, Upload, Loader2, Save, Pencil, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { apiUpload } from '@/lib/api';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, type Product, type ProductInput } from '@/hooks/useProducts';

const emptyForm: ProductInput = { name: '', description: '', usp: '', price: '', image_url: '' };

function ProductForm({
  value, onChange, onSubmit, onCancel, submitting, uploading, onUpload,
}: {
  value: ProductInput;
  onChange: (v: ProductInput) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitting: boolean;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2.5 p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2.5">
        <div className="w-14 h-14 rounded-md overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
          {value.image_url ? (
            <img src={value.image_url} alt={value.name || 'สินค้า'} className="w-full h-full object-cover" />
          ) : <Package className="h-5 w-5 text-muted-foreground" />}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}อัพโหลดรูป
        </Button>
      </div>
      <Input value={value.name ?? ''} onChange={e => onChange({ ...value, name: e.target.value })} placeholder="ชื่อสินค้า *" className="text-sm" />
      <Textarea value={value.description ?? ''} onChange={e => onChange({ ...value, description: e.target.value })} placeholder="คำอธิบายสินค้า" className="text-sm min-h-[60px]" />
      <Textarea value={value.usp ?? ''} onChange={e => onChange({ ...value, usp: e.target.value })} placeholder="จุดขาย / USP" className="text-sm min-h-[50px]" />
      <Input value={value.price ?? ''} onChange={e => onChange({ ...value, price: e.target.value })} placeholder="ราคา (ไม่บังคับ)" className="text-sm w-40" inputMode="decimal" />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" className="gap-1.5" disabled={submitting || !value.name?.trim()} onClick={onSubmit}>
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}บันทึก
        </Button>
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>ยกเลิก</Button>}
      </div>
    </div>
  );
}

export default function ProductCatalogForm() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { data: products = [], isLoading } = useProducts();
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct();
  const deleteMut = useDeleteProduct();

  const [adding, setAdding] = useState(false);
  const [newProduct, setNewProduct] = useState<ProductInput>(emptyForm);
  const [uploadingNew, setUploadingNew] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProductInput>(emptyForm);
  const [uploadingEdit, setUploadingEdit] = useState(false);

  const uploadImage = async (file: File, setUrl: (url: string) => void, setUploading: (v: boolean) => void) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'product_ref');
      const res: any = await apiUpload('/support-upload.php', fd);
      const url = res?.data?.url ?? res?.url ?? '';
      if (url) setUrl(url);
    } catch (err: any) {
      toast({ title: 'อัพโหลดไม่สำเร็จ', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = () => {
    createMut.mutate(newProduct, {
      onSuccess: () => {
        toast({ title: 'เพิ่มสินค้าแล้ว' });
        setNewProduct(emptyForm);
        setAdding(false);
      },
      onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
    });
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditForm({ name: p.name, description: p.description ?? '', usp: p.usp ?? '', price: p.price ?? '', image_url: p.image_url ?? '', status: p.status });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateMut.mutate({ id: editingId, ...editForm }, {
      onSuccess: () => {
        toast({ title: 'บันทึกแล้ว' });
        setEditingId(null);
      },
      onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
    });
  };

  const handleDelete = async (p: Product) => {
    const ok = await confirm({ title: 'ลบสินค้า', description: `ต้องการลบ "${p.name}" ใช่หรือไม่?`, variant: 'destructive' });
    if (!ok) return;
    deleteMut.mutate(p.id, {
      onSuccess: () => toast({ title: 'ลบแล้ว' }),
      onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-500" />สินค้า/บริการ (Product Catalog)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          ข้อมูลสินค้าที่ AI ใช้อ้างอิงตอนเขียนเนื้อหาแคมเปญ (ชื่อ, คำอธิบาย, จุดขาย, ราคา) — แยกจาก "รูปสินค้าอ้างอิง" ด้านล่างซึ่งใช้เฉพาะตอน generate รูปภาพ
        </p>

        {isLoading && <p className="text-xs text-muted-foreground">กำลังโหลด...</p>}

        {!isLoading && products.length > 0 && (
          <div className="space-y-2">
            {products.map(p => (
              <div key={p.id} className="border rounded-lg bg-muted/30">
                {editingId === p.id ? (
                  <div className="p-1">
                    <ProductForm
                      value={editForm}
                      onChange={setEditForm}
                      onSubmit={handleUpdate}
                      onCancel={() => setEditingId(null)}
                      submitting={updateMut.isPending}
                      uploading={uploadingEdit}
                      onUpload={e => {
                        const file = e.target.files?.[0];
                        if (file) uploadImage(file, url => setEditForm(f => ({ ...f, image_url: url })), setUploadingEdit);
                        if (e.target) e.target.value = '';
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-2.5 flex items-center gap-2.5 group">
                    <div className="w-12 h-12 rounded-md overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate">{p.name}</span>
                        {p.status === 'discontinued' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">เลิกขาย</span>}
                        {p.price && <span className="text-[10px] text-muted-foreground">฿{p.price}</span>}
                      </div>
                      {p.description && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{p.description}</p>}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => startEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 hover:text-destructive" onClick={() => handleDelete(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <ProductForm
            value={newProduct}
            onChange={setNewProduct}
            onSubmit={handleCreate}
            onCancel={() => { setAdding(false); setNewProduct(emptyForm); }}
            submitting={createMut.isPending}
            uploading={uploadingNew}
            onUpload={e => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file, url => setNewProduct(f => ({ ...f, image_url: url })), setUploadingNew);
              if (e.target) e.target.value = '';
            }}
          />
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />เพิ่มสินค้า
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
