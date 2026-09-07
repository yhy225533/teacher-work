# V19-B · 课件区双头合并与操作收纳

状态：TODO

## 目标

课件区（lesson-files-section + lesson-material-reader）三层头部并为单条工具行：课次标题 + 当前文件信息胶囊 ｜ 三主键 `✦ 修改这份` / `✎ 编辑` / `⬇ 导出 PDF`（本节点仅占位，V19-E 接线后才渲染）+ 沉浸阅读 + `⋯` 收纳菜单。可见按钮 11+ → 5；课次标题同屏只出现 1 次。阅读/编辑/题图/分组语义零变化。

## 前置产物

- `docs/v1.9-teaching-ui-restructure-plan.md` §4
- `implementation-tasks/V1_9_DECISIONS.md` D57
- 既有：`lessonFileSourceLabel` / `classifyLessonCoursewareFiles` / `splitLessonFilesByRole`（V1.8.1）、`MdEditor`、素材库右键菜单先例、`link-button`/`danger-button` 样式、lesson-feedback 徽标派生（课程页节点用）

## 任务内容

1. `src/renderer/app-menu.tsx`（新）：共用 ⋯ 菜单组件——分组小标题（cap）/菜单项/危险项底部红区 + 分隔线；点击外部/Esc 关闭（素材库右键菜单交互先例）；供课件区（本节点）与课程页（V19-C）共用；
2. `src/renderer/lesson-material-reader.tsx`：阅读器头部操作行退役——按钮组并入新工具行；`LessonMaterialReader` 保留正文区/树分组/题图/编辑态/提示态（hideTree/immersive 不动）；导出按钮 props（`onExportPdf?` / `exportBusy?`）本节点只接线占位（V19-E 渲染）；
3. `src/renderer/lesson-files-section.tsx`：合并工具行——左：`periodTitle · lesson.title` + 当前文件信息胶囊（文件名 · 当前徽标 · 大小 · `lessonFileSourceLabel` 来源标签）；右：三主键 + 沉浸阅读 + ⋯（本课：刷新/继续上次修改/整个课件包重做[lesson 范围]；本文件：设为讲义底稿/系统打开/所在文件夹/增强解析(MinerU 置灰引导)/—红区—从本课移除）；
4. 状态规则：无 md 新课次 = "AI 新建备课/继续上次备课"主键引导（沿用现有判定）；只读课次（已结束）= 无修改/编辑/移除，仅导出（E 后）+ ⋯（系统打开/所在文件夹）；MinerU 进行中态进菜单项文案；"从本课移除"既有二次确认弹窗不动；
5. `src/renderer/styles.css`：工具行/胶囊/菜单样式；
6. 测试：工具行渲染钉测（胶囊信息/三主键/⋯ 菜单分组/红区底部/只读退化/无 md 引导）；既有 V1.8.1 分组树、提讲义往返、MinerU 置灰、移除确认钉测演进；`MarkdownDocument`/题图跟随零回归。

## 边界

- 零 IPC / 零 migration / 零新依赖；提讲义（`files:set-lesson-role`）、移除（软删除+确认）、刷新、沉浸阅读语义与通道零改动；
- draft-panel 内的 ScopeFileList 等共享组件不在本节点触碰（A 节点范围）；"✦ 修改这份"跳转 AI 修改（带 targetFileId intent）沿用现行为；
- 历史版本折叠块、V1.8.1 讲义/材料分组、题图跟随、编辑保存 D29 语义零变化。

## 验证

- 相关测试 + `npm run typecheck` + `npm run lint` + `npm run build`。

## 完成记录

（待实施）
