import { describe, expect, it } from 'vitest';
import { matchesRecoveryProgramme, recoveryEpisodeIndex, hasPrefetchHeadroom, shouldWarmNextEpisode } from './source-recovery-match';

describe('自动换源匹配', () => {
  const original = {title: '去有风的地方', year: '2023', episodes: 40};
  it('同片、同年份、同集数可以自动替换', () => {
    expect(matchesRecoveryProgramme(original, {...original}, 12)).toBe(true);
  });
  it('拒绝解说、续作、翻拍、集数缺失和未知年份', () => {
    for (const change of [{title: '去有风的地方解说'}, {title: '去有风的地方2'}, {year: '2024'}, {year: undefined}, {episodes: 39}, {episodes: 0}]) {
      expect(matchesRecoveryProgramme(original, {...original, ...change}, 12)).toBe(false);
    }
  });
  it('无有效集数或越界不自动跳转', () => {
    for (const index of [-1, NaN, 40, 1.5]) expect(matchesRecoveryProgramme(original, original, index)).toBe(false);
    expect(matchesRecoveryProgramme({...original,year:undefined}, original, 0)).toBe(false);
  });
  it('按真实集名对齐，跳过不同来源额外插入的预告', () => {
    const current = {...original, episodes:2, episodeNames:['第01集', '第02集']};
    const candidate = {...original, episodes:3, episodeNames:['预告', '第1集', '第2集']};
    expect(recoveryEpisodeIndex(current, candidate, 1)).toBe(2);
    expect(recoveryEpisodeIndex(current, {...candidate,episodeNames:['预告', '第2集', '第2集']},1)).toBeNull();
    expect(recoveryEpisodeIndex(current, {...candidate,episodeNames:['预告', '第1集', '花絮']},1)).toBeNull();
  });
  it('综艺按日期和上下期匹配，不因位置相同而串期或串季', () => {
    const show = {title:'海外综艺 第一季', year:'2024', episodes:2, episodeNames:['20240801上', '20240801下']};
    const other = {...show, episodes:3, episodeNames:['先导片', '2024-08-01上', '2024-08-01下']};
    expect(recoveryEpisodeIndex(show, other, 1)).toBe(2);
    expect(recoveryEpisodeIndex(show, {...other, episodeNames:['先导片', '20240801上', '20240808下']}, 1)).toBeNull();
    expect(recoveryEpisodeIndex(show, {...other, title:'海外综艺 第二季'}, 1)).toBeNull();
  });
});

describe('缓存给播放让带宽', () => {
  it('起播和缓冲不足时不预取；暂停可以缓存', () => {
    expect(hasPrefetchHeadroom(0, false)).toBe(false);
    expect(hasPrefetchHeadroom(29, false)).toBe(false);
    expect(hasPrefetchHeadroom(30, false)).toBe(true);
    expect(hasPrefetchHeadroom(0, true)).toBe(true);
    expect(hasPrefetchHeadroom(NaN, false)).toBe(false);
  });
  it('只在最后两分钟且连播开启时预热下一集', () => {
    expect(shouldWarmNextEpisode(10, 2400, true)).toBe(false);
    expect(shouldWarmNextEpisode(2300, 2400, true)).toBe(true);
    expect(shouldWarmNextEpisode(2300, 2400, false)).toBe(false);
    expect(shouldWarmNextEpisode(2400, 2400, true)).toBe(false);
    expect(shouldWarmNextEpisode(0, NaN, true)).toBe(false);
  });
});
