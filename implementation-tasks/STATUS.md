# 实施状态

状态只使用 `TODO`、`IN_PROGRESS`、`BLOCKED`、`DONE`。只有当前里程碑验收证据齐全时才能标 `DONE`。

## 已完成历史基线

| 任务 | 状态 | 完成记录 |
|---|---|---|
| T01 项目骨架 | DONE | Electron/React/TS 骨架，测试、typecheck、lint、build 与 Windows 启动验证通过 |
| T02 工作区与 SQLite 基础 | DONE | WorkspacePaths、SQLite 连接/迁移/身份封装与回滚验证完成 |
| T03 安全 IPC 与可观测性 | DONE | 类型化白名单 IPC、Renderer/Main 边界、脱敏日志与回归测试完成；Sol PASS |
| T04 文档解析 Spike | DONE | 40 份脱敏真实样本、损坏输入和 Electron runtime 证据完成 |
| T05 中文/数学搜索 Spike | DONE | 真实语料、SearchNormalizer、FTS5 trigram 与 fallback 证据完成 |
| T06 文件刷新 Spike | DONE | 以启动/焦点返回/重新打开/手动刷新保证一致，watcher 仅为可选加速 |
| T07 恢复 Spike | DONE | 代表性临时文件、SQLite、解析与派生索引恢复证据完成 |
| T08 Spike 决策闸门 | DONE | 23/23 gate、18 项测试、typecheck、lint、build 通过；Sol PASS |

> 旧 T09–T42 已退役，不再出现在活动状态表中，也不得执行。

## Lean V1 已完成里程碑

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| L01 核心数据与基础树 | DONE | schema v2、NodeService、课程/学生/课次与 note、类型化 core IPC、基础树 UI；24 tests、typecheck、lint、build 与隔离 Windows UI smoke 通过 |
| L02 managed 文件与素材 | DONE | schema v3、受控对象目录、导入/独立副本/软删除恢复、文件 IPC 与 Preload 边界完成；32 tests、typecheck、lint 通过 |
| L03 文件页面与刷新 | DONE | schema v4、素材库/课次/学生资料入口、启动/焦点/刷新/重新打开核对与内容变化事件完成；33 tests、typecheck、lint、production build 与隔离 Windows Electron UI smoke 通过 |
| L04 管资料阶段闸门 | DONE | 代表性资料流程、两个不连续阶段与副本隔离、外部编辑刷新、删除/恢复完成；34 tests、typecheck、lint、production build 与 Windows Electron UI smoke 通过；Sol PASS，`checkpoint-L04-pass` 已创建 |
| L05 搜索核心 | DONE | schema v5 索引状态、可重建 search.db/FTS5 trigram、版本化 Normalizer、短词 fallback、文件/节点/note/chunk 搜索与课程范围过滤完成；37 tests、typecheck、lint 通过 |
| L06 统一解析与顺序 Worker | DONE | `officeparser@7.5.1` 统一 Parser、TXT/MD 轻量解析、单 worker 顺序 Hash/解析/索引、启动重扫、导入/刷新后排队与 indexed/no_text/parse_failed 状态完成；41 tests、typecheck、lint、production build 通过 |
| L07 搜索 UI/重建阶段闸门 | DONE | 全局搜索页、来源/位置/状态展示、类型化搜索 IPC、登记 fileId 打开、search.db 删除/重建与阶段 2 验收完成；44 tests、typecheck、lint、production build 通过；Sol PASS，`checkpoint-L07-pass` 已创建 |
| L08 安全 Key 与 AI Gateway | DONE | provider/model/endpoint 设置、safeStorage/会话 Key、OpenAI-compatible Gateway、错误/超时/取消、fake provider 测试完成；51 tests、typecheck、lint 通过 |
| L09 Context 与三类草稿 | DONE | 选定文件/片段与字符/token 限制、讲义/例题/作业独立生成、来源与 prompt 元数据、普通可编辑 note、失败重试与安全 IPC 完成；57 tests、typecheck、lint 通过 |
| L10 AI 备课阶段闸门 | DONE | fake provider 完整选资料→三类草稿→人工修改→保存验收；Key/失败/重试/上限/原资料隔离边界完成；22 files / 61 tests、typecheck、lint、production build 与 diff check 通过；Sol PASS，`checkpoint-L10-pass` 已创建 |
| L11 空闲态备份与恢复 | DONE | Main 侧外部编辑器确认与空闲闸门、SQLite backup API、managed 文件与元数据 manifest、staging 原子发布、新空目录恢复、SQLite/schema/路径/数量/大小/元数据校验、恢复后搜索索引重建与 Key 排除完成；24 files / 70 tests、typecheck、lint、diff check 通过 |
| L12 Windows 交付总闸门 | DONE | 选择 unpacked Windows portable 目录交付；`npm test` 24 files / 70 tests、typecheck、lint、production build、electron-builder `dir` packaging 与 `git diff --check` 通过；四条 smoke、Windows 启动/工作区创建/退出/重开与 Renderer/包内容安全审计记录于 `docs/v1-acceptance.md`；Sol PASS，`checkpoint-L12-pass` 已创建 |

## V1.1 已完成里程碑

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| V11-01 外部资料浏览 | DONE | 单 external root、安全 lazy 资料树、折叠/恢复、打开/定位与手动刷新已完成；18 项相关测试、typecheck、lint、开发窗口空状态走查通过 |
| V11-02 课次备课入口与本次资料 | DONE | 从课程课次进入备课、学生可选上下文、外部/素材独立副本与本次资料默认选择完成；49 项相关测试、typecheck、lint 和隔离 Electron 双入口 UI 走查通过 |
| V11-03 Skill、本次要求与固定 Prompt | DONE | schema v10 Skill 软删除 CRUD、两套可编辑预置模板、可选 Skill/本次要求、固定三类分区 Prompt 与历史快照完成；38 项相关测试、typecheck、lint 和隔离 Electron UI 走查通过 |
| V11-04 草稿箱、预览编辑与保存 | DONE | schema v11 draft/saved 同行生命周期、全局草稿箱、课次结果列表、同区预览编辑、保留旧稿的重新生成与软删除完成；全局导航固定、右侧内容独立滚动；41 项相关测试、typecheck、lint 和隔离 Electron UI 走查通过 |
| V11-05 V1.1 回归与 Windows 交付 | DONE | 自动主流程、96 项全量测试、typecheck、lint、production build、portable 打包、安全审计和隔离 Windows 启动/本地 fake AI smoke 已通过；最终通过标签等待产品负责人完成测试后确认 |
| V1.1 测试后小修复 | DONE | Bug 1–5 已完成：隐藏 Windows 默认菜单、工作区自适应撑满、整体紧凑化、白色图标导航、已移除资料二次确认后彻底删除；开发版 Main/Preload 重启要求已记录于 `docs/v1.1-post-test-fixes.md` |
| V1.1 当前候选重验 | DONE | 当前 HEAD 的 32 files / 101 tests、typecheck、lint、build、portable、diff check、包内容审计及隔离 Windows 启动/滚动/正常退出均通过；产品负责人已确认最终体验，`checkpoint-V1.1-pass` 创建于最终确认记录提交 |

