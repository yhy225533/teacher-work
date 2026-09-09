# V1.10 决策记录（备课状态保持 + 资料移除可达性 + 生成类型并排）

产品负责人 2026-09-09 确认五项反馈分析后立项 V1.10（范围：问题 1/4/5；问题 2 定位为中转站限流不动应用侧；问题 3 Office/PDF 渲染另立后续，调研结论记录在 `docs/v1.10-walkthrough-fixes-plan.md` §8）。设计基准 `docs/v1.10-walkthrough-fixes-plan.md`。决策点 D61–D64 按推荐冻结。

> V1.10 四节点完成后、走查确认前，产品负责人于 2026-09-09 报告移除资料时连出两条 error 日志并授权修复（"修复一下吧，放在版本补丁里"）；按 V1.5.3.1 先例记为 V1.10 最终验收前维护增量 **V1.10.1**（D65），验收并入 `docs/v1.10-acceptance.md`，不单独创建 pass 标签。

## D61 · 问题 5 修复 = picker 往返渲染保活（不卸载教学内容页），不持久化状态

- App.tsx 渲染结构调整：「＋ 外部资料 / ＋ 素材库」打开 picker 时，教学内容页保持挂载（其条件渲染分支不被 activeItem 切换卸载），picker 面板以另一渲染位呈现，`returnToPrep` 收起后 DraftPanel 局部状态（勾选/要求/模式/流式）原样保留；
- 侧边栏直接切页（真实离开备课）仍卸载——语义不变：主动离开不承诺状态保留；
- 附带 Main 小修：`copyToLesson` / `importToLesson` 在 `enqueueIndex` 后补发既有 `notifyContentChanged` 广播（draft-panel 的 files 刷新靠该事件感知"选文件回来了带了新文件"；V19-F 在 CourseDetail 加的 overviewRevision 兜底重拉保留不删——双保险）；
- 非采纳方向：状态上提 App（跨页全局 store）、DB/localStorage 持久化（均为过度设计）。

## D62 · 问题 1 修复 = 三层移除入口，全部走既有 softDeleteFile，零新 IPC

- 树节点 hover ✕：非 readOnly、非"当前讲义当前版"的文件行显示；点击弹同款确认（"外部/素材库原件不受影响"），确认后 softDeleteFile；当前讲义当前版不显示 ✕（唯一正文只保留 ⋯ 入口，防误删）；
- 批量管理：树标题「管理」toggle → 多选 checkbox（复用 selectedFileIds 通道）→ 底部「移除所选 (N)」+ 一次确认列文件名清单 → 串行 softDeleteFile → 「完成」退出；
- 历史版本：折叠块每行 ✕（历史版本均为 managed 副本，删除不涉及外部原件）；"当前版"不在历史块内，天然受保护；
- readOnly 课程不出任何移除入口（含管理 toggle）；
- 非采纳方向：回收站/恢复 UI（软删行在 DB 留底，恢复入口是另一话题）、批量 Main 通道（循环单份 IPC 足够，N 小）。

## D63 · 问题 4 修复 = 生成类型恢复三按钮并排，合同零改动

- `prepMode === 'new'`：撤除「生成类型」单选下拉，恢复 V1.2 形态三个并排按钮（讲义 primary / 例题 / 作业 secondary），点哪个以该 kind 直发 `generate(kind)`；
- 生成中三按钮全禁用、所点按钮「生成中…」；完成后可立即点下一个（连续生成各自独立 note，V1.2/V1.5 既有行为）；
- single/lesson 模式（改这份讲义 / 整课重做）不变：仍走「✦ 发送」→ 方案确认流；
- `drafts.generate` 合同（kind 单值）与 Main 生成服务零改动；
- 非采纳方向：kind 多选合同（改 shared 合同 + Main 服务，收益不抵风险）；"一键全生成"（隐藏了"三样是三个独立产物"的心智模型）。

## D64 · V1.10 约束与边界

- 零 migration、零新依赖、零新 IPC 通道（D61 的 contentChanged 为既有广播补发）；
- 不重做 V1.1–V1.9 任何冻结语义（softDeleteFile/writeVersion/setLessonFileRole/V19-A 对话式布局/D29 编辑副本语义均不动）；
- 问题 2（429）应用侧不改（定位为中转站限流）；问题 3 记 V1.11 候选（`docs/v1.10-walkthrough-fixes-plan.md` §8，含三类文件分层与 MinerU/officeparser 文本线接通的先行建议）；
- 不运行 portable/installer；`checkpoint-V1.10-pass` 待产品负责人按 `docs/v1.10-acceptance.md` 走查确认后创建，与既有 pass 标签互不替代。

## D65 · V1.10.1（维护增量）：移除资料选中重置竞态 = Renderer 侧顺序修复，先 reload 再按需清选中

- 走查现象：移除资料瞬间连出两条 error 日志（`ipc.file_request_failed` files:read-content "文件已删除，请先恢复。" + `ipc.mineru_request_failed` mineru:get-status "文件不存在或已删除。"，同一渲染帧），主进程守卫按设计工作、UI 随后自愈，但正常操作路径被染红、阅读器闪错误文案；
- 根因：单份 `removeFile` / 批量 `removeSelectedFiles` 旧序「先 `setSelectedFileId('')`、后 `await reload()`」——清选中渲染瞬间列表仍为旧值，`LessonMaterialReader` 自动重选（choosePreferredFile）把刚软删文件重新选中，连发两条注定失败的 IPC；
- 修复：两处调用点改为「软删 → **先 `await reload()`** → 函数式按需清选中」（`(current) => current === fileId ? '' : current` / `(current) => manageSelectedIds.includes(current) ? '' : current`）——列表先落新值，自动重选只会命中有效文件；函数式更新保证 await 期间用户改选不被旧闭包覆盖；
- 明确不动：阅读器自动重选逻辑、主进程守卫与 IPC 面（零 migration / 零新依赖 / 零新通道）、D62 三层入口结构；`softDeleteFile` 不补发 `contentChanged`（D61 广播面仅覆盖导入路径，删除路径由调用方 reload 收口）；
- 验收并入 V1.10 走查（`docs/v1.10-acceptance.md` 追加 V1.10.1 证据小节），不创建 `checkpoint-V1.10.1-pass`；冒烟关注点 = 移除场景 stderr 零 `file_request_failed` / `mineru_request_failed`；
- 非采纳方向：阅读器侧吞掉"已删除"错误（掩盖真实守卫语义，竞态仍在）；`softDeleteFile` 补发广播重排时序（改 D61 冻结面，且广播与本地清选中的相对顺序仍不可控）。
