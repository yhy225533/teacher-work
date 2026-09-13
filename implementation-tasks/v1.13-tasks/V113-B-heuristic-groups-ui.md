# V113-B · 启发式分组纯模块 + 四组树 + 手动改组菜单

状态：DONE

## 目标

课件区挂课文件按 D75 启发式分四组展示；老师可对单个文件手动改组（含恢复自动）；课程页行动卡计数随新语义。

## 前置产物

- V113-A 完成（role 列 + 通道可用）；方案 §3/§4；D75/D76。

## 任务内容

1. 新模块 `src/renderer/lesson-material-groups.ts`：`LESSON_MATERIAL_GROUP_LABELS`（四组图标/文案/aria）、`lessonMaterialGroupRole(file, context)` 纯函数（规则表见方案 §3）、`groupLessonMaterialNodes(nodes, context)`（节点级分组，保持树构建不变）、`splitLessonFilesByRole` 内部委托新函数（签名不变，材料 = 三组合集）；
2. `src/renderer/lesson-material-reader.tsx`：grouped 渲染两组 → 四组（组序/空态文案/组内嵌套保持）；新 props：`groupOverrides`（fileId → 手动组 | null | undefined 自动）、`lessonGroupContext`（课次 title/lessonLabel/periodTitle）、`onSetFileGroup?`；每行 ⋯ 改组菜单（复用 AppMenuButton，当前组置灰、恢复自动条件渲染；白名单 = 非 isLessonLectureFile 命名文件、非 readOnly、非 manageMode、非历史版本行）；
3. `src/renderer/lesson-files-section.tsx`：从 overview links 提取 roleOverrides 传 reader；`onSetFileGroup` → `files.setMaterialGroup` → 既有 contentChanged reload 链刷新（零新增状态机）；
4. `src/renderer/course-detail.tsx`：hero chips 讲义/材料计数确认走委托后的 `splitLessonFilesByRole`（预期零代码变化，钉测核对语义）；
5. CSS：`material-role-group` 扩展四组（exercise/exam 图标与配色走既有令牌）、菜单项样式沿用 app-menu；
6. 测试：启发式规则表逐条（关键词命中/优先级/标题包含/薄壳引用/misc 兜底/D46 命名优先）、四组渲染钉测、菜单条件渲染钉测、`splitLessonFilesByRole` 语义演进（导入讲义计入讲义侧）、V1.8.1 既有分组钉测演进。

## 门禁

相关测试 + `npm run typecheck` + `npm run lint` + `npm run build` 全绿。

## 完成记录

2026-09-13 完成：

- **启发式纯函数**：实现位置收敛到 `lesson-prep-context.ts`（设计基准原写"新模块 lesson-material-groups.ts"——实现时发现规则 1/6 需复用冻结的 `isLessonLectureFile` / `extractResourceReferences` / `findReferencedFiles`，同文件实现可避免循环导入；功能与规则表逐条一致）。新增 `LESSON_MATERIAL_GROUP_META`（四组图标/文案/空态）、`LessonMaterialGroupContext`、`lessonMaterialGroupRole`（D75 七条首中即停）、`groupLessonMaterialNodes`（树节点四组桶，树构建零变化）；`splitLessonFilesByRole` 保留签名、内部委托新函数（D76 语义演进：讲义组 = lecture 组，材料组 = 三组之和；课程页 hero chips 零代码改动吃到新语义）。
- **四组渲染**：`LessonMaterialReader`/`LessonMaterialTree` 新 `grouping`（lessonTitle + groupOverrides）与 `onSetFileGroup` props（reader 透传 tree）；grouped 渲染从两组改四组循环（组序/计数/空态来自 META），lecture 组保留当前徽标、全组保留来源标签；未传 grouping 时启发式退化为空标题上下文（规则 5/6 不可用，规则 1-4/7 照常）。
- **改组菜单**：树行内 `tree-group-menu-btn`（复用 AppMenuButton，紧凑样式 hover 才显）——四组项（当前组置灰）+ 分隔 + 「↺ 恢复自动分组」（仅手动覆盖文件可用）；白名单 = 非 `isLessonLectureFile` 文件且非管理态；readOnly / pick 场景不传回调即不出菜单。
- **section 接线**：`groupOverrides` 从 overview lesson 链接 role 派生（仅非 null 入 map）；`setFileGroup` → `files.setMaterialGroup`，成功后 Main 补发 contentChanged → 既有 `onContentChanged → reload` 链刷新四组与 hero 计数；readOnly 不传回调。
- **测试**：新 `tests/v1.13-material-groups.test.ts` 13 例——规则表逐条（D46 命名/习题作业优先于标题匹配/试卷复习/补充讲义裁决含 K字 docx 实名钉测/标题包含含单字符防御/薄壳外链 vs 纯题图/misc 兜底）、四组桶、splitLessonFilesByRole 语义演进、四组渲染顺序 + 手动覆盖落位 + 版本链行无菜单 + 未传回调无菜单 + 菜单项源码钉测（静态渲染不可达交互态）；演进 v1.8.1 钉测（'本课材料' 文案退役 → META 四组断言）与 v1.9-courseware-toolbar 钉测（splitLessonFilesByRole → groupLessonMaterialNodes）。
- **门禁**：相关测试 80/80（9 files）、typecheck、lint、production build 全绿。
