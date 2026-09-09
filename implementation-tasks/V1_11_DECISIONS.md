# V1.11 决策记录（Office/PDF 应用内预览）

产品负责人 2026-09-10 确认 2026-09-09 调研结论后立项 V1.11（"我认为这个可以，你按照这个写方案，并且实现！"）。设计基准 `docs/v1.11-office-pdf-preview-plan.md`。决策点 D66–D69 按推荐冻结。前置：V1.10 连同 V1.10.1 已冻结在 `checkpoint-V1.10-pass`；问题 1/4/5 已交付；问题 2（429）定位为中转站不动应用侧；问题 3 即本版。

## D66 · PDF 渲染 = react-pdf（pdfjs 的 React 19 封装），不引入完整阅读器形态

- 新依赖 `react-pdf`（v10.5.0，MIT，peerDeps 明确支持 React 19；底层携带 `pdfjs-dist` v6.3.x，Mozilla Apache-2.0，月下载 9,227 万）；
- 形态 = 只读连续滚动预览（`<Document>` + `<Page>` 逐页渲染、宽度适配阅读器栏宽），无缩放工具栏/缩略图/文本选择——最小可用先行，走查反馈驱动迭代；
- worker 经 Vite `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`（react-pdf 官方推荐，electron-vite renderer 即纯 Vite，构建期自动产出 worker 资产）；
- 链接跳转不启用：pdfjs 注解层若触发 window.open 由既有 `applyWindowNavigationGuard` 拦截；
- 非采纳方向：直接用 pdfjs-dist 手写 canvas 管理（多写一个阅读器轮子，收益低）；Electron 内置 file:// viewer（绕开"内容走 IPC"边界，安全上不可接受）；mammoth/vue-office（见方案 §2 判定表）。

## D67 · Word 渲染 = docx-preview，仅 .docx，DOM 构建型无脚本执行

- 新依赖 `docx-preview`（v0.4.0，Apache-2.0，月下载 523 万；传递依赖仅 jszip）；
- `renderAsync(arrayBuffer, container)` 一次性渲染，接近原版式（段落/表格/图片/页眉脚）；卸载清空容器；
- **仅 Office Open XML (.docx)**：`.doc`（legacy 二进制）、`.pptx`、`.xlsx` 不在本版（无成熟浏览器端方案），维持 unsupported + 系统打开——验收清单明示，防"所有 Office 都能看"的过度预期；
- 不可信输入安全：DOM 构建型渲染（无 innerHTML 脚本注入路径）；内嵌图片走内存 blob，不落盘；
- 非采纳方向：mammoth（语义 HTML 丢版式 + 不可信 HTML 需再引入 sanitize，两步成本高）；Office Online/Google 嵌入（要求公网 URL，违背 local-first）。

## D68 · 载荷通道 = 既有 files:read-content 响应合同加 `binary` 分支，零新 IPC

- `ManagedFileContent` 新增 `{ file, kind: 'binary', dataUrl }`——与 `image` 分支同构（`data:<mime>;base64,` 前缀），渲染端一行转 ArrayBuffer；
- Main 判定：`stats.size ≤ MAX_PREVIEW_BYTES(12MB)` 且 `mimeType ∈ { application/pdf, docx MIME }` → binary；image/text/unsupported/超限四个既有路径逐字节不变；
- 守卫 `isManagedFileContent` 加 binary 分支（`isNonEmptyString(dataUrl)` 且 `data:` 前缀）；preload/Main IPC 注册零改动；
- 12MB 上限沿用（base64 膨胀 ×1.33 → ~16MB 字符串过 IPC，个人桌面可接受；防超大文件拖垮内存）；
- 非采纳方向：新开 `files:read-binary` 通道（多一条白名单 + 守卫面，无必要）；ArrayBuffer 直传（contextBridge 跨上下文克隆，无收益）；流式分块（12MB 上限内无必要）。

## D69 · V1.11 约束与边界

- **依赖冻结解除范围 = 仅 `react-pdf` + `docx-preview` 两个直接依赖**（传递：pdfjs-dist/jszip 等随包），其余任何新依赖一律不得引入；渲染层其余部分（MdEditor/MarkdownDocument）零变化；
- 零 migration、零新 IPC 通道、零新 AI 调用；既有 readContent 的 image/text/unsupported 语义、编辑与导出链（D29/D48–D54）、V1.10 三层移除入口与保活（D61–D65）零改动；
- 新增 renderer 组件只做预览：不写文件、不接触路径、不进备份/索引；PDF/Word 产物永不覆盖原件（预览纯只读）；
- 不运行 portable/installer；`checkpoint-V1.11-pass` 待产品负责人按 `docs/v1.11-acceptance.md` 走查确认后创建，与既有 pass 标签互不替代；
- 后续候选记档：MinerU/officeparser 抽取文本接通 AI 参考线（v1.10 方案 §8 廉价先行项，牵扯搜索索引存储结构，另立项）；.doc/.pptx/.xlsx 渲染（按真实走查需求再评估）。
