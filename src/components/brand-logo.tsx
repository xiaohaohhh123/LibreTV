import { cn } from '@/lib/utils';

/** 沿用原有小鱼轮廓，统一为柔和的蓝紫粉图标与清晰字标。 */
export function BrandLogo({ className }: { className?: string }) {
  return <div className={cn('brand-logo', className)} aria-hidden="true">
    <span className="brand-emblem">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand-mark.svg" width="36" height="26" alt="" />
    </span>
    <span className="brand-lockup"><span className="brand-word">小鱼<span className="brand-tv">TV</span></span><span className="brand-caption">YOUR LITTLE CINEMA</span></span>
  </div>;
}