## V1.2 已完成里程碑

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| V12-01 Core、课程生命周期与点名持久化 | DONE | schema v12、课程进度/生命周期、学生在读关系、课次 session、点名快照与 3 个安全 IPC 已完成；11 项 V12 专项、112 项全量测试、typecheck、lint、build、diff check 通过 |
| V12-02 我的课程、软推进与点名交互 | DONE | 课程列表/详情三栏、活动/已结束筛选、今日点名、Current/Viewed 分离、局部创建 Modal、软推进和点名交互已完成；25 项相关、119 项全量测试、typecheck、lint、build、隔离 Electron smoke 通过 |
| V12-03 真正的学生页 | DONE | 学生列表/详情、搜索/新建、在读/历史课程、manual 记录和课程双向导航已完成；22 项相关、127 项全量测试、typecheck、lint、build、隔离 Electron smoke 通过 |
| V12-04 课次资料与 V1.1 备课接入 | DONE | Viewed Lesson 的 lesson_files、任意课次开始/继续备课、Prep 文案和学生文件 UI 收口已完成；35 项相关、131 项全量测试、typecheck、lint、build、隔离 Electron smoke 通过 |
| V12-05 V1.2 全量回归与版本验收 | DONE | 42 files / 133 tests、typecheck、lint、production build、diff check、安全审计与代表性隔离 Windows 流程通过；产品负责人最终体验确认 PASS，`checkpoint-V1.2-pass` 创建于最终确认提交 |

## V1.3 已完成里程碑

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| V13-01 快速建课数据契约与原子编排服务 | DONE | schema v13、`duration_minutes`、session 时长读写、`createCourseSetup` 单事务、Core IPC / Preload 和 Main 二次校验完成；43 files / 140 tests、typecheck、lint、build、diff check 通过 |
| V13-02 向导领域模型、名单与排课预览 | DONE | 名单精确匹配 / 重名解析、阶段推荐、1–100 课次、本地规律 / 自由日期排课、DST、例外、部分未排、确认摘要和最终请求转换完成；2 files / 18 tests、typecheck、lint、diff check 通过 |
| V13-03 快速建课前两步 UI | DONE | 四步容器、课程 / 学生、重名确认、阶段 / 课次、即时预览、100 节上限和返回保留状态完成；2 files / 17 tests、typecheck、lint、build、静态 Renderer smoke、diff check 通过，未提前暴露不完整入口 |
| V13-04 排课、确认页与课程页完整接入 | DONE | 三种排课、自由日期月历、例外 / 单节调整、全部 / 部分 / 未排确认、唯一事务提交、失败定位 / 重试、课程页主次入口、成功回详情和单节时长维护完成；10 files / 52 tests、typecheck、lint、build、diff check 与两组隔离 Windows Electron smoke 通过 |
| V13-05 V1.3 全量回归与版本验收 | DONE | 47 files / 164 tests、typecheck、lint、production build、diff check、安全审计和 Windows 流程通过；产品负责人最终体验确认 PASS，最终确认提交用于创建并上传 `checkpoint-V1.3-pass` |

## V1.4 已完成里程碑

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| V14-01 题库快照、只读服务与安全 IPC | DONE | `.tqbank` 导出、原子导入、只读查询、单题复制、契约 / Preload / IPC / Main 接入完成；2 files / 8 tests、typecheck、lint、build、diff check 通过 |
| V14-02 工作台原生题库浏览与单题动作 | DONE | 现有工作台壳内题库导航、空状态、默认完整列表、宽屏右侧 / 窄屏下方详情、公式图片、答案解析和单题动作完成；3 files / 9 tests、typecheck、lint、build、真实快照 Electron smoke 通过 |
| V14-03 V1.4 全量回归与版本验收 | DONE | 普通全量 50 files / 174 tests、真实快照 1 file / 1 test、typecheck、lint、production build、diff check、安全 / Git 审计和代表性 Windows 流程通过；产品负责人最终体验确认 PASS，最终确认提交用于创建并上传 `checkpoint-V1.4-pass` |
| V1.4 测试后筛选修复 | DONE | 题型归一为 4 类、非月考 / 缺失月份显示“无”、知识点标签可折叠多选并支持包含 / 不包含；全量 50 files / 173 tests、真实快照 1 file / 1 test、typecheck、lint、build、导出器语法和 diff check 通过 |
| V1.4 高信息密度与组合筛选增强 | DONE | 紧凑两行筛选、考试类型 facet、自由题号表达式、结果卡 KaTeX 与 Markdown 转义处理完成；全量 50 files / 174 tests、真实快照 1 file / 1 test、typecheck、lint、build、隔离 Electron smoke 和 diff check 通过 |

## V1.5 活动里程碑

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| V15-01 教学内容导航目标与双向入口 | DONE | Renderer 类型化教学内容目标、课程/学生/直接入口、草稿箱迁移、临时上下文与双向返回完成；52 files / 180 tests、typecheck、lint、production build、diff check 通过；未运行 portable/installer |
| V15-02 教学内容工作台与宽正文 | DONE | 三分区工作台、临时课次抽屉、课件正文、沉浸阅读、备课“查看课件”返回与窄窗口防御布局完成；1200px 宽度与窄窗口证据并入 V15-03 隔离流程；53 files / 187 tests、typecheck、lint、production build、diff check 通过 |
| V15-03 V1.5 全量回归与版本验收 | DONE | 最终门 54 files / 190 tests、typecheck、lint、production build、diff check 通过；代表性隔离 Windows 流程、真实 380MB 题库、fake AI 备课与宽度证据见 `docs/v1.5-acceptance.md`；修复课程/学生页加载期选择丢失缺陷；产品负责人最终体验确认 PASS，`checkpoint-V1.5-pass` 已创建于最终确认提交 |

