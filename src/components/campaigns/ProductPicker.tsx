import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';

interface ProductPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  /** จำกัดจำนวนที่เลือกได้สูงสุด — max=1 คือเลือกได้ทีละตัว (คลิกตัวใหม่แทนที่ตัวเดิม) */
  max?: number;
}

/** Chip selector สำหรับเลือกสินค้า — style เดียวกับ "Knowledge Base" chip ใน QuickCreateDialog */
export default function ProductPicker({ value, onChange, max }: ProductPickerProps) {
  const { data: products = [], isLoading } = useProducts();
  const activeProducts = products.filter(p => p.status === 'active');

  const toggle = (id: string) => {
    const sel = value.includes(id);
    if (sel) {
      onChange(value.filter(x => x !== id));
      return;
    }
    if (max === 1) {
      onChange([id]);
      return;
    }
    if (max && value.length >= max) return;
    onChange([...value, id]);
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[38px] max-h-40 overflow-y-auto bg-background items-center">
      {isLoading && <span className="text-xs text-muted-foreground">กำลังโหลดสินค้า...</span>}
      {!isLoading && activeProducts.length === 0 && (
        <span className="text-xs text-muted-foreground">ยังไม่มีสินค้า — เพิ่มได้ที่หน้าตั้งค่าแบรนด์</span>
      )}
      {activeProducts.map(p => {
        const sel = value.includes(p.id);
        return (
          <button key={p.id} type="button"
            onClick={() => toggle(p.id)}
            className={cn('text-[11px] px-2 py-1 rounded border flex items-center gap-1 transition-colors',
              sel ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}>
            <Package className="h-3 w-3" />{p.name}
          </button>
        );
      })}
    </div>
  );
}
