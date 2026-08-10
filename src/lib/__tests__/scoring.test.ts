import { describe, it, expect } from 'vitest';

// Mirror PHP scoring logic (api/survey-scoring.php) for frontend validation
function answerToNumeric(value: string, type: string): number {
  if (type === 'yes_no') return value === 'yes' ? 1.0 : 0.0;
  if (type === 'scale_1_5') {
    const n = parseFloat(value);
    return n >= 1 && n <= 5 ? n : 0.0;
  }
  return 0.0;
}

describe('Survey Scoring', () => {
  it('yes_no: yes → 1', () => {
    expect(answerToNumeric('yes', 'yes_no')).toBe(1);
  });
  it('yes_no: no → 0', () => {
    expect(answerToNumeric('no', 'yes_no')).toBe(0);
  });
  it('scale_1_5: valid range', () => {
    expect(answerToNumeric('3', 'scale_1_5')).toBe(3);
    expect(answerToNumeric('5', 'scale_1_5')).toBe(5);
  });
  it('scale_1_5: out of range → 0', () => {
    expect(answerToNumeric('6', 'scale_1_5')).toBe(0);
    expect(answerToNumeric('0', 'scale_1_5')).toBe(0);
  });
  it('text type → 0 (no score)', () => {
    expect(answerToNumeric('anything', 'text')).toBe(0);
  });
  it('multiple_choice → 0', () => {
    expect(answerToNumeric('option_a', 'multiple_choice')).toBe(0);
  });
});
