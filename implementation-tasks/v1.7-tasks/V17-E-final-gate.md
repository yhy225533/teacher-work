# V17-E · 最终回归与版本验收

**状态：** `自动门 DONE / 真实自测待产品负责人`（2026-09-03）

## 范围

- 全量测试、typecheck、lint、production build、`git diff --check`；
- 中继式验收（D15 先例）：检索计划 JSON 解析容错、候选注入格式、双版两次生成编排、人工编辑保存的版本链/副本命名；
- Windows 隔离冒烟（独立 app-data + `--user-data-dir`，V156-E 样板；冒烟库验证 migration v17 应用）；
- 真实自测清单（产品负责人，DeepSeek 费用预估 ≤ ¥3：双版一次生成约 1.5–2 倍单版成本）：
  1. AI 二改外部导入 md：方案 → 确认 → 发布，原件不动，产物为 `原名 · 第 N 版.md`；
  2. 人工编辑器：改含 `\[...\]` 公式的课件 → 保存为新版本 → 旧版在历史版本；插入本课图片 → 阅读器预览可见；工具栏插入 `$\frac{a}{b}$` 模板 → 预览渲染正确；标题/字号模板生效；
  3. 参考题库生成：AI 计划 tag/难度符合描述；过目步剔除与"再难一点"重检索可用；教师版题目确出自题库（对照题库页）且含标注与答案区块；学生版无答案无标注；两版发布命名正确；
  4. 降级路径：未安装题库开关置灰且生成不受影响；无 MinerU/无流式配置下既有功能不回归；
- 验收记录写入 `docs/v1.7-acceptance.md`；完成后 push（产品负责人已授权 GitHub 同步）。

## 不做

- 不运行 portable/installer，不生成对外交付包；真实 .tqbank、真实教学资料不入 Git；
- 未获得产品负责人最终体验确认前不得创建 `checkpoint-V1.7-pass`。

## 验收

- 全部自动门通过 + 真实自测通过 + 产品负责人最终体验确认；
- 最终确认提交上创建 `checkpoint-V1.7-pass`（标签说明注明基线 `checkpoint-V1.6-pass`）。

## 完成记录（2026-09-03，自动门部分）

- 全量 76 files / 360 tests（1 skipped 既有真实题库冒烟）、typecheck、lint（--max-warnings 0）、production build（electron-vite）、`git diff --check` 全部通过；未运行 portable/installer。
- 隔离 Windows 冒烟：独立 TEACHER_WORKBENCH_L01_SMOKE_APP_DATA + `--user-data-dir` 启动 out/main/index.js；4 进程存活、workspace.db/search.db 创建；schema_migrations 1–17、notes CHECK 含 manual_edit、search schemaVersion=2；stderr 无错误；进程全部终止、临时目录删除；未接触正式工作区/真实资料/任何 Key。
- 中继式验收以版本库测试承载（v17-a-draft-bank / v17-a-write-version / v17-c-md-editor / v17-d-bank-selection：计划容错、候选注入与预算截减、剔除集直达 prompt、双版编排、编辑保存命名原件不动、学生版独立版本链、无 bankPlan 零变化）。
- `docs/v1.7-acceptance.md` 建立：DeepSeek 真实自测清单（≤ ¥3）+ 通过标准 + 安全边界复核。
- 待产品负责人：真实自测 4 项（人工编辑器 / AI 二改放宽 / 题库选题+双版 / 回归抽查）与最终体验确认；通过后创建 `checkpoint-V1.7-pass`。
