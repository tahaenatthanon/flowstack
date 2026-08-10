import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useProjects, useBaseCalendar } from '@/hooks/useProjectData';
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
import type { DbProject } from '@/types/project';

interface ProjectComboboxProps {
  value: string;
  onChange: (id: string, project?: DbProject) => void;
  placeholder?: string;
  disabled?: boolean;
  allowNone?: boolean;
  /** ถ้า true จะรวม Base Calendar ในรายการ (default: false — แสดงเฉพาะ project) */
  includeBaseCalendar?: boolean;
}

export default function ProjectCombobox({
  value,
  onChange,
  placeholder = 'เลือกโปรเจกต์...',
  disabled = false,
  allowNone = true,
  includeBaseCalendar = false,
}: ProjectComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: allProjects = [], isLoading } = useProjects();
  const { data: baseCalendar } = useBaseCalendar();

  const projects = useMemo(() => {
    if (includeBaseCalendar && baseCalendar?.id) {
      const rest = allProjects.filter((p) => p.kind !== 'base_calendar');
      rest.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
      return [baseCalendar, ...rest];
    }
    const list = allProjects.filter((p) => p.kind !== 'base_calendar');
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
  }, [allProjects, baseCalendar, includeBaseCalendar]);

  const selectedProject = projects.find((p) => p.id === value) || (baseCalendar?.id === value ? baseCalendar : null);
  const isBaseCalendar = selectedProject?.kind === 'base_calendar';

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
          {value && selectedProject ? (
            <span className="truncate">{isBaseCalendar ? '📅 ปฏิทินทีม' : selectedProject.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[350px] overflow-hidden p-0" align="start">
        <Command className="h-auto overflow-visible">
          <CommandInput placeholder="ค้นหาโปรเจกต์..." />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>
              {isLoading ? 'กำลังโหลด...' : 'ไม่พบโปรเจกต์'}
            </CommandEmpty>
            <CommandGroup className="overflow-visible">
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
              {projects.map((p) => {
                const isBase = p.kind === 'base_calendar';
                return (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  keywords={[p.name]}
                  onSelect={() => {
                    onChange(p.id, p);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === p.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {isBase ? '📅 ปฏิทินทีม' : p.name}
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