## V1.5.2 活动里程碑（AI 修改工作区）

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| V152-A 术语和界面收口 | DONE | 三分区改为"课件 / AI 备课 / 修改记录"，全局入口改为"修改记录 {计数}"，状态术语改为"修改中/已确认"，Main 删除保护文案同步；全量 54 files / 190 tests、typecheck、lint、production build、diff check 通过 |
| V152-B 当前工作副本 | DONE | 进入 AI 备课自动恢复最近未发布工作副本并提示"未成为正式课件"；跨分区/换课次/返回有未保存编辑时弹确认；编辑中切换结果保留原有确认；54 files / 191 tests、typecheck、lint、production build、diff check 通过；隔离 UI smoke 通过 |
| V152-C 已有课件改进流程 | DONE | 基于课件改进入口 + 参考范围/修改要求校验 + AI 方案审阅（确认/重新出方案/放弃）+ 确认后按方案生成 + 新旧对比；4 项契约测试；55 files / 195 tests、typecheck、lint、build、diff check 通过；D15 中继式 AI 验收通过（方案与生成均为真实语义现写内容） |
| V152-D 修改记录与版本发布 | DONE | 按批准的窄通道 `draft:publish-to-lesson` 实现"保存为新版本"：原子写入 managed 新课件（"标题 · 第 N 版"命名）、关联课次、节点转"已确认"、旧版本保留；55 files / 196 tests、typecheck、lint、build、diff check 通过 |
| V152-E V1.5.2 全量回归与版本验收 | DONE |  全量 54 files / 197 tests、typecheck、lint、build、diff check 通过；真实思源课件全流程（导入→方案→确认→生成→对比→发布→课件区 v1/v2 并存）通过；修复结构性文件过滤误判；报告见 `docs/v1.5.2-acceptance.md`；产品负责人已确认以中继式测试结束 V1.5.2（真实 provider 自测为遗留项）；`checkpoint-V1.5.2-pass` 已创建 |

## V1.5.3 活动里程碑（课件动作化）

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| V153-A 课件动作化与 AI 修改工作台 | DONE | 更正后真实现：两分区 + 课件区上下文 AI 入口 + **两栏工作台**（左=参考资料/本课修改节点，右=提示词常驻+方案审阅+对比+发布；移除旧三栏与"AI 备课"卡片）+ 课件列表单当前版+历史折叠+正文默认当前版；实机复验通过；55 files / 197 tests、typecheck、lint、build、diff check 通过 |
| V153-B V1.5.3 全量回归与版本验收 | DONE | 全量 54 files / 197 tests、typecheck、lint、build、diff check 通过；真实思源课件隔离全流程（入口→工作台→中继生成→发布→课件区单当前版+历史折叠+正文默认最新）通过；产品负责人已完成最终体验确认；报告 `docs/v1.5.3-acceptance.md`；已创建 `checkpoint-V1.5.3-pass` |

## V1.5.3.1 活动修正（AI 修改范围分流）

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| V1531-A 修改范围模型与两种入口 | DONE | Renderer-only `new/single/lesson` intent、当前版/历史版分类、课件区“修改这份 / 整课重做 / 新建”入口、显式入口不抢恢复旧草稿、工作台目标/自动基线/可选参考分组与模式切换完成；5 files / 24 tests、typecheck、lint、production build、diff check 通过 |
| V1531-B 模式化生成与最终回归 | DONE | 单文件/整课模式化方案与完整生成、基线优先文本预算、metadata 恢复、模式化比较/发布语义完成；修复已有第 1 版发布时重复命名缺陷与思源跨行图片引用解析；新增课次正文“从本课移除”入口与素材库独立原件筛选/目录式查找；隔离 Electron 完成 v1→单文件 v2→整课 v3，SQLite/来源顺序核验通过；56 files / 211 tests passed（另 1 file / 1 test skipped），typecheck、lint、build、diff check 通过；产品负责人已确认 V1.5.3 |

## V1.5.3.2 活动实现（素材库逻辑目录）

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| V1532-A 素材库目录模型与迁移 | DONE | 新增 schema v15 的 material_folders / material_folder_items；独立素材进入待整理虚拟入口，课程/学生副本隔离；嵌套目录、单父级归属和空目录删除规则完成；专项模型测试通过 |
| V1532-B 素材库服务与安全 IPC | DONE | 新增目录查询、新建、重命名、移动、排序、删除和保存为素材 IPC；Renderer 仅通过 Preload 白名单访问，外部根目录校验和托管文件原子复制继续复用 |
| V1532-C 素材库树形工作台 UI | DONE | 素材库页面改为系统入口 + 老师自建层级树 + 文件区；类型仅作辅助筛选；导入、复制到课次、移除/恢复和逻辑目录操作文案明确；外部资料入口同步为“保存到素材库” |
| V1532-D 最终回归 | DONE | 产品负责人已确认两棵树、目录维护、资料流转及应用内弹窗体验；Renderer 原生确认/输入框已统一替换为应用内弹窗，覆盖从本课移除资料、AI 修改、快速建课及素材库目录维护；自动质量门通过；已创建 `checkpoint-V1.5.3-pass` |

## V1.5.4 活动实现（素材库树交互）

| 里程碑 | 状态 | 完成/阻塞记录 |
|---|---|---|
| V154-A 树交互与安全移动 | DONE | 文件夹展开/收起、就地创建、文件/文件夹右键菜单、文件拖拽归档、文件夹跨级移动与排序完成；复用既有 schema、Service 和 IPC 通道；专项测试、typecheck、lint、production build 通过 |
| V154-B 最终回归与体验验收 | DONE | 最终门复跑通过：全量 57 files / 215 tests passed（1 skipped）、typecheck、lint、production build、`git diff --check`；产品负责人已完成真实窗口体验确认（素材树拖拽/右键/重启保持与课程阶段默认收起共 6 点全部通过）；`checkpoint-V1.5.4-pass` 创建于最终确认提交 |

## V1.5.5 已立项（正确性与健壮性加固）

| 里程碑 | 状态 | 计划内容 |
|---|---|---|
| V155-A AI 修改范围元数据结构化 | DONE | `DraftModificationScope` 可选键双轨制、`draft-scope.ts` 纯模块抽取、旧笔记回退解析完成；相关 30 tests、typecheck、lint 通过 |
| V155-B 素材库 IPC 测试与 overview 查询修正 | DONE | `material-library-ipc.test.ts` 补齐（6 tests）、恒真 WHERE 简化与类型化行接口（零行为变化）、软删除/挂课副本行为钉死完成；相关 11 tests、typecheck、lint 通过 |
| V155-C 解析超时与窗口导航守卫 | DONE | DocumentParser `parseTimeoutMs`（默认 120s，超时按既有 parse_failed 语义）与 `applyWindowNavigationGuard`（deny window.open + 导航白名单）完成；相关 9 tests、typecheck、lint 通过 |
| V155-D 版本计数与约束错误码修正 | DONE | 发布版本号改含软删除的锚定 MAX+1（软删不重号、手工高版本号计入）；`isConstraintError` 错误码优先+消息兜底；相关 32 tests、typecheck、lint 通过 |
| V155-E V1.5.5 最终回归与版本验收 | DONE | 全量 59 files / 238 tests passed（1 skipped）、typecheck、lint、production build、diff check 与隔离启动 smoke 通过；产品负责人已于 2026-09-01 完成真实窗口最终确认（旧修改节点还原、AI 修改两步流编号连续、素材库三视图、全局搜索共 4 点全部通过）；`checkpoint-V1.5.5-pass` 创建于最终确认提交 |

