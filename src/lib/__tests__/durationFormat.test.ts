import { describe, it, expect } from 'vitest';
import { formatDurationMs } from '@/lib/durationFormat';

// openspec/changes/facebook-page-insights-dashboard — Graph API คืนเวลาเป็นมิลลิวินาที
describe('formatDurationMs', () => {
  it('ต่ำกว่า 1 นาทีแสดงเป็นวินาที (post_video_avg_time_watched จริง 16265 ms)', () => {
    expect(formatDurationMs(16265)).toBe('16.3 วิ');
  });

  it('ต่ำกว่า 1 ชั่วโมงแสดงเป็นนาที (page_video_view_time จริง 292773 ms)', () => {
    expect(formatDurationMs(292773)).toBe('4.9 นาที');
  });

  it('ตั้งแต่ 1 ชั่วโมงขึ้นไปแสดงเป็นชั่วโมง', () => {
    expect(formatDurationMs(5_400_000)).toBe('1.5 ชม.');
  });

  it('ตัด .0 ทิ้ง และ 0 เป็นค่าจริงไม่ใช่ "—"', () => {
    expect(formatDurationMs(12000)).toBe('12 วิ');
    expect(formatDurationMs(0)).toBe('0 วิ');
  });

  it('null / undefined = ไม่มีข้อมูล แสดง "—"', () => {
    expect(formatDurationMs(null)).toBe('—');
    expect(formatDurationMs(undefined)).toBe('—');
  });
});
