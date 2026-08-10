import { format, parseISO, isValid } from 'date-fns';
import { th } from 'date-fns/locale';

export function safeParseISO(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  return isValid(d) ? d : null;
}

export function safeFmt(dateStrOrDate: string | Date | null | undefined, fmt = 'd MMM yyyy'): string {
  if (!dateStrOrDate) return '-';
  const d = dateStrOrDate instanceof Date ? dateStrOrDate : safeParseISO(dateStrOrDate);
  return d ? format(d, fmt, { locale: th }) : '-';
}
