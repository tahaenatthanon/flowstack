import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useCompanies } from '@/hooks/useProjectData';
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
import type { DbCompany } from '@/types/project';

interface CompanyComboboxProps {
  value: string;
  onChange: (id: string, company?: DbCompany) => void;
  placeholder?: string;
  disabled?: boolean;
  allowNone?: boolean;
}

export default function CompanyCombobox({
  value,
  onChange,
  placeholder = 'เลือกบริษัท...',
  disabled = false,
  allowNone = true,
}: CompanyComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: companies = [], isLoading } = useCompanies();

  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'th')
    );
  }, [companies]);

  const selectedCompany = companies.find((c) => c.id === value);

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
          {value && selectedCompany ? (
            <span className="truncate">{selectedCompany.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={true} filter={(value, search, keywords = []) => {
            const searchLower = search.toLowerCase();
            const haystack = `${value} ${keywords.join(' ')}`.toLowerCase();
            return haystack.includes(searchLower) ? 1 : 0;
          }}>
          <CommandInput placeholder="ค้นหาบริษัท..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'กำลังโหลด...' : 'ไม่พบบริษัท'}
            </CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange('none');
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === 'none' || !value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  ไม่ระบุ
                </CommandItem>
              )}
              {sortedCompanies.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  keywords={[c.name]}
                  onSelect={() => {
                    onChange(c.id, c);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === c.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
