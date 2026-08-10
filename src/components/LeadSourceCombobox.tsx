import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLeadSourceCatalog } from '@/hooks/useWorkTypes';

interface LeadSourceComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function LeadSourceCombobox({ value, onChange, placeholder = 'เลือกหรือพิมพ์แหล่งที่มา', disabled }: LeadSourceComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const { activeLeadSources, isLoading } = useLeadSourceCatalog();

  const displayLabel = value
    ? (activeLeadSources.find((s) => s.key === value)?.label ?? value)
    : '';

  const filteredSources = inputValue
    ? activeLeadSources.filter((s) =>
        s.label.toLowerCase().includes(inputValue.toLowerCase()) ||
        s.key.toLowerCase().includes(inputValue.toLowerCase())
      )
    : activeLeadSources;

  const showCreateOption =
    inputValue.trim().length > 0 &&
    !activeLeadSources.some(
      (s) => s.label.toLowerCase() === inputValue.trim().toLowerCase() || s.key === inputValue.trim().toLowerCase()
    );

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue === value ? '' : selectedValue);
    setOpen(false);
    setInputValue('');
  };

  const handleCreate = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onChange(trimmed);
      setOpen(false);
      setInputValue('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled || isLoading}
        >
          <span className={cn('truncate', !displayLabel && 'text-muted-foreground')}>
            {displayLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="ค้นหาหรือพิมพ์แหล่งที่มาใหม่..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue.trim() ? null : 'ไม่พบแหล่งที่มา'}
            </CommandEmpty>
            {filteredSources.length > 0 && (
              <CommandGroup>
                {filteredSources.map((source) => (
                  <CommandItem
                    key={source.key}
                    value={source.key}
                    onSelect={() => handleSelect(source.key)}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === source.key ? 'opacity-100' : 'opacity-0')} />
                    {source.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreateOption && (
              <CommandGroup heading="เพิ่มใหม่">
                <CommandItem value={`__create__${inputValue}`} onSelect={handleCreate}>
                  <span className="text-primary font-medium">+ ใช้ "{inputValue.trim()}"</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
