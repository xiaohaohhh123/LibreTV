import { normalizeTitle } from './cms-parser';

interface Programme {
  title: string;
  year?: string;
  episodes: number;
  episodeNames?: string[];
}

/** 自动换源只接受相同正片和完整集数；缺信息时交给手动选择。 */
export function matchesRecoveryProgramme(current: Programme, candidate: Programme, index: number): boolean {
  return recoveryEpisodeIndex(current, candidate, index) !== null;
}

export function recoveryEpisodeIndex(current: Programme, candidate: Programme, index: number): number | null {
  if (!current.title || !candidate.title || !Number.isInteger(index) || index < 0) return null;
  if (normalizeTitle(current.title) !== normalizeTitle(candidate.title)) return null;
  if (!current.year || current.year !== candidate.year) return null;
  if (!Number.isInteger(current.episodes) || current.episodes <= index) return null;
  const episodeNumber = (name: string) => /^第?\s*0*(\d+)\s*[集话期]?$/.exec(name.trim())?.[1];
  const currentName = current.episodeNames?.[index];
  if (currentName && candidate.episodeNames?.length) {
    const number = episodeNumber(currentName);
    if (number) {
      const matches = candidate.episodeNames.map((name, i) => episodeNumber(name) === number ? i : -1).filter((i) => i >= 0 && i < candidate.episodes);
      return matches.length === 1 ? matches[0] : null;
    }
    if (current.episodes === 1 && candidate.episodes === 1) return 0;
    const labels = candidate.episodeNames.map((name, i) => normalizeTitle(name) === normalizeTitle(currentName) ? i : -1).filter((i) => i >= 0 && i < candidate.episodes);
    return labels.length === 1 ? labels[0] : null;
  }
  return candidate.episodes === current.episodes ? index : null;
}

/** 播放有余量后才启动额外缓存；下一集只在临近片尾时预热。 */
export function hasPrefetchHeadroom(bufferAhead: number, paused: boolean): boolean {
  return paused || Number.isFinite(bufferAhead) && bufferAhead >= 30;
}

export function shouldWarmNextEpisode(position: number, duration: number, autoplay: boolean): boolean {
  const remaining = duration - position;
  return autoplay && Number.isFinite(remaining) && position >= 0 && remaining > 0 && remaining <= 120;
}
