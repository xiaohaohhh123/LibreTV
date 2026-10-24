# 映间维护入口

2026-10-23。本轮从远端 main `d8d78aa5b1ec4cd95ffa239401365268805395bd` 的 GitHub 官方源码归档开始，独立本地分支 `codex/yingjian-redesign-20261023`。Git 直连不可用，因此本地基线是归档导入提交；它不是远端提交的历史克隆。向已有仓库交接时使用随包的补丁在最新 main 的新分支应用，先核对差异，不强推。

本轮没有修改正式站、域名、套餐、生产密码、环境变量或自动部署绑定。main 推送会触发已有 Vercel 生产部署。没有核实分支预览规则前也不要推送分支。本轮默认只授权本地与安全预览，旧交接中的上线授权不适用于本轮。

## 运行与验证

沿用 Next.js 15 / React / TypeScript / Tailwind，ArtPlayer / HLS 播放，Dexie / Zustand 存储。服务器必需，不能静态上传到 Pages。

```powershell
npm ci
$env:NEXT_TELEMETRY_DISABLED = '1'
# 在当前进程或未提交的 .env.local 中设置独立的 PASSWORD。
# DEFAULT_SOURCES / DEFAULT_SUBSCRIPTIONS 等沿用原部署的私密配置。
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

默认端口 8080。本机服务可绑定 127.0.0.1。对外部署继续使用 HTTPS；不把本地测试密码和来源覆盖到生产。上述遥测变量仅避免本机 Next.js 配置写入异常，不改变安全与鉴权。

## 维护哪些地方

- 全站视觉：`src/app/globals.css`、`header.tsx`、`brand-logo.tsx`，品牌资产在 `public/`；网站元信息、登录与各尺寸图标同步更新。
- 搜索与片库：`src/app/page.tsx`、`browse/page.tsx`。中文组合输入不提交；取消旧请求后不写回；流缺少完成事件不能冒充空结果。
- 聚合：`src/lib/search-results.ts`。同名不同年、未知年和预告/花絮分开，不能擅自放宽。
- 待看与今晚：`src/lib/watchlist.ts`、`watchlist-button/panel.tsx`、`tonight-picker.tsx`。仅复用当前推荐缓存与本机片单，不增加采集来源或模型服务。当前配置导出不含新待看片单，清网站数据前需自行保留需要的片名。
- 播放：`player-shell.tsx` 与 `player-chrome.tsx`。轻量 `onPositionChange` 只更新内存，普通进度每五秒持久化；拖动完成即时保存。不要把临时长按倍速写成偏好，或因外观调整重写播放器。
- 朋友式关心：保留原文案与存储 key，主动展开；等待结束立即撤下，不用纸条遮盖故障。

## 数据与回退

仍使用数据库 `libretv`，设置、主题和关心 key 不改名。Dexie v4 只新增 `watchlist`；不清库、不重建历史和进度。隔离浏览器升级、旧版读取和再升级的实际结果见交付 `evidence/storage-migration.json`；这不是正式平台回滚证明。回退界面时建议保留新增 schema，以保留片单。

部署前核对远端和实际平台旧部署，保存可恢复的代码与配置引用。获得本轮正式发布授权且验收通过后，才能按原链路发布；失败时恢复上一已知可用部署与原环境变量，绝不清用户浏览器数据。本地可用 `baseline/upstream-d8d78aa` 或随包原始源码归档恢复基线。

## 真实验收边界

最终结果只认随包 `acceptance.json`、浏览器逐项报告、截图和构建日志。源码内不保存密码、Cookie、媒体完整地址、浏览器个人数据或测试缓存。受控原创 HLS 的实播与第三方来源实播单独记录；视口模拟不代表实体手机，不能据此宣称全源可播、永不卡顿或绝对无广告。

原内容过滤、SSRF 防护、访问限制和 AGPL-3.0-or-later 说明保留。不要把成熟题材、同性题材直接判成色情，也不能把动漫一律放行。内容过滤检查继续用安全的元数据测试，不需打开露骨内容。
