# V1132-A · AI 修改对话栏模式卡竖排文字修复（裸 radio/checkbox 宽度复位）

状态：DONE

## 目标

修复产品负责人实测的 AI 修改工作台布局破坏：右栏"这份讲义/整个课件包"两张模式卡的文字被挤成 0 宽竖排细条、溢出到卡片右缘，radio 圆点居中、卡片高达 300px+。

## 前置产物

- 诊断探针 `tmp/v113-smoke/probe-draft-rail.mjs`（进入单文件模式 → getBoundingClientRect 转储 scope 卡几何）。
- 决策 D81（本文件，维护增量决策并入任务文件先例）。

## 根因（探针实测）

全局表单规则 `input, select, textarea { width: 100% }`（V1 时代文本框服务）命中 `.prep-scope-option` 内的裸 radio：`.prep-scope-option input` 只有 `flex-shrink: 0; accent-color`，**无 `width: auto` 覆盖** → radio 被撑到 ~250×280px 占满卡片（Chromium 把 radio 圆点画在拉伸盒中心——即截图中的"居中圆点"），`prep-scope-option-main`（flex:1 + min-width:0）被挤成 **0×281**，文字一字一行竖排、overflow 可见地溢出卡片右缘。

**V19-A（9 月 8 日）起既有**，非 V1.13/V1.13.1 引入——期间用户未打开过 AI 修改页所以今天才暴露；功能本身（点选/切换 scope）因 input 撑满整卡反而"可点面积更大"一直可用，冒烟未截图该状态故漏过。同款隐患审计：V1.2 时代早有先例补丁（`.course-mode-fieldset input, .attendance-options input { width: auto }`），V1.10-B 树行 checkbox 也有 `width: auto`；V19-A/V17-D 漏了三处。

## 修复（D81）

`.prep-scope-option input / .prep-scope-file-list input / .improve-bank-candidates input / .prep-bank-controls-inner input[type='checkbox'] { width: auto; margin: 0; padding: 0; flex-shrink: 0 }`——工作台内全部裸 radio/checkbox 统一回 intrinsic 宽（题库候选列表、目标文件列表、学生版开关行三处同款隐患一并覆盖）。`prep-switch-input`（absolute 隐藏开关）、文本输入框不受影响。

## 门禁

相关测试 + 全量测试 + typecheck + lint + build + diff check + 探针几何断言。

## 完成记录

2026-09-14 完成：

- **修复**：styles.css 一条作用域复位规则（四处选择器）。
- **验证**：探针几何断言——scope 卡高 299px→**69px**、main span 0×281→**174×51**（卡内正常横排）；真实鼠标菜单探针 7/7、V113 冒烟 13/13 零回归。
- **测试**：新 `tests/v1.13.2-input-width-reset.test.ts` 2 例（复位规则选择器与属性钉测 + 裸 radio/checkbox 容器全集审计钉）。
- **门禁**：全量 102 files / 599 tests passed（1 skipped 既有；首轮 backup-restore 并发偶发复跑通过，与 V1.13-C 同款既有偶发）、typecheck、lint、production build、`git diff --check` 全绿。