基线 `checkpoint-V1.5.4-pass`（已创建）；设计基准 `docs/v1.5.5-hardening-plan.md`，决策 D19；按编号顺序执行，同一时刻最多一个 `IN_PROGRESS`。

## V1.5.6 已立项（可维护性技术债清理，经产品负责人豁免提前激活）

| 里程碑 | 状态 | 计划内容 |
|---|---|---|
| V156-A 共享工具收敛与覆盖率基线 | DONE | `ui-utils.ts` 收敛 16 处 toErrorMessage 与 4 处 formatBytes（回退文案逐处等值审计）；新增 `tests/ui-utils.test.ts`（6 tests）；引入 coverage-v8 只记基线（73.28% 语句）。全量 60 files / 244 tests、typecheck、lint、diff check 通过 |
| V156-B CSS 设计令牌 | DONE | `:root` 14 令牌（indigo/slate/边线/底色/danger/圆角）落地；styles.css 291 行 + question-bank.css 31 处机械等值替换，目标 hex 零残留、引用全部可解析；全量 244 tests、build、lint、typecheck、diff check 通过 |
| V156-C overview 共享缓存 | DONE | `CoreOverviewProvider`（快照 + reload/invalidate/clearError）+ `overview-reload-coalescer.ts` 纯模块（in-flight 合并 + 单次跟单）；4 页迁移完成（draft-panel 的 core 拉取并入共享，files/skills 独立拉取保留）；新增 11 tests（coalescer 5 + provider 6）；全量 62 files / 255 tests、build、lint、typecheck 通过；零 IPC/schema 变化 |
| V156-D 向导去重与静态渲染测试 | DONE | 共享编排 hook `useQuickCourseWizardOrchestration`（步骤 1–2 收敛，逐向导差异参数化保持原值，两组件只剩渲染层/full 特有步骤 3–4）；2 处字符串 pin 按先例重定向到编排模块（意图不变）；新增 `static-render-v156-d.test.ts`（10 tests：树/拖拽 affordance/aria/右键菜单骨架/LessonsSection/draft-panel 两模式/App 外壳），菜单与展示子组件最小导出抽取零行为变化。全量 63 files / 265 tests、typecheck、lint、diff check 通过 |
| V156-E V1.5.6 最终回归与版本验收 | DONE | 全量 63 files / 265 tests、typecheck、lint、production build、diff check 通过；coverage 终值 54.32%（范围变化说明见验收文档）；隔离 Windows 冒烟通过；产品负责人已于 2026-09-01 完成真实窗口最终确认（建课双入口、课程/学生页、教学内容两模式、素材库/题库/搜索、整体视觉共 6 点全部通过）；`checkpoint-V1.5.6-pass` 创建于最终确认提交 |

基线 `checkpoint-V1.5.5-pass`（待 V155-E 验收后创建）；设计基准 `docs/v1.5.6-maintainability-plan.md`，决策 D20；基线创建前任何任务不得置为 `IN_PROGRESS`。

> 2026-08-31 产品负责人裁决：V1.5.5 与 V1.5.6 合并验收。V155-E 保持 `IN_PROGRESS`；V1.5.6 链经产品负责人明确豁免基线提前激活；两链任务与提交保持独立，确认通过后依版本顺序创建两个 checkpoint。

## V1.6 已立项（AI 修改逻辑重做：预算修复、流式生成与 MinerU 文档解析）

| 里程碑 | 状态 | 计划内容 |
|---|---|---|
| V16-A 网关预算修复与测试连接判定 | DONE | testConnection 改结构判定（choices 非空即可，content 可空）且业务空正文语义不变；`DEFAULT_AI_TIMEOUT_MS = 120_000`；默认预算 30,000 字 / 16,000 token；不发送 thinking 参数；全量 63 files / 268 tests、typecheck、lint、production build、diff check 通过 |
| V16-B 修改范围收口与参考预算 UX | DONE | 修改对象收口为应用内课件版本（`isAppGeneratedCoursewareFile`，外部 office/pdf/导入 md 置灰提示）、无版本引导先生成；参考 ≤10 份、字符数与占用实时显示、超 30,000 字明确列名确认（`draft-reference-budget.ts` 纯函数）；全量 64 files / 278 tests、typecheck、lint、production build、diff check 通过 |
| V16-C 流式生成 IPC 与渲染 | DONE | `ai:stream-event` 推送（载荷双向守卫）、Main SSE 解析与静默超时 30s、reasoning 仅计数、四条生成流进度面板（思考进度+逐字上屏+取消）、invoke 最终响应仍返回完整结果；中继式验收留痕于 ai-stream-ipc.test；全量 66 files / 289 tests、typecheck、lint、production build、diff check 通过 |
| V16-D MinerU 文档解析集成 | DONE（含当日事故修复补记） | migration v16 + search schema v2（两处 index_status CHECK 追加 mineru_ready，测试驱动发现 search_documents 同样需重建）、safeStorage 多槽、Mineru 设置卡与判活 IPC、`MineruService` 上传/轮询/fflate 解压/full.md 入库（下载域白名单+zip 防穿越）、文件右键"增强解析"入口；**2026-09-02 事故**：迁移事务内 PRAGMA FK 无效致 v16 级联清空真实工作区 lesson_files（286 行）——当日从迁移前快照完整恢复、`runMigrations` 事务外 FK 守卫 + 回归测试（先红后绿）修复，门禁全绿，详见任务文件事故补记 |
| V16-E 最终回归与版本验收 | DONE | 自动门与隔离冒烟通过（全量 70 files / 305 tests、typecheck、lint、build、diff check、中继式流式验收、冒烟库验证 v16+search v2）；两轮真实自测反馈（流式观感 A1 秒表、显示公式渲染缺陷修复、MinerU 入口可见性缺陷修复、自测清单按裁决修订）；**2026-09-02 产品负责人最终验收通过**（DeepSeek 真实自测通过、MinerU 按需裁决跳过），`checkpoint-V1.6-pass` 创建于最终确认提交 |

**V1.6 已冻结在 `checkpoint-V1.6-pass`（基线 `checkpoint-V1.5.6-pass`）。** V1.7 需求已由产品负责人提出（见 V16-E 任务文件"V1.7 需求记录"）：① 所有 md 文件可 AI 二次编辑（D23 收口放宽，明确要做）；② md 人工直接编辑（候选）；③ 扫描件就地提示增强（候选）——待产品负责人确认开工后另立 V1.7 设计基准与任务链。

