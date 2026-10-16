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
      subtitle: '看完这集就早点睡吧，熬夜对皮肤不好哦',
    };
  }
  if (hour < 9) {
    return {
      title: '早上好，小鱼',
      subtitle: '记得好好吃早饭，今天也要开开心心的',
    };
  }
  if (hour < 12) {
    return {
      title: '上午好，小鱼',
      subtitle: '工作学习再忙，也记得喝水休息一下',
    };
  }
  if (hour < 14) {
    return {
      title: '中午好，小鱼',
      subtitle: '午饭要吃饱饱的，下午才有力气追剧',
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
  '缓冲中… 顺便喝口水吧',
  '小鱼别急，好剧值得等待',
  '加载中… 记得好好吃饭',
  '马上就好，伸个懒腰吧',
  '网络在努力了，你也别太累',
  '缓冲中… 今天有没有开心一点',
];

export function getBufferingCare(): string {
  return BUFFERING_CARE[Math.floor(Math.random() * BUFFERING_CARE.length)];
}

/** 连点 Logo 5 次触发的表白弹窗文案 */
export const LOVE_LETTER = {
  title: '给小鱼的一封信',
  body: [
    '这个网站是为你做的。',
    '',
    '从第一行代码到每一处细节，',
    '都藏着想让你开心一点的心思。',
    '',
    '追剧的时候记得喝水，',
    '熬夜的时候记得想我。',
    '',
    '—— 爱你的小皓',
  ],
};

/** 搜索"小鱼"时的特殊回应 */
export const XIAOYU_SEARCH_EASTER_EGG = '小鱼是这个世界上最可爱的人，不接受反驳';

/** 深夜观影提醒（23点后打开播放页） */
export const LATE_NIGHT_REMINDER = '已经很晚了，看完这集就睡觉吧，晚安小鱼';

/** 长时间观影提醒文案 */
export const REST_REMINDER = '已经看了很久了，起来活动一下吧，小鱼';
