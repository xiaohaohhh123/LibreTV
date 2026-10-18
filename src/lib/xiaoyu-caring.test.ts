import { describe, expect, it, vi, afterEach } from 'vitest';
import { getBufferingCare, viewingDelta } from './xiaoyu-caring';

describe('开场小纸条', () => {
  afterEach(() => vi.restoreAllMocks());
  it('按她设备的当地饭点关心吃饭，深夜提醒休息', () => {
    const random = vi.spyOn(Math, 'random');
    for (const sample of [0, .45, .99]) {
      random.mockReturnValue(sample);
      for (const hour of [6, 9, 11, 13, 17, 20]) {
        const note = getBufferingCare(hour);
        expect(note.title + note.body).toMatch(/早餐|吃|饭|餐/);
      }
      for (const hour of [23, 0, 5]) expect(getBufferingCare(hour).body).toMatch(/明天|睡/);
    }
  });
  it('换集不连续重复同一张，非饭点也有放松和喝水的小关心', () => {
    for (const hour of [6, 10, 11, 14, 17, 21, 23]) {
      let previous: string | undefined;
      for (let n = 0; n < 30; n++) {
        const note = getBufferingCare(hour, previous);
        expect(note.title).not.toBe(previous);
        expect(note.body.length).toBeGreaterThan(0);
        previous = note.title;
      }
    }
  });
});

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
