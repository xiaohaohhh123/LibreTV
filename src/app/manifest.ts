import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '小鱼TV - 在线视频搜索与观看',
    short_name: '小鱼TV',
    description: '在线视频搜索与观看平台',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d141c',
    theme_color: '#0d141c',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
