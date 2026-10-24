'use client';

import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-5 py-10 sm:py-14">
        <section className="border-b border-line pb-8">
          <p className="mb-2 text-sm text-accent">关于</p>
          <h1 className="mb-4 text-2xl font-semibold text-content">私人TV</h1>
          <p className="max-w-xl text-sm leading-7 text-muted">
            私人TV 基于开源项目 LibreTV，提供多来源搜索、选集、换源与续播。
            不需要注册新账号，也没有付费推荐服务。
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <h2 className="mb-4 text-lg font-semibold text-content">用得顺手的小动作</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-content">空格</dt><dd className="text-muted">播放或暂停</dd>
            <dt className="text-content">← / →</dt><dd className="text-muted">快退或快进 5 秒</dd>
            <dt className="text-content">↑ / ↓</dt><dd className="text-muted">调节音量</dd>
            <dt className="text-content">F</dt><dd className="text-muted">切换全屏</dd>
            <dt className="text-content">Alt + ← / →</dt><dd className="text-muted">上一集或下一集</dd>
            <dt className="text-content">长按画面</dt><dd className="text-muted">临时加速，松开恢复</dd>
          </dl>
          <p className="mt-5 text-xs leading-6 text-faint">输入文字时快捷键不接管操作。手机也可以直接使用播放器上的选集、倍速和全屏按钮。</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-content">你的记录，留在当前浏览器</h2>
          <p className="text-sm leading-7 text-muted">
            搜索记录、观看进度、待看片单与个人设置保存在当前浏览器，没有跨设备同步。
            清除网站数据、使用无痕窗口或更换浏览器后，这些记录可能无法保留。需要备份时，可在设置中导出配置与历史。
          </p>
          <p className="text-sm leading-7 text-muted">
            搜索等请求会经过站点服务器；播放与海报会按实际配置直连第三方或通过代理。
            第三方服务可能收到网络地址与必要请求信息，请按自己的隐私需求选择可信来源。
          </p>
        </section>

        <section className="space-y-3 border-t border-line pt-7">
          <h2 className="text-lg font-semibold text-content">来源与使用边界</h2>
          <p className="text-sm leading-7 text-muted">
            私人TV 不制作或托管影视内容。视频来自你配置的第三方来源，本站无法保证其始终可用、无广告或拥有合法授权。
            请只观看你有权使用的内容。遇到失效、错误版本或视频内嵌广告，可以手动换源；没有合适来源时请停止播放。
          </p>
          <p className="text-sm leading-7 text-muted">
            内容过滤依据来源标记、分类与元数据，不进行逐帧审核。它会保留正常的成熟题材作品，也无法保证第三方漏标内容全部被识别。
          </p>
          <p className="text-sm leading-7 text-muted">
            本项目沿用 <a href="https://github.com/LibreSpark/LibreTV" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">LibreTV</a> 的 AGPL-3.0-or-later 许可。
            <a href="https://github.com/xiaohaohhh123/LibreTV" target="_blank" rel="noopener noreferrer" className="ml-1 text-accent underline underline-offset-4">查看项目源码</a>。
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
