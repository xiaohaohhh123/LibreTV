/**
 * 小鱼TV 专属：给小鱼的关心文案库。
 * 所有文案走这里统一管理，方便以后加。
 */

/** 首页 Hero 问候语：按时间段返回 */
export function getTimeGreeting(): { title: string; subtitle: string } {
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 6) {
    return {
      title: '夜深了，小鱼',
      subtitle: '已经很晚了，故事可以明天接着看',
    };
  }
  if (hour < 9) {
    return {
      title: '早上好，小鱼',
      subtitle: '早饭慢慢吃，给今天一个舒服的开场。',
    };
  }
  if (hour < 12) {
    return {
      title: '上午好，小鱼',
      subtitle: '忙里留一点空，看看喜欢的故事。',
    };
  }
  if (hour < 14) {
    return {
      title: '中午好，小鱼',
      subtitle: '午饭慢慢吃，喜欢的故事也慢慢看',
    };
  }
  if (hour < 18) {
    return {
      title: '下午好，小鱼',
      subtitle: '累了就来看会儿剧，放松一下',
    };
  }
  return {
    title: '晚上好，小鱼',
    subtitle: '今天辛苦了，找部好剧放松一下吧',
  };
}

/** 缓冲/加载时的随机关心语 */
const BUFFERING_CARE: string[] = [
  '正在缓冲，暂时没有新的画面',
  '正在等待视频数据；长时间无画面可尝试换源',
];

export function getBufferingCare(): string {
  return BUFFERING_CARE[Math.floor(Math.random() * BUFFERING_CARE.length)];
}

/** 连点 Logo 5 次触发的暖心弹窗文案 */
export const LOVE_LETTER = {
  title: '小鱼专属小窝',
  body: [
    '这个网站是为你做的。',
    '',
    '追剧的时候记得喝水，',
    '看累了就起来走走，',
    '喜欢的故事，明天也还在。',
    '',
    '希望这里能让你开心一点。',
    '',
    '—— 小皓',
  ],
};

/** 搜索"小鱼"时的特殊回应 */
export const XIAOYU_SEARCH_EASTER_EGG = '这里藏着一句话：祝你今天有一点小开心。';

/** 深夜观影提醒（23点后打开播放页） */
export const LATE_NIGHT_REMINDER = '已经很晚了，看完这集就睡觉吧，晚安小鱼';

/** 长时间观影提醒文案 */
export const REST_REMINDER = '已经看了很久了，起来活动一下吧，小鱼';

/** 忽略拖动进度、暂停与后台时间，只计算实际观看的小步增量。 */
export function viewingDelta(previous: number, current: number, paused: boolean, visible: boolean, rate = 1): number {
  const delta = current - previous;
  return !paused && visible && Number.isFinite(delta) && delta > 0 && rate > 0 && Number.isFinite(rate) && delta <= 5 * rate ? delta / rate : 0;
}
export const FRIEND_NOTES = [
  '今天没有很厉害也没关系。能给自己留一点喜欢的时间，就很好。',
  '这一集如果很好看，下次见面可以讲给我听。',
  '不用为了追上更新熬夜。好故事不会跑，明天还能接着看。',
  '如果今天有点累，就让这里安静陪你一会儿。',
];
