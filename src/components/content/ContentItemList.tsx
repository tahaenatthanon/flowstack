import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ContentPlan, PlanItem } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';
import { formatThaiDate } from './calendarUtils';
import { Pencil, Trash2, GripVertical, Search, CalendarX2, ArrowUpDown, Image as ImageIcon } from 'lucide-react';

interface Props {
  plans: ContentPlan[];
  onEditItem: (item: PlanItem) => void;
  onDeleteItem: (itemId: string) => Promise<void>;
  typeFilter?: string;
  platformFilter?: string;
}

type SortKey = 'date' | 'platform' | 'topic' | 'plan';

export function ContentItemList({ plans, onEditItem, onDeleteItem, typeFilter = 'all', platformFilter = 'all' }: Props) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const allItems = useMemo(() => {
    const items: Array<PlanItem & { planTitle: string }> = [];
    for (const plan of plans) {
      for (const item of plan.items || []) {
        items.push({ ...item, planTitle: plan.title });
      }
    }
    return items;
  }, [plans]);

  const filtered = useMemo(() => {
    let result = allItems;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item =>
        item.topic?.toLowerCase().includes(q) ||
        item.caption?.toLowerCase().includes(q) ||
        item.platform?.toLowerCase().includes(q) ||
        item.planTitle?.toLowerCase().includes(q)
      );
    }
    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(item => item.content_type === typeFilter);
    }
    // Platform filter
    if (platformFilter !== 'all') {
      result = result.filter(item => item.platform === platformFilter);
    }
    result.sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortBy === 'date') {
        return ((a.scheduled_date || '9999').localeCompare(b.scheduled_date || '9999')) * dir;
      }
      if (sortBy === 'platform') {
        return ((a.platform || '').localeCompare(b.platform || '')) * dir;
      }
      if (sortBy === 'topic') {
        return ((a.topic || '').localeCompare(b.topic || '')) * dir;
      }
      return ((a.planTitle || '').localeCompare(b.planTitle || '')) * dir;
    });
    return result;
  }, [allItems, search, sortBy, sortAsc, typeFilter, platformFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(v => !v);
    else { setSortBy(key); setSortAsc(true); }
  };

  const handleDelete = async (itemId: string) => {
    setDeleting(itemId);
    try { await onDeleteItem(itemId); } finally { setDeleting(null); }
  };

  const sortIcon = (key: SortKey) => (
    <ArrowUpDown className={cn('h-3 w-3 ml-1 opacity-40', sortBy === key && 'opacity-100 text-primary')} />
  );

  const renderSortBtn = (key: SortKey, label: string) => (
    <button
      type="button"
      className="flex items-center text-[10px] font-semibold text-muted-foreground hover:text-foreground"
      onClick={() => toggleSort(key)}
    >
      {label}{sortIcon(key)}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาบทความ..."
            className="h-8 pl-7 text-xs"
          />
        </div>
        <span className="text-[11px] text-muted-foreground">
          {filtered.length} รายการ
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarX2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{search ? 'ไม่พบบทความที่ค้นหา' : 'ยังไม่มีบทความ — สร้างแผนด้วย AI หรือคลิกวันที่ในปฏิทิน'}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 border-b text-[10px] font-semibold text-muted-foreground">
            <div className="col-span-3">{renderSortBtn('topic', 'หัวข้อ')}</div>
            <div className="col-span-1">{renderSortBtn('platform', 'แพลตฟอร์ม')}</div>
            <div className="col-span-2">{renderSortBtn('date', 'วันที่')}</div>
            <div className="col-span-2">{renderSortBtn('plan', 'แผน')}</div>
            <div className="col-span-3">แคปชั่น</div>
            <div className="col-span-1 text-right">จัดการ</div>
          </div>
          <div className="sm:max-h-[60vh] overflow-y-auto">
            {filtered.map(item => {
              const pf = PLATFORM_MAP[item.platform || ''];
              const hasDate = !!item.scheduled_date;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/40 text-xs hover:bg-muted/20 transition-colors group',
                    !hasDate && 'bg-amber-50 dark:bg-amber-950/10'
                  )}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({ itemId: item.id, planId: item.plan_id }));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <div className="col-span-3 flex items-center gap-1.5 min-w-0">
                    <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 cursor-grab" />
                    {item.generated_image_url ? (
                      <div className="w-8 h-8 rounded overflow-hidden border shrink-0 bg-muted">
                        <img src={item.generated_image_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      </div>
                    ) : item.image_brief ? (
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : null}
                    <span className="truncate font-medium">{item.topic}</span>
                  </div>
                  <div className="col-span-1 flex items-center">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', pf?.color || 'bg-gray-100 text-gray-600')}>
                      {pf?.label || item.platform || '-'}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    {hasDate ? (
                      <span className="font-mono text-[10px]">{item.scheduled_date}</span>
                    ) : (
                      <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                        <CalendarX2 className="h-3 w-3" />ยังไม่กำหนด
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="truncate text-muted-foreground text-[10px]">{item.planTitle}</span>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <span className="truncate text-muted-foreground text-[10px]">
                      {item.caption?.slice(0, 60)}{(item.caption?.length ?? 0) > 60 ? '...' : ''}
                    </span>
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => onEditItem(item)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:text-destructive"
                      disabled={deleting === item.id}
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
