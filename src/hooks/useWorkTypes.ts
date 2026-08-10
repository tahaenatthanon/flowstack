import { useMemo } from 'react';
import { useCompanySettings, useUpdateCompanySettings } from '@/hooks/useSales';

export interface WorkTypeOption {
  key: string;
  label: string;
  color: string;
  active: number;
  system?: number;
}

const DEFAULT_TASK_TYPES: WorkTypeOption[] = [
  { key: 'task', label: 'งานปกติ', color: '#10b981', active: 1, system: 1 },
  { key: 'meeting', label: 'ประชุม', color: '#3b82f6', active: 1, system: 1 },
  { key: 'leave', label: 'ลาหยุด', color: '#f59e0b', active: 1, system: 1 },
  { key: 'onsite', label: 'งานลูกค้า (Onsite)', color: '#06b6d4', active: 1, system: 0 },
  { key: 'ot', label: 'งานล่วงเวลา (OT)', color: '#f97316', active: 1, system: 0 },
  { key: 'weekend_work', label: 'งานวันหยุด (Weekend)', color: '#14b8a6', active: 1, system: 0 },
  { key: 'research', label: 'วิจัย', color: '#8b5cf6', active: 1, system: 0 },
  { key: 'interrupt', label: 'งานแทรก', color: '#f43f5e', active: 1, system: 0 },
];

const DEFAULT_EVENT_TYPES: WorkTypeOption[] = [
  { key: 'holiday', label: 'วันหยุดบริษัท', color: '#ef4444', active: 1, system: 1 },
  { key: 'other', label: 'อื่นๆ', color: '#8b5cf6', active: 1, system: 1 },
];

const EXCLUDED_CALENDAR_KEYS = new Set(['meeting', 'leave']);

export interface LeadSourceOption {
  key: string;
  label: string;
  active: number;
}

const DEFAULT_LEAD_SOURCES: LeadSourceOption[] = [
  { key: 'seo', label: 'SEO / Organic Search', active: 1 },
  { key: 'bni', label: 'BNI / Network', active: 1 },
  { key: 'cold_call', label: 'Cold Call', active: 1 },
  { key: 'referral', label: 'Referral', active: 1 },
  { key: 'existing', label: 'Existing Customer', active: 1 },
  { key: 'direct', label: 'Direct Contact', active: 1 },
];

function sanitizeLeadSources(rawValue: unknown): LeadSourceOption[] {
  const rows = Array.isArray(rawValue) ? rawValue : [];
  const out = new Map<string, LeadSourceOption>();

  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const key = String(row.key ?? '').trim().toLowerCase();
    if (!/^[a-z0-9_]{2,50}$/.test(key)) continue;
    const label = String(row.label ?? key).trim() || key;
    out.set(key, { key, label, active: row.active ? 1 : 0 });
  }

  for (const row of DEFAULT_LEAD_SOURCES) {
    if (!out.has(row.key)) out.set(row.key, row);
  }

  return [...out.values()];
}

function sanitizeCatalog(rawValue: unknown, defaults: WorkTypeOption[]): WorkTypeOption[] {
  const defaultsByKey = new Map(defaults.map((row) => [row.key, row]));
  const rows = Array.isArray(rawValue) ? rawValue : [];
  const out = new Map<string, WorkTypeOption>();

  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const key = String(row.key ?? '').trim().toLowerCase();
    if (!/^[a-z0-9_]{2,50}$/.test(key)) continue;

    const fallback = defaultsByKey.get(key);
    const label = String(row.label ?? fallback?.label ?? key).trim() || (fallback?.label ?? key);
    const colorRaw = String(row.color ?? fallback?.color ?? '#6b7280').trim();
    const color = /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : (fallback?.color ?? '#6b7280');

    out.set(key, {
      key,
      label,
      color,
      active: row.active ? 1 : 0,
      system: row.system || fallback?.system ? 1 : 0,
    });
  }

  for (const row of defaults) {
    if (!out.has(row.key)) {
      out.set(row.key, row);
    } else if (row.system) {
      const curr = out.get(row.key)!;
      out.set(row.key, { ...curr, system: 1 });
    }
  }

  return [...out.values()];
}

export function useWorkTypeCatalog() {
  const settingsQuery = useCompanySettings();

  const taskTypes = useMemo(() => {
    return sanitizeCatalog(settingsQuery.data?.task_type_catalog, DEFAULT_TASK_TYPES);
  }, [settingsQuery.data]);

  const eventTypes = useMemo(() => {
    return sanitizeCatalog(settingsQuery.data?.calendar_event_type_catalog, DEFAULT_EVENT_TYPES)
      .filter((t) => !EXCLUDED_CALENDAR_KEYS.has(t.key));
  }, [settingsQuery.data]);

  const activeTaskTypes = useMemo(() => taskTypes.filter((t) => t.active), [taskTypes]);
  const activeTaskExecutionTypes = useMemo(
    () => taskTypes.filter((t) => t.active && t.key !== 'holiday'),
    [taskTypes]
  );
  const activeEventTypes = useMemo(() => eventTypes.filter((t) => t.active), [eventTypes]);

  const taskTypeLabels = useMemo(
    () => Object.fromEntries(taskTypes.map((t) => [t.key, t.label])),
    [taskTypes]
  );
  const eventTypeLabels = useMemo(
    () => Object.fromEntries(eventTypes.map((t) => [t.key, t.label])),
    [eventTypes]
  );
  const typeColors = useMemo(
    () => Object.fromEntries([...taskTypes, ...eventTypes].map((t) => [t.key, t.color])),
    [taskTypes, eventTypes]
  );

  return {
    ...settingsQuery,
    taskTypes,
    eventTypes,
    activeTaskTypes,
    activeTaskExecutionTypes,
    activeEventTypes,
    taskTypeLabels,
    eventTypeLabels,
    typeColors,
  };
}

export function useUpdateWorkTypeCatalog() {
  return useUpdateCompanySettings();
}

export function useLeadSourceCatalog() {
  const settingsQuery = useCompanySettings();
  const leadSources = useMemo(
    () => sanitizeLeadSources(settingsQuery.data?.lead_source_catalog),
    [settingsQuery.data]
  );
  const activeLeadSources = useMemo(() => leadSources.filter((s) => s.active), [leadSources]);
  return { ...settingsQuery, leadSources, activeLeadSources };
}
