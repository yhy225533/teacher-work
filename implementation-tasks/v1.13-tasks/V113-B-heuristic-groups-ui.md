# V113-B · 启发式分组纯模块 + 四组树 + 手动改组菜单

状态：TODO

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

（待填）
