import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** ข้อความรอง แสดงจางๆ ด้านขวาของแต่ละตัวเลือก เช่น "22 คน" — ไม่บังคับ */
  meta?: string;
}

interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** แสดงตัวเลือก "เลือกทั้งหมด" ที่หัวรายการ (ครอบเฉพาะรายการที่กำลังแสดงหลังกรองค้นหา) — ค่าเริ่มต้นเปิด */
  showSelectAll?: boolean;
  className?: string;
}

/**
 * Combobox ที่เลือกได้หลายรายการ พร้อมค้นหา — ต่างจาก Combobox อื่นในระบบ
 * (CompanyCombobox, ProjectCombobox, UserCombobox, ProjectFilterSelect ฯลฯ)
 * ที่เป็น single-select และปิด popover ทันทีหลังเลือก 1 รายการ ตัวนี้ตั้งใจ
 * "ไม่ปิด popover" หลังเลือกแต่ละรายการ เพื่อให้เลือกต่อเนื่องได้หลายอัน — ปิดเฉพาะ
 * ตอนคลิกนอก popover หรือกด Escape (ค่าเริ่มต้นของ Popover เอง)
 *
 * รายการที่เลือกไว้แสดงเป็น chip อยู่นอก popover เห็นตลอดเวลา ลบออกได้จากปุ่ม ×
 * บน chip โดยตรง ไม่ต้องเปิด popover — เป็น pattern ใหม่ที่ยังไม่มีที่อื่นในระบบ
 *
 * เป็น component ทั่วไป ไม่ผูกกับ domain ใดโดยเฉพาะ — ใช้ `meta` สำหรับข้อความรอง
 * แบบ domain-specific (เช่น "22 คน" ของกลุ่มผู้รับ) แทนการผูก field ตรงๆ เข้ากับ props
 */
export function MultiSelectCombobox({
  options,
  value,
  onChange,
  placeholder = 'เลือกรายการ',
  searchPlaceholder = 'ค้นหา...',
  emptyText = 'ไม่พบรายการ',
  showSelectAll = true,
  className,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // กรองเองใน JS (ไม่ใช้ cmdk shouldFilter อัตโนมัติ) เพื่อให้ "เลือกทั้งหมด"
  // อ้างอิงชุดรายการที่กำลังแสดงอยู่จริงชุดเดียวกับที่ผู้ใช้เห็น ไม่มีโอกาสไม่ตรงกัน
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedSet = new Set(value);
  const selectedOptions = options.filter(o => selectedSet.has(o.value));

  const toggle = (optValue: string) => {
    onChange(selectedSet.has(optValue) ? value.filter(v => v !== optValue) : [...value, optValue]);
  };

  const remove = (optValue: string) => {
    onChange(value.filter(v => v !== optValue));
  };

  const allFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(o => selectedSet.has(o.value));
  const toggleSelectAll = () => {
    const filteredValues = filteredOptions.map(o => o.value);
    onChange(
      allFilteredSelected
        ? value.filter(v => !filteredValues.includes(v))
        : [...new Set([...value, ...filteredValues])]
    );
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-muted-foreground">{placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} className="h-9 text-sm" />
            <CommandList>
              <CommandEmpty className="text-sm p-3 text-center">{emptyText}</CommandEmpty>
              <CommandGroup>
                {showSelectAll && filteredOptions.length > 0 && (
                  <CommandItem
                    value="__select_all__"
                    onSelect={toggleSelectAll}
                    className="cursor-pointer text-sm font-medium"
                  >
                    <Check className={cn('mr-2 h-4 w-4', allFilteredSelected ? 'opacity-100' : 'opacity-0')} />
                    เลือกทั้งหมด
                  </CommandItem>
                )}
                {filteredOptions.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => toggle(opt.value)}
                    className="cursor-pointer text-sm justify-between"
                  >
                    <span className="flex items-center min-w-0">
                      <Check className={cn('mr-2 h-4 w-4 shrink-0', selectedSet.has(opt.value) ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {opt.meta && <span className="shrink-0 text-xs text-muted-foreground ml-2">{opt.meta}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((opt) => (
            <Badge key={opt.value} variant="secondary" className="gap-1 pr-1 font-normal">
              <span className="truncate max-w-[180px]">{opt.label}</span>
              <button
                type="button"
                onClick={() => remove(opt.value)}
                className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                aria-label={`เอา ${opt.label} ออก`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
