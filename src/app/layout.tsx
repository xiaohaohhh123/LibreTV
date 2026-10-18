import type { Metadata, Viewport } from 'next';
import { Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { LoveLetterEasterEgg, KonamiFishEasterEgg } from '@/components/xiaoyu-easter-eggs';
import { WelcomeAnimation } from '@/components/welcome-animation';

/** 正文/界面字体：Noto Sans SC，圆润现代 */
const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-sans-sc',
});

/** 标题/问候语字体：Noto Serif SC，优雅有质感 */
const notoSerifSC = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['600', '700', '900'],
  display: 'swap',
  variable: '--font-serif-sc',
});

export const metadata: Metadata = {
  title: {
    default: '小鱼TV - 在线视频搜索与观看',
    template: '%s - 小鱼TV',
  },
  description:
    '小鱼TV 是一个在线视频搜索平台，无广告、安全，提供来自多个视频源的内容搜索与观看服务，无需注册即可使用。',
  manifest: '/manifest.webmanifest',
  // 各尺寸由同一小鱼矢量图导出，网页和添加到主屏幕时保持一致。
  icons: {
    icon: [
      { url: '/brand-mark.svg', sizes: 'any', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d141c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${notoSansSC.variable} ${notoSerifSC.variable}`}>
      <head>
        {/* 首屏前同步主题，避免亮暗闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('libretv-theme')||'dark';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})()",
          }}
        />
      </head>
      <body>
        <Providers>
          <WelcomeAnimation />
          {children}
          <LoveLetterEasterEgg />
          <KonamiFishEasterEgg />
        </Providers>
      </body>
    </html>
  );
}
