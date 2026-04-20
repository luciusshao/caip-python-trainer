# 通用考试模拟模块 技术架构设计

> 目标：将现有 `PracticePane / CodePane / AIChatPanel` 从 CAIP 强耦合状态解耦，抽象为**考试无关（exam-agnostic）**的通用引擎，支持通过 JSON 题库热插拔不同认证（CAIP / AWS ML / Azure AI-102 / TensorFlow Developer 等）。

---

## 目录

- [1. 设计目标](#1-设计目标)
- [2. 整体架构](#2-整体架构)
- [3. 数据层：JSON Schema](#3-数据层json-schema)
- [4. 执行层：Pyodide 沙箱](#4-执行层pyodide-沙箱)
- [5. AI 层：Tutor 中间件](#5-ai-层tutor-中间件)
- [6. 推荐目录结构](#6-推荐目录结构)
- [7. 扩展新考试的三步清单](#7-扩展新考试的三步清单)
- [8. 后续演进方向](#8-后续演进方向)

---

## 1. 设计目标

| 目标 | 说明 |
| --- | --- |
| 题库与代码解耦 | 新增考试 = 新增 JSON 目录，**零代码改动** |
| 前端执行 | Python 在浏览器 Pyodide 沙箱中跑，服务器 0 算力成本 |
| AI 苏格拉底式引导 | Tutor 只提示不直答，保障学习效果 |
| 多语言可扩展 | 当前 Python，预留 SQL / JS / Shell 扩展位 |
| 流式体验 | AI 回复与代码执行结果均支持流式输出 |

---

## 2. 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                     src/app/[examId]/practice                │
│                    （动态路由：一个路由跑所有考试）          │
└──────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│ Content & Meta │   │ Interactive    │   │ AI Tutor Brain │
│   Layer        │   │ Engine         │   │  (Middleware)  │
│                │   │                │   │                │
│ - meta.json    │   │ - Pyodide      │   │ - /api/tutor   │
│ - questions    │   │   Web Worker   │   │ - Socratic     │
│   .json        │   │ - Monaco       │   │   Prompt       │
│ - loader       │   │ - Grader       │   │ - Streaming    │
└────────────────┘   └────────────────┘   └────────────────┘
```

**三层职责**：

1. **Content & Meta Layer**：负责题库加载与校验，与 UI 完全解耦
2. **Interactive Engine**：Monaco 编辑器 + Pyodide 执行 + 判题器，纯前端
3. **AI Tutor Brain**：Next.js API Route，封装大模型调用 + Prompt 组装

---

## 3. 数据层：JSON Schema

### 3.1 ExamProfile（考试元数据）

每个考试一份 `meta.json`：

```typescript
// src/core/types.ts
export interface ExamProfile {
  /** 全局唯一 id，用作路由 segment */
  id: string;                        // e.g. "aws-ml-specialty"
  title: string;                     // e.g. "AWS ML Specialty"
  provider: string;                  // e.g. "Amazon"
  version: string;                   // e.g. "MLS-C01"
  /** 通过分数（百分比） */
  passScore: number;                 // e.g. 75
  /** 考试知识域（用于分章节练习） */
  domains: ExamDomain[];
  /** 默认执行环境 */
  runtime: RuntimeProfile;
}

export interface ExamDomain {
  id: string;                        // e.g. "data-engineering"
  title: string;
  weight: number;                    // 0~1，用于加权评分
}

export interface RuntimeProfile {
  language: "python" | "sql" | "javascript";
  version?: string;                  // e.g. "3.11"
  preloadPackages?: string[];        // Pyodide 预装包，e.g. ["numpy", "pandas"]
}
```

### 3.2 PracticeItem（练习题）

每道题一条记录，统一结构：

```typescript
export interface PracticeItem {
  id: string;
  examId: string;
  domainId: string;

  content: {
    scenario: string;                // 业务背景（Markdown）
    task: string;                    // 明确的任务描述
    difficulty: "easy" | "medium" | "hard";
    tags?: string[];
  };

  workspace: {
    language: "python" | "sql" | "javascript";
    /** 编辑器中预填的代码模板 */
    initialCode: string;
    /** 隐藏前置代码：数据准备、import 等（用户不可见） */
    hiddenPreCode?: string;
    /** 隐藏后置代码：断言、evaluator 等（用户不可见） */
    hiddenPostCode?: string;
    /** 超时（毫秒） */
    timeoutMs?: number;              // default 5000
  };

  solution: {
    correctCode: string;             // 参考答案
    explanation: string;             // 解题思路（Markdown）
    /** 喂给 Tutor 的指令，非用户可见 */
    tutorDirectives: {
      hints: string[];               // 分级提示，从浅到深
      commonMistakes: string[];      // 常见错误清单
      keyConcepts: string[];         // 核心知识点
    };
  };
}
```

### 3.3 Loader

```typescript
// src/core/content/loader.ts
export async function loadExam(examId: string): Promise<{
  profile: ExamProfile;
  items: PracticeItem[];
}> {
  const profile = await import(`@/content/${examId}/meta.json`);
  const items   = await import(`@/content/${examId}/questions.json`);
  // 运行时校验（建议用 zod）
  return { profile: profile.default, items: items.default };
}
```

---

## 4. 执行层：Pyodide 沙箱

### 4.1 为什么选 Pyodide

- **0 服务器成本**：Python 完整跑在 WebAssembly
- **安全隔离**：天然沙箱，无需容器化 / 资源限制
- **离线可用**：首次加载后 Service Worker 缓存

### 4.2 执行流程

```
┌──────────┐    postMessage    ┌─────────────────────────┐
│  主线程  │ ─────────────────▶│ Pyodide Web Worker      │
│ (React)  │   {code, pre,     │                         │
│          │    post, timeout} │ 1. init pyodide         │
│          │                   │ 2. load packages        │
│          │◀──────────────────│ 3. exec:                │
│          │    {stdout,       │    preCode \n           │
│          │     stderr,       │    userCode \n          │
│          │     passed,       │    postCode             │
│          │     durationMs}   │ 4. capture io           │
└──────────┘                   │ 5. 判断 postCode 是否    │
                               │    抛断言错误            │
                               └─────────────────────────┘
```

### 4.3 Worker 骨架（伪代码）

```typescript
// src/core/engine/worker/pyodide.worker.ts
import { loadPyodide } from "pyodide";

let pyodide: any;

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  if (!pyodide) {
    pyodide = await loadPyodide();
    await pyodide.loadPackage(e.data.preloadPackages ?? []);
  }

  const { hiddenPreCode = "", userCode, hiddenPostCode = "" } = e.data;

  // 重定向 stdout/stderr
  const stdout: string[] = [];
  const stderr: string[] = [];
  pyodide.setStdout({ batched: (s: string) => stdout.push(s) });
  pyodide.setStderr({ batched: (s: string) => stderr.push(s) });

  const source = [hiddenPreCode, userCode, hiddenPostCode].join("\n");
  const start = performance.now();

  let passed = true;
  let error: string | null = null;

  try {
    await pyodide.runPythonAsync(source);
  } catch (err: any) {
    passed = false;
    error = String(err);
  }

  self.postMessage({
    stdout: stdout.join(""),
    stderr: stderr.join(""),
    passed,
    error,
    durationMs: performance.now() - start,
  });
};
```

### 4.4 判题协议

- `hiddenPostCode` 中使用 `assert` 或自定义 `raise AssertionError("...")`
- Worker 抛错即视为未通过，错误信息回传给 Tutor 用于针对性辅导
- 通过 = `passed === true` 且 `stderr` 不含异常

### 4.5 超时处理

主线程 `setTimeout` 触发 `worker.terminate()`，重新启动一个干净 Worker 实例。

---

## 5. AI 层：Tutor 中间件

### 5.1 路由定位

```
POST /api/tutor
```

### 5.2 请求结构

```typescript
interface TutorRequest {
  itemId: string;                    // PracticeItem.id
  userCode: string;                  // 当前代码
  executionResult?: {
    stdout: string;
    stderr: string;
    passed: boolean;
    error?: string;
  };
  chatHistory: { role: "user" | "assistant"; content: string }[];
  userQuestion: string;              // 本轮用户输入
}
```

### 5.3 Prompt 骨架（苏格拉底式）

```typescript
// src/core/ai/prompt.ts
export function buildTutorPrompt(ctx: TutorContext): Message[] {
  const { item, userCode, execResult, history, userQuestion } = ctx;

  const system = `
You are a Socratic coding tutor for the ${item.examId} exam.

STRICT RULES:
1. NEVER write full solution code. Give at most 1-2 lines of pseudo-code.
2. Ask guiding questions first; only reveal hints when the student is stuck.
3. Use the hint ladder in order: ${item.solution.tutorDirectives.hints.join(" → ")}
4. Cross-check against common mistakes: ${item.solution.tutorDirectives.commonMistakes.join("; ")}
5. Reinforce these key concepts: ${item.solution.tutorDirectives.keyConcepts.join(", ")}

TASK CONTEXT:
${item.content.scenario}

TASK:
${item.content.task}
`.trim();

  const contextBlock = `
[Current User Code]
\`\`\`${item.workspace.language}
${userCode}
\`\`\`

[Last Execution]
passed=${execResult?.passed ?? "N/A"}
stderr=${execResult?.stderr ?? ""}
error=${execResult?.error ?? ""}
`.trim();

  return [
    { role: "system", content: system },
    { role: "system", content: contextBlock },
    ...history,
    { role: "user", content: userQuestion },
  ];
}
```

### 5.4 流式响应

- 使用 Next.js `Response` + `ReadableStream`
- 前端通过 `fetch` + `reader.read()` 或 Vercel AI SDK 消费
- 保持与现有 `AIChatPanel.tsx` 的消息协议兼容

### 5.5 多 Provider 支持

```typescript
// src/core/ai/provider.ts
export interface LLMProvider {
  chat(messages: Message[], opts: ChatOpts): AsyncIterable<string>;
}

export const providers = {
  deepseek: new DeepSeekProvider(),
  qwen:     new QwenProvider(),
  openai:   new OpenAIProvider(),
};

// 通过环境变量切换：TUTOR_PROVIDER=deepseek
```

---

## 6. 推荐目录结构

```
src/
├── app/
│   ├── [examId]/
│   │   └── practice/
│   │       └── page.tsx              # 动态路由入口
│   └── api/
│       └── tutor/
│           └── route.ts              # AI Tutor 流式接口
│
├── core/                             # 【考试无关】核心引擎
│   ├── types.ts                      # ExamProfile / PracticeItem 类型
│   ├── content/
│   │   ├── loader.ts                 # 题库加载 + zod 校验
│   │   └── schema.ts
│   ├── engine/
│   │   ├── runner.ts                 # 主线程调用 Worker 的封装
│   │   ├── grader.ts                 # 判题结果解析
│   │   └── worker/
│   │       └── pyodide.worker.ts
│   ├── ai/
│   │   ├── prompt.ts                 # Prompt 组装
│   │   ├── provider.ts               # 多 LLM Provider 抽象
│   │   └── stream.ts                 # SSE / ReadableStream 工具
│   └── store/
│       └── practiceStore.ts          # Zustand：当前题/代码/执行结果/对话
│
├── modules/                          # 【UI 组件】可被任意 examId 复用
│   ├── PracticePane/
│   ├── CodePane/
│   └── AIChatPanel/
│
└── content/                          # 【题库】每个考试一个目录
    ├── caip/
    │   ├── meta.json
    │   └── questions.json
    ├── aws-ml-specialty/
    │   ├── meta.json
    │   └── questions.json
    └── tensorflow-developer/
        ├── meta.json
        └── questions.json
```

**关键解耦点**：

- `core/` 与 `modules/` 不 import 任何 `content/` 具体文件
- `content/` 只被 `core/content/loader.ts` 按 `examId` 动态加载
- `modules/` 只通过 `core/store` 读写状态，不感知考试种类

---

## 7. 扩展新考试的三步清单

假设要新增 **Azure AI-102**：

1. **创建题库目录**
   ```
   src/content/azure-ai-102/
   ├── meta.json          # 填 ExamProfile
   └── questions.json     # 填 PracticeItem[]
   ```

2. **（可选）批量生成题目**
   - 收集官方 Skills Outline + 选择题题库
   - 用 LLM 按 `PracticeItem` Schema 转化为"代码实操题"
   - 本地跑一次 zod 校验 + Pyodide 执行验证 `correctCode` 能通过 `hiddenPostCode`

3. **访问路由**
   ```
   /azure-ai-102/practice
   ```
   无需任何代码改动，页面自动渲染。

---

## 8. 后续演进方向

| 方向 | 描述 |
| --- | --- |
| 用户进度持久化 | Prisma 新增 `ExamAttempt / ItemAttempt` 表，按 `examId + userId` 聚合 |
| 自适应出题 | 基于错题与 domain 权重动态排序下一题 |
| 多语言运行时 | SQL 用 sql.js、JS 直接 eval 到 iframe、Shell 用 WebContainer |
| 认证模拟考 | 按 `ExamProfile.passScore` 组卷 + 计时 + 成绩单 |
| Token 计量 | 按 `userId` 统计 Tutor 调用成本（复用现有 `token-usage` 模块） |
| 题目版本化 | `questions.json` 增加 `version` 字段，更新后清除缓存 |

---

## 附录：类型最小集一览

```typescript
// 可直接拷贝到 src/core/types.ts
export type Language = "python" | "sql" | "javascript";

export interface ExamProfile {
  id: string;
  title: string;
  provider: string;
  version: string;
  passScore: number;
  domains: { id: string; title: string; weight: number }[];
  runtime: { language: Language; version?: string; preloadPackages?: string[] };
}

export interface PracticeItem {
  id: string;
  examId: string;
  domainId: string;
  content: {
    scenario: string;
    task: string;
    difficulty: "easy" | "medium" | "hard";
    tags?: string[];
  };
  workspace: {
    language: Language;
    initialCode: string;
    hiddenPreCode?: string;
    hiddenPostCode?: string;
    timeoutMs?: number;
  };
  solution: {
    correctCode: string;
    explanation: string;
    tutorDirectives: {
      hints: string[];
      commonMistakes: string[];
      keyConcepts: string[];
    };
  };
}
```
