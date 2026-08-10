export const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const THAI_DAYS_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export function generateMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const grid: (Date | null)[][] = [];
  let currentRow: (Date | null)[] = [];

  for (let i = 0; i < startDow; i++) {
    currentRow.push(null);
  }

  for (let d = 1; d <= totalDays; d++) {
    currentRow.push(new Date(year, month, d));
    if (currentRow.length === 7) {
      grid.push(currentRow);
      currentRow = [];
    }
  }

  if (currentRow.length > 0) {
    while (currentRow.length < 7) {
      currentRow.push(null);
    }
    grid.push(currentRow);
  }

  return grid;
}

export function generateQuarterGrids(year: number, quarter: number): { month: number; year: number; grid: (Date | null)[][] }[] {
  const startMonth = (quarter - 1) * 3;
  return [0, 1, 2].map(offset => {
    const m = startMonth + offset;
    return { month: m, year, grid: generateMonthGrid(year, m) };
  });
}

export function generateYearHeatmap(year: number): { month: number; days: number; postCount: number }[] {
  return Array.from({ length: 12 }, (_, m) => ({
    month: m,
    days: new Date(year, m + 1, 0).getDate(),
    postCount: 0,
  }));
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatThaiDate(date: Date): string {
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export function getThaiDayName(date: Date): string {
  return THAI_DAYS_FULL[date.getDay()];
}

export function getQuarterLabel(quarter: number): string {
  return `ไตรมาส ${quarter}`;
}

export function getThaiMonthYear(year: number, month: number): string {
  return `${THAI_MONTHS_FULL[month]} ${year + 543}`;
}

export function getQuarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, startMonth + 3, 0),
  };
}

export function weekNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
  };
}
