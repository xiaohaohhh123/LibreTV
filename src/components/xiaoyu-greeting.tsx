import { BrandLogo } from './brand-logo';

/** 首页保留原版品牌氛围，持续关怀仍在播放页。 */
export function XiaoyuGreeting() {
  return (
    <div>
      <p className="room-label">小鱼的专属放映室</p>
      <h1 className="room-title" aria-label="小鱼TV"><BrandLogo className="brand-logo-hero" /></h1>
      <p className="room-dream-title">把喜欢的故事，慢慢看。</p>
      <p className="room-subtitle">一点小开心，一场好故事。</p>
    </div>
  );
}
