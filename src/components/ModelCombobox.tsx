import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ModelOption {
  id: string;
  name?: string;
  model_id?: string;
  input_price_per_1k?: number;
  output_price_per_1k?: number;
}

interface ModelComboboxProps {
  models: ModelOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  defaultValue?: string;
  defaultLabel?: string;
}

function isModelFree(m: ModelOption): boolean {
  const input = m.input_price_per_1k ?? -1;
  const output = m.output_price_per_1k ?? -1;
  return input === 0 && output === 0;
}

export default function ModelCombobox({
  models,
  value,
  onChange,
  placeholder = 'ค้นหาโมเดล...',
  disabled = false,
  emptyMessage = 'ไม่พบโมเดล',
  defaultValue,
  defaultLabel,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    if (!value) return null;
    if (defaultValue && value === defaultValue) return { id: defaultValue, name: defaultLabel };
    return models.find((m) => m.id === value) || null;
  }, [value, models, defaultValue, defaultLabel]);

  // Normalize model display: extract a searchable label
  const getLabel = (m: ModelOption): string => m.name || m.model_id || m.id;
  const getSubtext = (m: ModelOption): string | null => {
    if (m.name && m.model_id && m.model_id !== m.name) return m.model_id;
    if (!m.name && m.model_id && m.model_id !== m.id) return m.id;
    return null;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between text-sm font-normal bg-background"
        >
          {selected ? (
            <span className="truncate flex items-center gap-1.5 min-w-0">
              <span className="truncate">{getLabel(selected)}</span>
              {isModelFree(selected) && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal shrink-0 gap-0.5">
                  <Sparkles className="h-2.5 w-2.5" />
                  ฟรี
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty className="text-xs p-2">{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {defaultValue && defaultLabel && (
                <CommandItem
                  key={defaultValue}
                  value={defaultLabel}
                  className="text-sm"
                  onSelect={() => {
                    onChange(defaultValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4 shrink-0', value === defaultValue ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="text-muted-foreground">{defaultLabel}</span>
                </CommandItem>
              )}
              {models.map((m) => {
                const free = isModelFree(m);
                const label = getLabel(m);
                const subtext = getSubtext(m);
                return (
                  <CommandItem
                    key={m.id}
                    value={label + (subtext ? ' ' + subtext : '')}
                    className="text-sm"
                    onSelect={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4 shrink-0', value === m.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="truncate">{label}</span>
                      {free && (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal shrink-0 gap-0.5">
                          <Sparkles className="h-2.5 w-2.5" />
                          ฟรี
                        </Badge>
                      )}
                    </div>
                    {subtext && (
                      <span className="ml-2 text-xs text-muted-foreground font-mono truncate shrink-0 max-w-[140px]">{subtext}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
