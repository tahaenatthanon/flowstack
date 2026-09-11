// ─── Platform color/label catalog — single source of truth ────────────────
// เดิมมี 2 ระบบขนานกัน: PLATFORM_MAP (types.ts, Tailwind class มี dark mode)
// กับ PLATFORM_COLORS/getPlatformColors (ที่นี่, hex ไม่มี dark mode) ให้สี
// ไม่ตรงกันเป๊ะและดริฟท์ออกจากกันได้ — ตอนนี้รวมเป็น PLATFORM_CATALOG เดียว
// ที่นี่ ให้ทั้ง getPlatformColors()/getPlatformColorClass() และ PLATFORM_MAP
// (ใน types.ts) derive ค่าจากตารางเดียวกัน ไม่มีการนิยามสีซ้ำที่ไหนอีก
// (ยกเว้น ContentVideoView.tsx ที่ตั้งใจแยกโทนสีทึบสำหรับ badge ทับวิดีโอ)
// ดู openspec/changes/platform-color-catalog/design.md

export interface PlatformColorSet {
  bg: string; text: string; border: string;
  darkBg: string; darkText: string; darkBorder: string;
}

interface PlatformCatalogEntry {
  label: string;
  /** Tailwind class string รวม dark: variant — ใช้เป็น PLATFORM_MAP.color เดิม */
  colorClass: string;
  /** hex ตรงๆ สำหรับจุดที่ต้องคำนวณสีแบบ dynamic (เช่น invert ตอน filter active) */
  hex: PlatformColorSet;
}

export const PLATFORM_CATALOG: Record<string, PlatformCatalogEntry> = {
  facebook: {
    label: 'Facebook',
    colorClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    hex: { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe', darkBg: '#1e1b4b', darkText: '#a5b4fc', darkBorder: '#3730a3' },
  },
  instagram: {
    label: 'Instagram',
    colorClass: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
    hex: { bg: '#fce7f3', text: '#be185d', border: '#fbcfe8', darkBg: '#500724', darkText: '#f9a8d4', darkBorder: '#9d174d' },
  },
  tiktok: {
    label: 'TikTok',
    colorClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    hex: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1', darkBg: '#1e293b', darkText: '#cbd5e1', darkBorder: '#334155' },
  },
  lineoa: {
    label: 'Line OA',
    colorClass: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    hex: { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', darkBg: '#052e16', darkText: '#86efac', darkBorder: '#166534' },
  },
  linkedin: {
    label: 'LinkedIn',
    colorClass: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    hex: { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', darkBg: '#082f49', darkText: '#7dd3fc', darkBorder: '#075985' },
  },
  twitter: {
    label: 'Twitter / X',
    colorClass: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    hex: { bg: '#f4f4f5', text: '#3f3f46', border: '#e4e4e7', darkBg: '#27272a', darkText: '#d4d4d8', darkBorder: '#3f3f46' },
  },
  wordpress: {
    label: 'WordPress',
    colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    hex: { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', darkBg: '#172554', darkText: '#93c5fd', darkBorder: '#1e40af' },
  },
  wix: {
    label: 'Wix',
    colorClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    hex: { bg: '#f3e8ff', text: '#7e22ce', border: '#f5d0fe', darkBg: '#3b0764', darkText: '#d8b4fe', darkBorder: '#6b21a8' },
  },
  custom: {
    label: 'Custom API',
    colorClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    hex: { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb', darkBg: '#1f2937', darkText: '#d1d5db', darkBorder: '#374151' },
  },
  lotusdomino: {
    label: 'Lotus Notes / Domino',
    colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    hex: { bg: '#fef3c7', text: '#b45309', border: '#fde68a', darkBg: '#451a03', darkText: '#fcd34d', darkBorder: '#92400e' },
  },
  youtube: {
    label: 'YouTube',
    colorClass: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    hex: { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca', darkBg: '#450a0a', darkText: '#fca5a5', darkBorder: '#991b1b' },
  },
};

const DEFAULT_ENTRY: PlatformCatalogEntry = {
  label: '',
  colorClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  hex: { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb', darkBg: '#1f2937', darkText: '#d1d5db', darkBorder: '#374151' },
};

/** hex color object — คงรูปแบบเดิม (bg/text/border/filterBg/filterText) เพื่อไม่ต้องแก้ผู้เรียกเดิม
 *  พร้อมเพิ่ม darkBg/darkText/darkBorder ให้ผู้เรียกใหม่เลือกใช้เมื่อต้องรองรับ dark mode */
export function getPlatformColors(platform: string) {
  const entry = PLATFORM_CATALOG[platform] ?? DEFAULT_ENTRY;
  return {
    bg: entry.hex.bg, text: entry.hex.text, border: entry.hex.border,
    filterBg: entry.hex.bg, filterText: entry.hex.text,
    darkBg: entry.hex.darkBg, darkText: entry.hex.darkText, darkBorder: entry.hex.darkBorder,
  };
}

/** Tailwind class string (รวม dark: variant) — สิ่งที่ PLATFORM_MAP.color เดิมเก็บไว้ */
export function getPlatformColorClass(platform: string): string {
  return (PLATFORM_CATALOG[platform] ?? DEFAULT_ENTRY).colorClass;
}

export function getPlatformLabel(platform: string): string {
  return PLATFORM_CATALOG[platform]?.label || platform;
}

/** @deprecated ใช้ getPlatformLabel() แทน — เก็บไว้เผื่อมีที่ import ชื่อนี้อยู่ */
export const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(PLATFORM_CATALOG).map(([key, entry]) => [key, entry.label])
);
