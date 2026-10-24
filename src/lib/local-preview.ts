import { Server } from 'node:http';

interface LocalPreviewRuntime {
  server: Server;
  buildId: string;
}

/** Only the dedicated launcher can provide a live, loopback-bound listener. */
export function getLocalPreview(): LocalPreviewRuntime | null {
  const runtime = (process as unknown as Record<symbol, LocalPreviewRuntime | undefined>)[
    Symbol.for('private-tv.local-preview')
  ];
  if (process.env.PRIVATE_TV_LOCAL_PREVIEW !== '1' || !(runtime?.server instanceof Server) || !runtime.server.listening) return null;
  const address = runtime.server.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1' || address.port !== 8080) return null;
  return runtime;
}
