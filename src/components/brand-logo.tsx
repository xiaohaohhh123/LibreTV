import { cn } from '@/lib/utils';

/** 保留原版游动小鱼、渐变字与气泡，动效仅用轻量 CSS。 */
export function BrandLogo({ className }: { className?: string }) {
  return <div className={cn('brand-logo', className)} aria-hidden="true">
    <span className="brand-bubble brand-bubble-1" />
    <span className="brand-bubble brand-bubble-2" />
    <span className="brand-bubble brand-bubble-3" />
    <span className="brand-fish-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-fish" src="/brand-mark.svg" width="52" height="36" alt="" />
    </span>
    <span className="brand-word">小鱼TV</span>
  </div>;
}
