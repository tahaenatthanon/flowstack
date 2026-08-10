import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  value: number;
  options?: number[];
  onChange: (value: number) => void;
}

const DEFAULT_OPTIONS = [10, 25, 50, 100, 200, 500, 99999];
const ALL_VALUE = 99999;

function formatLabel(n: number) {
  return n === ALL_VALUE ? 'ทั้งหมด' : String(n);
}

export default function RowsPerPageSelector({ value, options = DEFAULT_OPTIONS, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="hidden sm:inline">แสดง</span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-8 w-[80px] text-xs">
          <SelectValue>{formatLabel(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((n) => (
            <SelectItem key={n} value={String(n)}>{formatLabel(n)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="hidden sm:inline">รายการ</span>
    </div>
  );
}
