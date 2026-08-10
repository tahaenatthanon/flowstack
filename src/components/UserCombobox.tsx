import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useUsers } from '@/hooks/useProjectData';
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

interface User {
  id: string;
  display_name: string;
  email: string;
  position?: string;
}

interface UserComboboxProps {
  value: string;
  onChange: (id: string, user?: User) => void;
  placeholder?: string;
  disabled?: boolean;
  allowNone?: boolean;
}

export default function UserCombobox({
  value,
  onChange,
  placeholder = 'เลือกผู้รับผิดชอบ...',
  disabled = false,
  allowNone = true,
}: UserComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: users = [], isLoading } = useUsers();

  const sortedUsers = useMemo(() =>
    [...users].sort((a, b) =>
      (a.display_name || '').localeCompare(b.display_name || '', 'th')
    ),
    [users]);

  const selectedUser = users.find((u) => u.id === value);

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
          {value && selectedUser ? (
            <span className="truncate">
              {selectedUser.display_name || selectedUser.email}
              {selectedUser.position ? ` (${selectedUser.position})` : ''}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหาผู้ใช้..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? 'กำลังโหลด...' : 'ไม่พบผู้ใช้'}
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
              {sortedUsers.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.display_name || u.email}
                  keywords={[u.display_name, u.email]}
                  onSelect={() => {
                    onChange(u.id, u);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === u.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span>
                    {u.display_name || u.email}
                    {u.position ? <span className="text-muted-foreground ml-1">({u.position})</span> : ''}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
