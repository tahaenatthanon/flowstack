import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useOpportunities } from '@/hooks/useProjectData';
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
import { cn } from '@/lib/utils';

interface OpportunityComboboxProps {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowNone?: boolean;
}

export default function OpportunityCombobox({
  value,
  onChange,
  placeholder = 'เลือกโอกาสการขาย...',
  disabled = false,
  allowNone = true,
}: OpportunityComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: opportunities = [], isLoading } = useOpportunities();

  const sortedOpportunities = useMemo(() => {
    return [...opportunities].sort((a, b) =>
      (a.opportunity_name || '').localeCompare(b.opportunity_name || '', 'th')
    );
  }, [opportunities]);

  const selectedOpp = opportunities.find((o: any) => o.opportunity_id === value);

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
          {value && selectedOpp ? (
            <span className="truncate">
              {selectedOpp.opportunity_name}
              {selectedOpp.company_name ? ` - ${selectedOpp.company_name}` : ''}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหาโอกาสการขาย..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'กำลังโหลด...' : 'ไม่พบโอกาสการขาย'}
            </CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      !value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  ทั้งหมด / ไม่ระบุ
                </CommandItem>
              )}
              {sortedOpportunities.map((opp: any) => (
                <CommandItem
                  key={opp.opportunity_id}
                  value={`${opp.opportunity_name} ${opp.company_name || ''}`}
                  keywords={[opp.opportunity_name, opp.company_name || '']}
                  onSelect={() => {
                    onChange(opp.opportunity_id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === opp.opportunity_id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {opp.opportunity_name}
                  {opp.company_name ? ` - ${opp.company_name}` : ''}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
