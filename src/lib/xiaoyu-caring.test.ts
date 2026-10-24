import { describe, expect, it, vi, afterEach } from 'vitest';
import { getBufferingCare, getCareMoment, getTimeGreeting, viewingDelta } from './xiaoyu-caring';

describe('日常小关心', () => {
  it('在当地饭点显示明确用餐关心，其他时间喝水，深夜休息', () => {
    for (const hour of [6, 9, 11, 13, 17, 20]) {
      const moment = getCareMoment(hour);
      expect(moment.kind).toBe('meal');
      expect(moment.title + moment.body).toMatch(/早餐|午饭|晚饭|吃|餐/);
    }
    for (const hour of [10, 14, 16, 21, 22]) {
      expect(getCareMoment(hour).kind).toBe('water');
      expect(getCareMoment(hour).title + getCareMoment(hour).body).toMatch(/水/);
    }
    for (const hour of [23, 0, 5]) {
      expect(getCareMoment(hour).kind).toBe('rest');
      expect(getCareMoment(hour).body).toMatch(/休息/);
    }
  });
  it('饭点边界与开场纸条一致，问候也能按设备小时确定', () => {
    expect(getCareMoment(5).kind).toBe('rest');
    expect(getCareMoment(6).label).toBe('早餐时间');
    expect(getCareMoment(10).kind).toBe('water');
    expect(getCareMoment(11).label).toBe('午餐时间');
    expect(getCareMoment(14).kind).toBe('water');
    expect(getCareMoment(17).label).toBe('晚餐时间');
    expect(getCareMoment(21).kind).toBe('water');
    expect(getTimeGreeting(7).title).toBe('早上好');
    expect(getTimeGreeting(0).title).toBe('夜深了');
  });
});

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
