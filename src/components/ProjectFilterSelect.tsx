import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface ProjectFilterSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function ProjectFilterSelect({ options, value, onChange, placeholder = 'ทุกโปรเจกต์', className }: ProjectFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-7 text-xs justify-between font-normal gap-1 px-2', className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="พิมพ์ค้นหา..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="text-xs p-2 text-center">ไม่พบโปรเจกต์</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  className="text-xs cursor-pointer"
                  onSelect={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Check className={cn('mr-1.5 h-3 w-3', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
