# V1.9 决策记录（课件导出可打印 PDF）

产品负责人 2026-09-07 确认草案（`docs/pdf-export-plan-draft.md`，已转正为本方案）并立项。设计基准：`docs/v1.9-pdf-export-plan.md`；交互/流程示意 `tmp/mockups/pdf-export-flow.html`（本地不入库）。草案 §10 七个决策点经产品负责人 2026-09-07 会话确认（"差不多，没问题，写成方案"），全部按推荐项冻结为 D48–D53；非目标（D54）随方案冻结。

## D48 · 导出范围 = 课次内全部 md（与 D27 同宽）

- 入口为课件区阅读器操作行「导出 PDF」，仅选中 `text/markdown` 时显示；
- 版本链任意版本（当前版/历史版）、外部导入 md、编辑版 `（编辑版）.md`、学生版 `… · 学生版.md` 均可导出；
- 与 D27（全部 md 可 AI 二改）同宽：导出是只读动作，风险低于修改；Office/PDF/图片文件不提供入口（本就可「系统打开」打印）。

## D49 · 保存交互 = 原生另存为对话框，成功后自动「在文件夹中显示」

- 原生 `showSaveDialog`，默认文件名 = 原文件名 `.md`→`.pdf`（学生版等长名同样只换扩展名）；
- 落盘 = 同目录临时文件 + 原子重命名（沿用 managed 写入先例），目标被占用/失败返回稳定错误并清理，绝不留半成品；
- 保存成功后 Main 侧 `shell.showItemInFolder` 自动定位产物；响应只回传 `{ saved: true|false }`，**不回传路径**（守 V11-01"绝对路径不进 Preload 响应"）。

## D50 · 页眉页脚 = 左「学生名 · 课次标题」+ 右导出日期 / 居中页码

- `printToPDF` 的 `headerTemplate`/`footerTemplate` 实现：页眉左 = headerText（Renderer 拼显示串，≤100 字，缺省时省略不报错）、右 = 导出日期；页脚居中「第 X 页 / 共 Y 页」；
- 9px 灰字；Chromium 模板仅支持系统字体与内联样式，不做个性化。

## D51 · 版式 = A4 纵向、11pt、白底黑字省墨、防断裂规则

- A4 纵向，margins 上下 16mm / 左右 14mm；`printBackground:false`；
- 正文约 11pt（走查后可调），中文走系统字体栈（微软雅黑）；
- 防断裂：显示公式块、图片、表格、代码块、引用 `break-inside: avoid`；标题 `break-after: avoid`；
- 版式 CSS 独立文件 `print-document.css`，仅打印窗加载，主窗样式零改动。

## D52 · 多文件合并成册 = 候选，本期不做

- 教师版+学生版合并一份 PDF、多讲义按序合并成册，均记为后续候选；
- 本期一次导出一份文件；导出流程单导出串行（并发第二请求 `EXPORT_BUSY`）。

## D53 · 首页不做封面式标题块

- 文档自带 H1，不自动加封面页/标题块；如需封面记为候选。

## D54 · V1.9 非目标与边界

- 零新依赖、零 migration、零 AI 调用（导出不花钱）；
- 不在 Main 重写 md→HTML 解析器（否决理由：与 Renderer 渲染双实现必然不一致）；不改动 `MarkdownDocument` 既有解析与渲染语义（打印视图只消费）；
- 导出 PDF 不登记 `files` 表、不进搜索索引、不进备份包——它是打印产物，不是教学资料；原课件文件字节不动；
- 不做 Office/PDF/图片转 PDF、批量静默导出整学期、docx 导出（D26 已否决）、云端转换、PDF 编辑/水印、页眉页脚可视化编辑器；
- 新 IPC 仅 `export:print-to-pdf` / `export:get-print-payload` / `export:print-ready` 三条（载荷通道带 sender 校验）；不运行 portable/installer。

## 技术事实依据（2026-09-06 代码走读，方案 §2）

1. `MarkdownDocument` 渲染管线全在 Renderer 进程内、纯内存数据（`body + files` → KaTeX 同步 HTML + 图片 data URL），任何窗口可 1:1 复现预览；
2. 图片按 `originalName` 匹配本课文件 → `files:read-content` 返回 data URL，不存在文件路径解析问题；
3. KaTeX 字体（woff2）随包分发，file:// 下正常，打印前等待 `document.fonts.ready`；
4. 窗口安全先例可复用：`windowWebPreferences`（contextIsolation/sandbox）+ `applyWindowNavigationGuard`；
5. 原生对话框注入先例可复用（chooseSourcePath/chooseTranscript/chooseBackupDestination 同模式）；
6. sender 收窄先例可复用（V16-C `extractIpcSender`）。