基线 `checkpoint-V1.5.6-pass`（已创建）；设计基准 `docs/v1.6-ai-modification-rewrite-plan.md`，决策 D21–D26（`implementation-tasks/V1_6_DECISIONS.md`）；按编号顺序执行，同一时刻最多一个 `IN_PROGRESS`；不运行 portable/installer。

## V1.7 已立项（MD 课件编辑与题库 AI 选题生成）

| 里程碑 | 状态 | 计划内容 |
|---|---|---|
| V17-A 合同与 Main 支撑 | DONE | migration v17（notes.note_kind 追加 manual_edit，12 步法重建、FK 守卫沿用 V16-D 框架）、files:read-text / files:write-version（永写新文件、原件只读）/question-bank:search-questions 三条新 IPC、DraftBankPlan/dualVersion/studentNoteId/bankSelection 合同守卫、题库上下文注入与预算截减、AI 检索计划 JSON 容错、学生版第二次生成编排完成；专项测试 20 例 + 既有终点钉测按序演进（16→17），全量 74 files / 332 tests、typecheck、lint 通过 | migration v17（notes.note_kind 追加 manual_edit）、`files:read-text`/`files:write-version`（永写新文件）/`question-bank:search-questions` IPC、DraftBankPlan/dualVersion 合同、题库上下文注入与预算占用、AI 检索计划（JSON 容错）、学生版生成编排 |
| V17-B AI 修改对象放宽 | DONE | 修改对象放宽到课次全部 text/markdown managed 文件（D27：isAiEditableFile + 版本链最新版优先排序 orderAiEditableFiles）；“修改这份”对 md 启用（含外部导入）、非 md 置灰文案、无 md 引导更新；外部 md 发布产物为 `原名 · 第 N 版.md`（publishLessonDraftVersion 按 modification.targetName 分支，版本链/无目标保持课次标题命名），原件不动；整课重做基线与参考预算语义零变化；新增 4 例测试 + v1.6 钉测按 D27 演进；全量 75 files / 337 tests、typecheck、lint 通过 | 修改对象从应用内课件版本放宽到全部 text/markdown managed 文件（D27）；外部 md 发布产物为 `原名 · 第 N 版.md`，原件不动；修改流复用零改动 |
| V17-C md 人工编辑器 | DONE | 阅读器“✎ 编辑/✓ 预览”切换（仅 md + 非只读课次）；零新依赖编辑器（工具栏：加粗/斜体/H1–H3 字号/上下标/列表/引用/表格/分隔线/行内 $…$ 与块级 $$…$$ 公式/18 项 LaTeX 速查/本课插图 ![](名)/撤销重做快照栈/250ms 防抖 localStorage 热保存 + 恢复提示/分屏 KaTeX 预览）；保存走 files:write-version 存为新版本（D29）并留 note_kind='manual_edit' 来源标注（历史版本区展示，不参与 AI note 语义，标注失败不阻塞保存）；新增 12 例测试；全量 75 files / 349 tests、typecheck、lint 通过 | 阅读器编辑/预览切换；零新依赖编辑器（工具栏/行级 LaTeX 公式输入与速查模板/插图本课文件引用/标题字号模板/表格/撤销重做/热保存）；保存存为新版本（D29：版本链第 N+1 版或外部 md 编辑版副本） |
| V17-D 题库自动选题与双版输出 | DONE | 参考题库开关（未安装置灰“先在题库页导入 .tqbank”、目标题数 1–20 默认 5、学生版开关）；过目步（方案阶段串行阶段一 ai.requestText 检索计划容错 + 阶段二 question-bank:search-questions 检索 + 逐题取详情算预算；计划原样展示、逐题剔除、自然语言“调整后重新选题”）；确认生成带 bankPlan+bankQuestionIds（剔除集固化，Main 不再检索）+dualVersion；候选块计入 D25 预算（弹窗列“题库候选 N 道（部分纳入 M 道）”、选择区“题库候选 N 题 · M 字”）；双版收件箱/修改记录教师版/学生版徽标；学生版发布独立版本链 `讲义 · 第 N 版 · 学生版.md`；剔除集空/候选零拒绝；无 bankPlan 行为零变化（钉测）；新增 11 例测试（编排中继 fake bank + fake provider + Renderer 钉测）；全量 76 files / 360 tests、typecheck、lint 通过 | 参考题库开关（未安装置灰）、过目步（AI 检索计划展示/自然语言调整重检索/逐题剔除）、流式选题生成（不得杜撰、教师版含标注与答案区块）、学生版第二次生成与发布命名（D30/D31） |
| V17-E 最终回归与版本验收 | 自动门 DONE / 真实自测待产品负责人 | 全量 76 files / 360 tests、typecheck、lint、production build、diff check 通过；中继式验收（计划容错/候选注入/剔除集直达 prompt/双版编排/编辑保存命名/学生版独立版本链）；隔离 Windows 冒烟（4 进程存活、schema 1–17、notes CHECK 含 manual_edit、search schemaVersion=2、stderr 无错误、进程全终止 + 临时目录清理）；`docs/v1.7-acceptance.md` 已建；DeepSeek 真实自测清单（预估 ≤ ¥3）与最终体验确认交产品负责人，通过后才创建 `checkpoint-V1.7-pass` | 全量测试、typecheck、lint、production build、diff check；中继式验收（计划解析/候选注入/双版编排/编辑保存命名）；隔离 Windows 冒烟；DeepSeek 真实自测（预估 ≤ ¥3）；`docs/v1.7-acceptance.md` |

基线 `checkpoint-V1.6-pass`（已创建）；设计基准 `docs/v1.7-md-editing-and-bank-integration-plan.md`，决策 D27–D32（`implementation-tasks/V1_7_DECISIONS.md`）；按编号顺序执行，同一时刻最多一个 `IN_PROGRESS`；不运行 portable/installer；里程碑提交后 push（产品负责人已授权 GitHub 同步）。

## V1.7.2 已立项（备课工作台结构重排）

基线：V1.7 链 V17-A–V17-E 自动门已过（`checkpoint-V1.7-pass` 待产品负责人真实自测确认）。方案 `docs/v1.7.2-prep-workspace-restructure-plan.md`，决策 D33/D34（`implementation-tasks/V1_7_DECISIONS.md`）；任务链 `implementation-tasks/v1.7.2-tasks/`，按编号顺序执行，同一时刻最多一个 `IN_PROGRESS`；只动 `draft-panel.tsx` 展示层与 `styles.css`，零逻辑/合同/依赖变化；不运行 portable/installer。

