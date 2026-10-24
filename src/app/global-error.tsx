'use client';

/**
 * 根布局级错误兜底：layout 本身崩溃时启用，必须自带 <html>/<body>。
 * 此时主题脚本等均已失效，用内联样式保证基本可读。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: '#0B101A',
          color: '#E6F2FF',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, color: '#00B8E6' }}>私人TV</h1>
        <p style={{ margin: 0, fontSize: 14 }}>放映暂时中断，请重试。</p>
        <button
          onClick={reset}
          style={{
            minHeight: 44,
            padding: '8px 24px',
            borderRadius: 10,
            border: '1px solid #00B8E6',
            background: '#00B8E6',
            color: '#0B101A',
            cursor: 'pointer',
          }}
        >
          重新尝试
        </button>
        {/* digest 用于线上日志定位，不含敏感信息，展示无妨 */}
        {error.digest && (
          <p style={{ margin: 0, fontSize: 11, color: '#8599B2' }}>错误编号：{error.digest}</p>
        )}
      </body>
    </html>
  );
}
