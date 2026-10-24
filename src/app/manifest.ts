import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '私人TV',
    short_name: '私人TV',
    description: '搜索影片，接着上次看。',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B101A',
    theme_color: '#0B101A',
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