| 里程碑 | 状态 | 计划内容 |
|---|---|---|
| V172-A 工作台骨架与左轨 | DONE | draft-panel 重排为 prep-rail（左轨·修改记录时间线+空态文案+脚注）+ prep-main（生成器卡/收起条/成果卡）；范围行 single 目标卡（文件名/字数/当前版/更换展开 radio 收起）/lesson 自动徽标；新 state targetPickerOpen/refPickerOpen/generatorOpen 与规则 1-5（选中自动收起、调整要求展开）；参考行 chips/题库 CSS switch/meter 预算行按方案提前落地（题库参数过渡态暂留行内，V172-B 迁候选区）；删除 prep-ref-panel/prep-work-panel/prep-scope-strip/prep-auto-scope/旧节头/draft-prompt-block；grid 250px、媒体查询 .prep-rail 堆叠；新增 v1.7.2-workspace-structure 7 例 + 演进 5 处钉测；全量 77 files / 369 tests、typecheck、lint 通过 |
| V172-B 参考行与题库迁移 | DONE | 参考行 chips/三入口/题库 switch/预算 meter 已随 V172-A 提前落地；本任务完成剩余两项——new 冷启动两张 prep-add-card 大卡（0 选中大卡 + "已选 0 份"提示/从本课资料选择/题库开关行，有选中切回 chips + 三小入口 + 开关同构）与 PrepBankOptions 唯一实例迁题库候选区头部 prep-bank-controls（行内过渡态删除、prep-bank-toggle/options CSS 退役、count-input 保留）；钉测演进 3 处（新增 2 例、入口钉 2→3、static-render 加载态按真实行为）；全量 83 files / 459 tests、typecheck、lint、production build 通过 |
| V172-C 收起态与空态引导 | DONE | 收起态摘要三模式规则与规则 4-5 已在 V172-A 落地，本任务补钉测防回归（选中→收起/调整要求→展开/取消强制展开）；主区空态分模式文案卡片化（new 先添加依据直接生成/single·lesson 方案先审阅）+ 旧通用文案退役；improve-review-card 核查确认自带独立边框内边距（不叠 workspace-card）；1100px 堆叠走查并入 V172-D 冒烟；v1.7.2 钉测追加 3 例（共 15）；全量 83 files / 462 tests、typecheck、lint、production build 通过 |
| V172-D 最终门禁与验收 | 自动门 DONE / 走查待产品负责人 | 全量 83 files / 462 tests passed（1 skipped）、typecheck、lint、production build、diff check 全绿；隔离 Windows 冒烟 16/16（外部根目录预登记、白名单外部 md 复制进课次、真实 UI 导航进 single 模式、目标卡/参考行/预算行/空态分模式卡片、fake AI 流式生成 + 发布第 1 版 md、选中节点自动收起 + 调整要求重展开、未装题库置灰 + 生成器内无题库参数、视口 1000px 单列堆叠（minWidth 960 → DevTools 仿真）、stderr 无致命、进程全终止 + 临时目录清理）；`docs/v1.7.2-acceptance.md` 已建；产品负责人走查确认后创建 `checkpoint-V1.7.2-pass` |

## V1.7.3 已立项（MD 编辑器公式输入与布局改版）

基线：方案 `docs/v1.7.3-md-editor-formula-ux-plan.md`，决策 D36–D38（`implementation-tasks/V1_7_DECISIONS.md`）；任务链 `implementation-tasks/v1.7.3-tasks/`，按编号顺序执行，同一时刻最多一个 `IN_PROGRESS`；与 V1.7.2 链并行推进、互不阻塞；零新依赖/零 IPC/零 migration；不运行 portable/installer。

| 里程碑 | 状态 | 计划内容 |
|---|---|---|
| V173-A 数学模式引擎与符号条 | DONE | math-input.ts 纯函数引擎（inMathMode $$ token 翻转/最长匹配+词边界/自动分式/三级槽位跳转）+ MATH_SNIPPETS 32 项 + textarea keydown 接线（isComposing 不拦截）+ 数学态符号条双态工具栏；速查面板退役；新增 11 例测试 + v17-c 钉测演进；全量 78 files / 384 tests、typecheck、lint 通过 |
| V173-B 斜杠命令与公式快捷键 | DONE | 空行 / 与中文顿号、触发拼音过滤菜单（↑↓/Enter/Esc/blur 全支持、光标行跟随查询、\u0000 占位符剥除落槽位）+ Ctrl+M / Ctrl+Shift+M 共用 insertTemplate；v1.7.3 测试追加 3 例（共 14 例）、typecheck、lint 通过 |
| V173-C 布局方案 A | DONE | ✎/◫/👁 三视图（按文件记忆）+ 0.25–0.80 可拖分栏 + 行比例单向同步滚动 |
| V173-D 预览管线 | DONE | MathSpan 公式 LRU 缓存（300 条）+ KaTeX 错误红色降级 + 预览 120ms 防抖 |
| V173-E 最终门禁与验收 | 自动门 DONE / 走查待产品负责人 | 全量测试、typecheck、lint、production build、diff check；隔离 Windows 冒烟（方案 §9 走查 1–8）；`docs/v1.7.3-acceptance.md`；产品负责人确认后创建 `checkpoint-V1.7.3-pass` |

## V1.8 已立项（课后反馈常规化）

基线：V1.7 / V1.7.2 / V1.7.3 自动门均已通过（走查确认与 `checkpoint-*-pass` 待产品负责人，互不阻塞 V1.8）。方案 `docs/v1.8-lesson-feedback-plan.md`，决策 D39–D45（`implementation-tasks/V1_8_DECISIONS.md`）；任务链 `implementation-tasks/v1.8-tasks/`，按编号顺序执行，同一时刻最多一个 `IN_PROGRESS`；零 migration、零新依赖；新 IPC 仅 `feedback:read-transcript` / `feedback:generate` 两条；不运行 portable/installer；里程碑提交后 push（沿用 GitHub 授权）。

