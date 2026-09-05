# V18-A · 反馈合同、IPC 与 Main 服务

**状态：** `TODO`

方案基准：`docs/v1.8-lesson-feedback-plan.md` §2（D39/D40/D43/D44 数据与合同部分）、§3、§4。前置：无（V1.8 首任务）。

## 范围

- `src/shared/feedback-contracts.ts` 新建：常量（`FEEDBACK_TRANSCRIPT_MAX_CHARS=30000`、`FEEDBACK_MAX_TOKENS=1500`、`FEEDBACK_PROMPT_VERSION='v18-01-v1'`、`FEEDBACK_BODY_MAX_CHARS=8000`）与 `TranscriptResult` / `GenerateFeedbackRequest` / `GeneratedFeedback` / `FeedbackNoteMetadata` 及全部守卫（§4.2 逐字段）；
- `src/shared/ipc-contracts.ts` / `preload-api.ts`：接入 `feedback:read-transcript`（空请求 → TranscriptResult | null）与 `feedback:generate`（GenerateFeedbackRequest → GeneratedFeedback）两条通道（preload `feedback` 命名空间）；
- `src/main/feedback/feedback-service.ts` 新建：`readTranscript`（dialog.showOpenDialog filters txt/md → UTF-8 读 → 头截 + truncated；不写 files 表/不复制/不索引/正文不进日志）；`generate`（校验 lesson/student → skill.prompt 或内置默认三段提示词（FEEDBACK_PROMPT_VERSION 固定版本）+ 学生/课程/课次/反馈日期上下文 + 转写文本 → `aiGateway.requestText` 非流式 → 返回草稿不落库；requestId 支持取消，复用 AiGateway AbortController 模式）；
- `src/main/ipc/feedback-ipc.ts` 新建 + `src/main/index.ts` 装配（依赖注入模式沿用 file-ipc/draft-ipc）；
- `src/shared/core-contracts.ts`：`isNoteRecord` 的 aiMetadata 校验兼容 `FeedbackNoteMetadata`（hasOnlyKeys 演进，不破坏 DraftNoteMetadata 既有形状）；
- 测试：`feedback-contracts.test.ts`（守卫正反例）、`feedback-service.test.ts`（fake gateway：skill prompt 注入、默认结构、上下文注入、截断、AI 错误透传、**notes 表无行断言**）、`feedback-ipc.test.ts`（白名单/守卫拒绝/read-transcript 不写 files 表，fake dialog）；受影响既有钉测演进（先 `grep -rn "ipc-contracts\|CHANNELS" tests/ipc-security.test.ts` 定位通道清单断言并追加两条）。

## 不做

- 任何 Renderer/UI（V18-B）；confirm/createNote 调用编排（V18-B）；既有三条 V1.7 IPC 之外的新通道；migration。

## 验收

- 三个新测试文件全绿 + 既有全量 `npm test`、typecheck、lint 通过；
- 更新 STATUS/GOAL_PROGRESS；提交 `v1.8(V18-A): feedback contracts, ipc and main service`。
