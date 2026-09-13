# V1131-A · 走查反馈修复：菜单可选中 + 遮挡避让 + 裁剪逃逸 + 管理态卡顿

状态：DONE

## 目标

修复 V1.13 交付后产品负责人实测的两组问题：①课件区"管理"操作卡顿（大文档每次全量重渲染）；②材料改组菜单在真实鼠标下无法选中（自动分类错了不能换位）。

## 前置产物

- V1.13 验收 `docs/v1.13-acceptance.md`；诊断探针 `tmp/v113-smoke/probe-menu.mjs`（真实鼠标事件序列实证）。
- 决策 D78–D80（本文件，V1.10.1/V1.12.1 先例——维护增量决策并入任务文件）。

## 任务内容（已按探针诊断逐步收敛）

1. **D78 · AppMenuButton 外点关闭改容器判定**：旧实现"点外关闭"只认触发按钮（`buttonRef.contains`），真实鼠标按下菜单项（pointerdown）先把菜单关掉、click 落空、选择静默失效——探针实锤（按下瞬间菜单项数 0、role 不落库）。修复：容器 ref 覆盖触发按钮 + 菜单列表（`containerRef.contains`）。该缺陷自 V19-B 起存在于全部 ⋯ 菜单（工具行/课程页），改组菜单是首个以菜单项点击为唯一路径的功能故暴露。
2. **遮挡避让**：hover ✕ 为 `position: absolute; right: 2px` 悬浮行右缘，恰好压住 ⋯ 右半（探针实锤：点 ⋯ 中心命中 ✕ 弹出移除确认）。修复：`:has(.tree-group-menu-btn)` 作用域内 ✕ 右移至 `right: 30px`，无菜单行不变。
3. **菜单列表 fixed 定位 + 向上翻转**：探针进一步发现菜单列表 absolute 定位被滚动容器裁剪（`.material-reader-tree` overflow-y: auto，窄窗口 max-height 210px）——底部行的菜单不可见不可点，且向上翻时基础类 `top: calc(100% + 6px)` 未被压掉会把列表顶出视口（实测 top=787 > innerHeight=781）。修复：打开时按触发按钮实测坐标改 `position: fixed`，下方空间不足向上翻，翻转方向显式 `top/bottom = 'auto'` 压掉基础类，右对齐显式压掉 `left: 0`。收益面 = 全部 ⋯ 菜单（含工具行/课程页在短容器内的场景）。
4. **D79 · 管理态保留改组菜单**：移除白名单中的 `!manageMode` 条件——管理态下也能换位（讲义命名文件仍不可改组，D46 不动）。
5. **D80 · MarkdownDocument memo 化**：`memo` + `parseBlocks` 按 body useMemo——管理态勾选/工具行状态变化等父级重渲染在 body/files 引用不变时跳过整个昂贵子树（114KB 级文档的全量解析 + KaTeX），点"管理"卡顿的根因消除。零 IPC/零数据库访问（回答"是不是数据库校验"：不是）。
6. **测试基建（真实事件路径）**：`tmp/v113-smoke/probe-menu.mjs` 以 CDP `Input.dispatchMouseEvent`（完整 pointerdown→click 管线）为菜单交互的端到端实证工具——V1.13 冒烟 13/13 未抓到本缺陷的根因是合成 `element.click()` 不触发 pointerdown；新增源码钉测 5 例防回退。

## 门禁

相关测试 + typecheck + lint + production build + 全量测试 + 隔离冒烟 + 真实鼠标探针。

## 完成记录

2026-09-13 完成：

- **修复**：app-menu.tsx（容器关闭判定 + fixed 定位 + 向上翻转 + is-right/top 基础类压掉）、lesson-material-reader.tsx（管理态改组菜单 + MarkdownDocument memo）、styles.css（✕ 让位 :has 作用域规则）。
- **验证**：真实鼠标探针 **7/7**（B1 真实点击开菜单 / B1b 静置稳定 / B2 按下菜单项菜单存活 / B3 抬起 role=exam 落库 + 合成对照 + stderr）；V113 冒烟 **13/13** 零回归。
- **测试**：新 `tests/v1.13.1-menu-and-perf.test.ts` 5 例（容器判定/固定定位与翻转压 auto/✕ 让位/管理态菜单/memo 钉测）；演进 V19-E 冻结钉测（MarkdownDocument memo 化，渲染语义零变化）。
- **门禁**：全量 101 files / 597 tests passed（1 skipped 既有）、typecheck、lint、production build、`git diff --check` 全绿。