| 里程碑 | 状态 | 计划内容 |
|---|---|---|
| V18-A 反馈合同与 Main 服务 | DONE | feedback-contracts（常量/四接口/守卫）、`feedback:read-transcript`（选 .txt/.md 读文本不登记 files，30k 头截 + truncated，取消返回 null）、`feedback:generate`（skill prompt 或默认三段 FEEDBACK_PROMPT_VERSION + 学生/课程/课次/反馈日期上下文 → 非流式草稿不落库；反馈日期 = scheduled_at 本地日期 ?? 当天）；NoteRecord.aiMetadata 双轨合同（DraftNoteMetadata | FeedbackNoteMetadata）与 core-data mapNote/draft-scope/draft-view-model/draft-panel/draft-service 收窄；ipc-security 未锁通道清单、三新测试文件 18 例 + 4 处钉测演进；全量 82 files / 414 tests passed（1 skipped）、typecheck、lint 通过 |
| V18-B 确认已上内嵌反馈与可见性 | DONE | confirm-lesson-taught-modal 重做完成（内嵌 LessonFeedbackSection + 主按钮软强制 gating + 跳过原因单选/红色二次确认 + upsert 编辑态预填最新一条 + 保存编排 createNote/updateNote→confirmLessonTaught + occurredOn=scheduledAt 本地日期 + 无学生退化纯确认）；lessonFeedbackStatus 派生（taught/complete/每生 hasFeedback+latestNote，deleted/draft 类不计）；课次行已反馈绿/缺反馈黄徽标（仅已上且有在读学生）；Viewed Lesson 黄条+补写入口/摘要行（首行 40 字+已挂到×××名下）；lesson-feedback-modal 补写弹窗（共享反馈区、无 Current Lesson/确认按钮）；styles.css 反馈区样式；新增 v1.8-feedback-ui 18 例；全量 83 files / 432 tests passed（1 skipped）、typecheck、lint、production build 通过 |
| V18-C 班课反馈与转写转反馈 | DONE | LessonFeedbackSection 班课折叠列表完成（attendance.getLesson 到课/请假/缺席徽标、未点名不显示；待写/已写✓；请假/缺席虚线"可跳过"可写可跳；N/M 已写徽章分母=到课学生）；确认弹窗班课 gating=≥1 到课学生有内容、首次点击 missing-inline 黄条点名、再次点击按已写保存未写跳过、请假学生填写也保存；rec-flow 折叠块（路径 A 选 .txt/.md → read-transcript → 自动 generate → 草稿落 textarea + 文件 chip/字数/截断提示 + 两段进度 + 取消令牌防迟到回写；路径 B 纯录音置灰"未配置语音模型·后续版本"）；反馈 Skill select（全部 active Skill + 不使用 Skill（默认结构），仅影响下一次 generate）；草稿来源标签"AI 草稿·请人工修改"→"已人工修改 ✓"（绿）、生成中该生 textarea 与主按钮禁用；CreateNoteRequest 追加可选 aiMetadata（FeedbackNoteMetadata，core-ipc 透传 → core-data 落 ai_metadata_json；手写不写）+ create-note 往返钉测；v1.8-feedback-ui 追加 11 例（共 29）；全量 83 files / 444 tests passed（1 skipped）、typecheck、lint、production build、diff check 通过 |
| V18-D 最终门禁与验收 | DONE | 全量 83 files / 444 tests passed（1 skipped）、typecheck、lint、production build、diff check 通过；隔离 Windows 冒烟 16/16（一对一 保存含 aiMetadata→确认→occurredOn=排课日期、跳过→缺反馈→补写→绿、upsert 不重复建行、班课 3 学生 1 请假 每人一条、徽标/黄条派生、generate 不登记 files、学生时间线 occurredOn 降序、fake provider 收到三段提示词+学生上下文、stderr 无致命、进程全终止+临时目录清理）；`docs/v1.8-acceptance.md`；**2026-09-07 产品负责人走查最终确认通过，`checkpoint-V1.8-pass` 已创建于最终确认提交** |

**V1.8 已冻结在 `checkpoint-V1.8-pass`（基线 `checkpoint-V1.5.6-pass` 之后链上 V1.7/V1.7.2/V1.7.3 自动门亦过、其 pass 标签待各自走查确认）。**


## V1.8.1 已立项（课件区讲义/材料分组方案 A + 设为讲义底稿）

基线：V1.8 自动门已过（**2026-09-07 产品负责人走查最终确认通过，已冻结在 `checkpoint-V1.8-pass`**）。方案 `docs/v1.8.1-courseware-lecture-material-split-plan.md`，决策 D46/D47（`implementation-tasks/V1_8_DECISIONS.md`）；任务链 `implementation-tasks/v1.8.1-tasks/`；零 migration、零新依赖，新 IPC 仅 `files:set-lesson-role` 一条；不运行 portable/installer。

| 里程碑 | 状态 | 计划内容 |
|---|---|---|
| V181-A 分组与树渲染 | DONE | splitLessonFilesByRole 纯函数（版本链/学生版/编辑版→讲义组；其余→材料组）+ LessonMaterialTree grouped 可选 prop 分组渲染（讲义组在前）+ 当前徽标/来源标签（lessonFileSourceLabel 首次进课件区树）+ 空态引导 + role-group CSS；lesson-prep-context +3 例、v1.8.1-courseware-groups 新 5 例；相关测试 + typecheck + lint 通过 |
| V181-B 设为讲义底稿 | DONE | ManagedFileService.setLessonFileRole（同基名 MAX+1 出 `基名 · 第 N 版.md` 副本，临时文件+原子重命名，原件不动；非 md/已讲义命名/未挂课次/空内容/超限拒绝）+ files:set-lesson-role IPC（enqueueIndex + notifyContentChanged）+ preload + reader「↥ 设为讲义底稿」入口 + section handler；service +3 例、ipc +1 例；相关测试 + typecheck + lint 通过 |
| V181-C 最终门禁与验收 | 自动门 DONE / 走查待产品负责人 | 全量 83 files / 457 tests passed（1 skipped）、typecheck、lint、production build、diff check 全绿；`docs/v1.8.1-acceptance.md`；产品负责人走查确认后创建 `checkpoint-V1.8.1-pass` |

## V1.9 已立项（教学界面信息密度收口 + 课件导出可打印 PDF）

基线：V1.8.1 自动门已过（走查确认与 `checkpoint-V1.8.1-pass` 待产品负责人，互不阻塞 V1.9）；**V1.8 已于 2026-09-07 走查确认冻结在 `checkpoint-V1.8-pass`**。2026-09-07 范围扩容：产品负责人三轮界面评审（备课工作台 / 课件区 / 课程页 / 编辑器评估）拍板 UI 重做并入 V1.9。**双设计基准**：`docs/v1.9-teaching-ui-restructure-plan.md`（UI，V19-A/B/C，实施在先）+ `docs/v1.9-pdf-export-plan.md`（导出，V19-D/E/F，原 A/B/C 经 git mv 重排）；决策 D48–D60（`implementation-tasks/V1_9_DECISIONS.md`）。任务链 `implementation-tasks/v1.9-tasks/`，实施顺序 V19-A → B → C → D → E → F，同一时刻最多一个 `IN_PROGRESS`；V19-F 为唯一全量验收点（验收文档 `docs/v1.9-acceptance.md`）。UI 节点零 migration / 零新 IPC / 零新依赖（纯 Renderer 重排，prepMode 与生成合同字段保留仅 UI 收敛）；导出节点零 migration、零新依赖、零 AI 调用，新 IPC 仅 `export:print-to-pdf` / `export:get-print-payload` / `export:print-ready` 三条（载荷通道带 sender 校验）；PDF 不登记 files 表、不进索引/备份；不运行 portable/installer；实施待产品负责人完成 V1.8.1 走查确认后开始。

