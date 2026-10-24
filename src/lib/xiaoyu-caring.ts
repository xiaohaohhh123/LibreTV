/**
 * 私人TV 的朋友式关心文案库。
 * 所有文案走这里统一管理，方便以后加。
 */

/** 首页 Hero 问候语：按时间段返回 */
export function getTimeGreeting(hour = new Date().getHours()): { title: string; subtitle: string } {
  if (hour >= 23 || hour < 6) {
    return {
      title: '夜深了',
      subtitle: '已经很晚了，故事可以明天接着看',
    };
  }
  if (hour < 9) {
    return {
      title: '早上好',
      subtitle: '早饭慢慢吃，给今天一个舒服的开场。',
    };
  }
  if (hour < 12) {
    return {
      title: '上午好',
      subtitle: '忙里留一点空，看看喜欢的故事。',
    };
  }
  if (hour < 14) {
    return {
      title: '中午好',
      subtitle: '午饭慢慢吃，喜欢的故事也慢慢看',
    };
  }
  if (hour < 18) {
    return {
      title: '下午好',
      subtitle: '累了就来看会儿剧，放松一下',
    };
  }
  return {
    title: '晚上好',
    subtitle: '今天辛苦了，找部好剧放松一下吧',
  };
}

/** 开场小纸条只存在本机，不记录用户是否吃饭或看过什么。 */
const BUFFERING_CARE = {
  breakfast: [
    { title: '早饭也要有自己的出场时间。', body: '哪怕今天有点赶，也给自己留一顿早餐。' },
    { title: '给今天一个热乎乎的开场。', body: '早餐慢慢吃，喜欢的节目也慢慢看。' },
    { title: '也给自己充点电。', body: '空着肚子可不行，一份早餐刚刚好。' },
  ],
  lunch: [
    { title: '饭要好好吃，故事可以慢慢看。', body: '先把这一餐吃舒服，再继续喜欢的节目。' },
    { title: '午饭也值得认真对待。', body: '忙了一上午，给自己留一点好好吃饭的时间。' },
    { title: '午饭时间，别只顾着追更新。', body: '喜欢的节目会等你，饭也趁热吃。' },
  ],
  dinner: [
    { title: '晚饭吃了吗？', body: '如果还没有，给自己安排一顿热乎的吧。' },
    { title: '今天的晚饭，也别将就。', body: '好好吃一餐，再把剩下的时间留给喜欢的节目。' },
    { title: '追剧可以等，好好吃饭也重要。', body: '给忙了一天的自己留一顿舒服的晚餐。' },
  ],
  night: [
    { title: '夜已经很深，故事还会在。', body: '有困意就先休息，明天可以从这里接着看。' },
    { title: '不用一次看完所有好故事。', body: '把下一集留给明天，也是一件值得期待的小事。' },
    { title: '今天辛苦啦，别和困意较劲。', body: '想睡的时候就去睡，喜欢的节目不会跑掉。' },
  ],
  anytime: [
    { title: '等开场的空隙，喝一口水吧。', body: '给自己一点小照顾，然后继续今天的小快乐。' },
    { title: '肩膀放松一点，坐舒服一点。', body: '忙了一会儿，现在把这点时间留给自己。' },
    { title: '今天没有很厉害，也没关系。', body: '能给自己留一点喜欢的时间，就很好。' },
    { title: '看屏幕之前，先看看远处。', body: '让眼睛歇一小会儿，好看的节目马上接着看。' },
    { title: '给自己一个舒服的位置。', body: '觉得冷的话添件衣服，舒服一点再看。' },
    { title: '开场前，先把今天的忙放一放。', body: '不用一直赶路，也可以留一点时间放松。' },
  ],
};

function carePeriod(hour: number) {
  return hour >= 6 && hour < 10 ? 'breakfast'
    : hour >= 11 && hour < 14 ? 'lunch'
    : hour >= 17 && hour < 21 ? 'dinner'
    : hour >= 23 || hour < 6 ? 'night' : 'anytime';
}

/** 使用设备当地时间，不推断用户是否吃过饭，也不记录回应。 */
export function getCareMoment(hour = new Date().getHours()) {
  const moments = {
    breakfast: { kind: 'meal', label: '早餐时间', title: '给今天一个热乎的开场', body: '早餐慢慢吃，好看的节目也可以慢慢挑。' },
    lunch: { kind: 'meal', label: '午餐时间', title: '饭趁热，故事慢慢看', body: '忙了一上午，给自己留一顿舒服的午饭吧。' },
    dinner: { kind: 'meal', label: '晚餐时间', title: '好好吃一顿，再奖励自己一集', body: '忙了一天，晚饭也别将就。喜欢的节目会等你。' },
    night: { kind: 'rest', label: '夜间小关心', title: '今天的快乐，也可以留一点给明天', body: '有困意就先休息，进度会替你记着。' },
    anytime: { kind: 'water', label: '给自己一点小照顾', title: '把水杯放近一点', body: '喝口水，坐舒服一点，再继续今天的小快乐。' },
  } as const;
  return moments[carePeriod(hour)];
}

export function getBufferingCare(hour = new Date().getHours(), previousTitle?: string) {
  const notes = BUFFERING_CARE[carePeriod(hour)].filter(note => note.title !== previousTitle);
  return notes[Math.floor(Math.random() * notes.length)];
}

/** 连点 Logo 5 次触发的暖心弹窗文案 */
export const LOVE_LETTER = {
  title: '观影小提醒',
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
export const LATE_NIGHT_REMINDER = '已经很晚了，看完这集就睡觉吧，晚安';

/** 长时间观影提醒文案 */
export const REST_REMINDER = '已经看了很久了，起来活动一下吧';

/** 忽略拖动进度、暂停与后台时间，只计算实际观看的小步增量。 */
export function viewingDelta(previous: number, current: number, paused: boolean, visible: boolean, rate = 1): number {
  const delta = current - previous;
  return !paused && visible && Number.isFinite(delta) && delta > 0 && rate > 0 && Number.isFinite(rate) && delta <= 5 * rate ? delta / rate : 0;
}
export const FRIEND_NOTES = [
  '今天没有很厉害也没关系。能给自己留一点喜欢的时间，就很好。',
  '这一集如果很好看，也可以记下来，下次接着看。',
  '不用为了追上更新熬夜。好故事不会跑，明天还能接着看。',
  '如果今天有点累，就让这里安静陪你一会儿。',
  '有时候一天过得太快，连吃饭都忘了。希望你再忙，也能给自己留一顿热乎饭。',
  '想提醒你一件很小的事：水杯可以放近一点，这一集的空隙记得喝一口。',
  '喜欢的综艺可以攒着慢慢看，饭也要好好吃。照顾自己和小开心一样重要。',
  '如果今天过得有点乱，就先做一件小事吧。吃顿饭、洗个热水澡，或者好好睡一觉。',
  '看得开心的时候，也记得把肩膀放松一点。坐舒服了，快乐才更自在。',
  '不用为了追完一季把自己熬困。把下一期留给明天，也算预订一份小快乐。',
];
