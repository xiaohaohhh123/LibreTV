import { cn } from '@/lib/utils';

/** 全站共用的私人TV字标，图标同时用于网站与主屏幕。 */
export function BrandLogo({ className }: { className?: string }) {
  return <div className={cn('brand-logo', className)} aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <span className="brand-symbol-frame"><img className="brand-symbol" src="/brand-mark.svg" width="36" height="36" alt="" /></span>
    <span className="brand-word">私人<span className="brand-tv">TV</span></span>
  </div>;
}