| 里程碑 | 状态 | 计划内容 |
|---|---|---|
| V19-A 备课工作台对话式重做 | DONE | 对话栏（依据区 + 对 AI说 + 发送；课次有 md 自动挂当前讲义、空课次从零生成、"整个课件包"入依据区）+ 主舞台单一舞台同卡替换（方案/生成中流式/成果/对比，不编号不步骤链）+ 题库候选与确认并入方案态 + 修改记录默认收起为「🕘 修改记录 N」浮层（Drawer 视觉模式）+ MdEditor 受控用法（initialBody/onSaveBody，note 热保存独立命名空间）；在 V1.7.2 已落地结构之上重排（prep-rail→浮层、mode-bar 撤除、prep-add-card 沿用、钉测演进）；prepMode/合同/流式/预算（D25）语义零变化（D55/D56/D59）。2026-09-07 完成：页面头+grid minmax(0,1fr) 302px、对话栏 radio 映射 selectChatScope、主舞台四态 prep-stage 同卡替换、题库候选就地方案态、修改记录 Drawer 浮层、成果 ⋯ 菜单（删除草稿红区）、MdEditor 双用法（文件用法零变化+note 热保存键 md-editor-draft:note:\<id\>）、预算一行小字红态；新增 v1.9-prep-dialogue 16 例 + 演进 6 处既有钉测；全量 84 files / 476 tests（1 skipped）、typecheck、lint 全绿 |
| V19-B 课件区双头合并与操作收纳 | DONE | app-menu.tsx 共用 ⋯ 菜单（分组小标题/危险项红区/点击外部与 Esc 关闭）+ 课件区三层头部并为单条工具行（课次标题 + 文件信息胶囊 ｜ 三主键 ✦修改这份/✎编辑/⬇导出PDF占位 + 沉浸 + ⋯）+ 阅读器头部操作行退役 + 导出 props 占位（V19-E 接线）+ app.css 工具行/菜单/窄窗堆叠；可见按钮 11+ → 5；V1.8.1 分组树/提讲义/阅读/题图语义零变化（D57）。2026-09-07 完成：app-menu.tsx 共用⋯菜单（分组/红区/外点Esc关）、lesson-files-section 单工具行（标题+胶囊｜修改这份/编辑/导出占位/沉浸/⋯）、reader 头部退役+编辑态受控、MinerU/移除/提讲义入菜单；新增 v1.9-courseware-toolbar 9 例 + 演进 6 处钉测；全量 85 files / 485 tests（1 skip 既有）、typecheck、lint、build 全绿 |
| V19-C 课程页当前课次行动头 | DONE | 撤 course-dashboard 统计条 + course-detail 头改当前课次行动卡（crumb + 大字当前课次 + chips 🕘排课/👤学员/📘讲义N/📎材料N/上节反馈✓ 全部 overview 派生 + 行动键 进入教学内容 primary/点名/确认本课已上/⋯）+ 非当前课次主角切换 + 已结束仅查看 + 共用菜单复用；今日点名/课次表/V1.8 反馈链零变化（D58）。2026-09-08 完成：course-page-header 统计条退役（未选课程最小页头 course-minimal-head）+ lesson-hero-card 行动卡（crumb/大字 Current·已上·已结束徽标/chips 五项含上节反馈 previousTaughtLesson 派生/行动键三 + ⋯ AppMenuButton 三分组红区底）+ hero=viewedLesson??currentLesson 主角切换 + 讲义/材料计数走既有 files:get-overview+splitLessonFilesByRole（零新 IPC）+ endCourse/reopenCourse 自名片原样搬迁；新增 v1.9-course-hero-card 7 例 + 演进 v1.2-course-ui 2 处；全量 86 files / 492 tests（1 skip 既有）、typecheck、lint、build 全绿 |
| V19-D 导出合同与 Main 服务 | DONE | export-contracts（常量/接口/守卫）+ 三条 `export:*` IPC（载荷通道 sender 校验、print-ready 仅一次）+ ExportService（校验/载荷组装不信任 Renderer 内容/隐藏打印窗编排/printToPDF A4 版式参数/60s 超时与 crash 清理/另存为对话框 + 临时文件原子重命名 + showItemInFolder，响应不含路径）+ index.ts 接线；service/ipc/contracts 三组测试（编排用注入 fake 窗口端口与 fake printToPDF） |。2026-09-08 完成：export-contracts 5 例 + export-service 9 例（fake 端口全覆盖：成功原子重命名/取消/占用清理/超时/BUSY/sender 校验/ready 单次/课次隔离/模板转义）+ export-ipc 6 例（白名单/冒充拒绝/错误映射）；全量 90 files / 512 tests（1 skip 既有）、typecheck、lint 全绿 |
| V19-E 打印视图与课件区入口 | DONE | main.tsx `?print=1` 分支 + PrintDocumentView（复用 MarkdownDocument 所见即所得 + fonts/imgs 就绪协议）+ print-document.css A4 版式（11pt/防断裂/白底黑字）+ 课件区工具行三主键位「⬇ 导出 PDF」接线（V19-B 占位转真实渲染，仅 md、busy 禁用态、提示分支）+ headerText = 学生名 · 课次标题；v1.9-export-ui 静态钉测 。2026-09-08 完成：main.tsx ?print=1 分支 + PrintDocumentView（载荷→MarkdownDocument→fonts/imgs 就绪→printReady）+ print-document.css A4 版式 + 课件区导出按钮接线（md 门/busy 文案/结果分支/headerText 一对一学生名·课次标题 100 字截断/只读分支导出+⋯）；新增 v1.9-export-ui 7 例 + 演进占位钉测 1 处；全量 91 files / 519 tests（1 skip 既有）、typecheck、lint 全绿 |
| V19-F 最终门禁与验收（全工作流） | DONE | 全量测试、typecheck、lint、production build、diff check 全绿；隔离 Windows 冒烟 21/21（UI 走查：行动卡/chips/⋯ 红区、直达课件区工具行、备课工作台对话式 + single 自动挂载、fake AI 对话流端到端 要求→方案同卡→确认→流式→成果、MdEditor 编辑态、修改记录浮层、1000px 堆叠、快速建课回归抽查；导出走查：导出按钮 md 门 + title、Main 二次校验两条稳定拒绝、`?print=1` 真实渲染 PrintDocumentView、sender 校验拒冒充、stderr 健康检查）；进程/临时目录双复核通过；冒烟发现并修复 chips 计数停更缺陷（importToLesson 无 contentChanged → course-detail overviewRevision 兜底 + 钉测）；自动化边界如实记录（保存对话框模态→注入测试 20 例 + 人工走查；CDP Page.printToPDF 未实现→注入测试同参钉测 + 人工走查）；`docs/v1.9-acceptance.md` 已建；`checkpoint-V1.9-pass` 待产品负责人双清单走查确认（与 V1.8.1 标签同批，互不阻塞） |
