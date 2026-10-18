import { describe, expect, it } from 'vitest';
import { viewingDelta } from './xiaoyu-caring';

describe('实际观看时长', () => {
  it('只累计前台播放的正常时间增量', () => {
    expect(viewingDelta(10, 10.25, false, true)).toBe(.25);
    expect(viewingDelta(10, 11, true, true)).toBe(0);
    expect(viewingDelta(10, 11, false, false)).toBe(0);
    expect(viewingDelta(10, 12, false, true, 2)).toBe(1);
    expect(viewingDelta(10, 12, false, true, 0)).toBe(0);
  });
  it('不把快进、回退、切集或非法时间算成观影', () => {
    for (const value of [10, 9, 30, 0, NaN, Infinity]) {
      expect(viewingDelta(10, value, false, true)).toBe(0);
    }
  });
});
