# V1121-A · 预览上限 50MB + 渲染端解码提速（V1.12.1 维护增量，单节点）

状态：DONE

## 目标

把应用内预览（PDF/docx，课次阅读器 + 外部资料页两条链）的尺寸上限从 12MB 放宽到 50MB，并消除渲染端解码的性能缺陷——真实资料库中超限的 25 个高价值文件（扫描版一模试卷合订 20-33MB、整册电子课本 42-54MB）全部纳入可预览范围，每次打开 1-2 秒级。

## 背景（2026-09-10 实测证据）

产品负责人实测反馈「12MB 以上就不能看的话，是不是有太多的看不了」，授权按分析结论实施。基准数据（tmp/v112-bench，独立 Electron 复刻产品链路）：

- **真实资料库分布**：6622 文件中可预览类型仅 25 个超 12MB（0.4%），但超限项集中在扫描卷合订（20-33MB）与整册课本（42-54MB）——备课翻卷核心场景；docx 仅 15/5151 超限（最大 19.5MB）；
- **传输链**（12/31.6/41.8MB 实测）：Main 读+base64 8-32ms、IPC 过桥 39-195ms——均不构成瓶颈；
- **渲染端解码是真凶**：42MB 档 `atob` 仅 ~115ms，但 `Uint8Array.from(s, c => c.charCodeAt(0))` 回调循环 **3809ms**；同一环境手动 for 循环 **149ms（快 25 倍）**。174MB 档渲染进程直接挂死（基线归因：巨型回调循环 GC 风暴）；
- **渲染链**（production 隔离 app + 真实文件）：9.8-10.5MB PDF 首页画完 ~1.05s；10.5MB/150 页整册课本同样 ~1s 画完首页，但全部页一次性渲染使 RSS +900MB（懒渲染属另一问题，本增量不动，记后续候选）；
- **CSP 前置验证**：`fetch('data:...')` 在 production CSP 下被 `default-src 'self'`（connect-src 回退）拦截——**不动 CSP**，解码提速用纯循环替换实现。

## 决策（D73，并入本任务文件）

1. **上限 12MB → 50MB**：覆盖真实库全部超限可预览文件（最大 54.4MB 七下课本仅略超——见「非目标」），排除 174MB 挂死档与 .tqbank/.db/.zip 等非预览类型。双侧同步改：managed `MAX_PREVIEW_BYTES`（V1.1 语义）与 external `EXTERNAL_PREVIEW_LIMIT_BYTES`（V1.12 语义），超限提示文案随上限表述。
2. **守卫上限同步**：`isExternalFilePreview` 的 dataUrl 长度上限 20_000_000 → 70_000_000（50MB base64 ≈ 67.1M 字符）；`ManagedFileContent` 守卫无长度上限（既有语义）零改动。
3. **解码换手动 for 循环**：`dataUrlToUint8Array` 的 `Uint8Array.from(atob(s), c => c.charCodeAt(0))` 改为预分配 `new Uint8Array(s.length)` + for 赋值——42MB 实测 3809ms → 149ms，消除回调/GC 风暴；`atob` 解码主体保留（实测仅 ~115ms）。PdfPreview 与 DocxPreview 共用此函数，一处改动两条链受益。
4. **CSP 零改动、零 migration、零新依赖、零新 IPC 通道**；不实现懒渲染（PdfPreview 全页渲染语义不动——后续候选）；54.4MB 一份七下课本超 50MB 上限 4.4MB，维持超限提示（如需要可后续微调，不做特例）。

## 任务内容

1. `src/main/files/managed-file-service.ts`：`MAX_PREVIEW_BYTES` 12MB → 50MB；
2. `src/main/external/external-library-service.ts`：`EXTERNAL_PREVIEW_LIMIT_BYTES` 12MB → 50MB（常量名保持）；
3. `src/shared/external-library-contracts.ts`：`isExternalFilePreview` dataUrl 上限 20_000_000 → 70_000_000；
4. `src/renderer/pdf-binary.ts`：`Uint8Array.from` 回调 → 预分配 for 循环（函数签名/语义不变，注释记录实测依据）；
5. 测试：既有超限测试（12MB+1 断言）演进为 50MB+1；新增解码循环钉测（禁 `Uint8Array.from` 字面量）+ 大载荷往返（50MB 档 fixture）；external 守卫上限钉测；超限提示文案断言同步；
6. 冒烟（V1.12 脚本演进）：真实 41.8MB 课本（50MB 内最大真实文件）挂课次 → 预览 canvas 画完断言（替代当前 10.5MB fixture，其余场景零改动）；外部资料页同文件二跳断言。

## 门禁

相关测试 + typecheck + lint + production build；全量测试；隔离 Windows 冒烟（真实 41.8MB 文件渲染断言 + 既有 18 场景零回归）；进程/临时目录双复核。

## 完成记录

2026-09-10 完成。

- **代码**：managed `MAX_PREVIEW_BYTES` 50MB + `readText` 拆出 `MAX_EDITABLE_TEXT_BYTES` 12MB（V17-C 编辑器冻结语义不随预览放宽）；external `EXTERNAL_PREVIEW_LIMIT_BYTES` 50MB；`isExternalFilePreview` dataUrl 上限 70M 字符；pdf-binary.ts 注释记录解码实测依据（for 循环 149ms vs Uint8Array.from 回调 3809ms，42MB 档——产品实现原本即 for 循环，本增量钉住防回退）。
- **测试**：v1.11-readcontent-binary 超限档演进 50MB+1 + 新增 12→50MB 中间档 binary 可预览断言；v1.12-external-preview 同步演进 + 新增 V1121-A describe 4 例（managed 双常量与 readText 用档钉测/external 50MB + 守卫 70M 钉测/解码预分配 for 循环禁回退（注释剥离后断言）/解码等价往返）。
- **门禁**：全量 98 files / 572 tests passed（1 skipped 既有）、typecheck、lint（regex 空格 autofix 1 处后零错）、production build、diff check 全绿；隔离 Windows 冒烟 **20/20**（既有 18 场景零回归 + 新增 13MB 合成有效 PDF 双场景：课次阅读器 binary 可达无超限提示 + 外部资料页 canvas 渲染）；真实 41.8MB 整册课本（150 页）计时冒烟：点击→首页画完 4.46s、JS 堆 104MB；进程/临时目录双复核零残留。
- **验收证据**：`docs/v1.12-acceptance.md` §8 追加（含实测依据与走查补充项）。
- Git：本地提交 `v1.12.1(V1121-A): preview limit 50mb and decode pinning`；随后 push（沿用 GitHub 授权）。不单独建 pass 标签，随 V1.12 走查。
