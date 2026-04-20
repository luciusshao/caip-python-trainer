# CAIP Python Trainer — 多用户系统升级方案

**版本:** v1.0  
**日期:** 2026-04-20  
**状态:** 待实施  
**分支:** `feature/multi-user`（从 main 切出）

---

## 1. 背景与目标

### 1.1 现状
- 纯前端 app，所有状态存 localStorage
- 登录页仅 UI 装饰，无真实认证
- 无数据库、无 middleware、无用户体系
- 单用户模型：换浏览器 = 丢进度

### 1.2 目标
将系统拆分为 **学生端** 和 **老师端**：

| 端 | 核心功能 |
|----|----------|
| **学生端** | 登录认证、首次改密码、学习进度云端同步、个人资料管理 |
| **老师端** | 独立登录、创建/管理学生账号、重置密码并邮件通知、查看学生进度、课程管理 |

### 1.3 约束
- 教室场景，10-50 名学生
- 现有学生学习体验 **零改动**（所有 UI 组件不动）
- 台灯登录页动画保留，只接入真实认证逻辑
- 部署方案：Vercel + 云数据库

---

## 2. 技术选型

### 2.1 数据库：Neon PostgreSQL + Prisma ORM

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **Neon PostgreSQL** | 免费 0.5GB、serverless、Vercel 原生集成、连接池内置 | 比 SQLite 多一步配置 | ✅ 采用 |
| SQLite + Turso | 最简单 | 并发写入受限、serverless 冷启动慢 | ❌ |
| Supabase | 全家桶 | 过度工程、vendor lock-in | ❌ |
| MongoDB Atlas | 灵活 schema | 无关系完整性、Prisma 支持为 preview | ❌ |

**选择理由:**
- 免费版轻松覆盖 10-50 学生
- Prisma 提供类型安全查询，与 TypeScript 代码库完美匹配
- `@neondatabase/serverless` 驱动专为 Vercel/Next.js 优化
- 未来需要升级时 PostgreSQL 迁移路径最广

### 2.2 认证：自定义 JWT (jose + bcryptjs)

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **自定义 JWT** | 完全可控、轻量、角色分离简单 | 需手动处理 token 刷新 | ✅ 采用 |
| NextAuth.js v5 | 标准方案 | credentials-only 太重、角色分离别扭 | ❌ |
| Supabase Auth | 全托管 | vendor lock-in | ❌ |

**选择理由:**
- 只需账号密码认证，不需要 OAuth
- 老师学生完全分离（不同登录页、不同 cookie、不可互登）
- 首次改密码、老师创建账号等自定义逻辑 JWT 实现最直接
- 总代码量 ~200 行

### 2.3 邮件：Nodemailer + Resend

- **开发环境:** console.log 打印（或 Ethereal 假 SMTP）
- **生产环境:** Resend.com 免费版（100 封/天，教室场景足够）

### 2.4 新增依赖

```json
{
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "@neondatabase/serverless": "^0.10.0",
    "jose": "^5.0.0",
    "bcryptjs": "^2.4.3",
    "nodemailer": "^6.9.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/nodemailer": "^6.4.0"
  }
}
```

Bundle 影响: ~50KB gzipped (jose 3KB + bcryptjs 30KB + nodemailer server-only)

---

## 3. 数据库 Schema

### 3.1 ER 图 (文字版)

```
Teacher (1) ──→ (N) Student (1) ──→ (1) LearningProgress
                     │ (1) ──→ (N) QuizAttempt
                     │ (1) ──→ (N) PracticeAttempt
                     │ (1) ──→ (1) Streak
                     │ (1) ──→ (N) MockExamScore
                     
Teacher (1) ──→ (N) Course
```

### 3.2 表结构

#### Teacher（老师）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| username | String (unique) | 登录账号 |
| passwordHash | String | bcrypt 哈希 |
| displayName | String | 显示名称 |
| email | String? | 邮箱 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

#### Student（学生）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| username | String (unique) | 登录账号 |
| passwordHash | String | bcrypt 哈希 |
| displayName | String | 显示名称 |
| email | String? | 用于密码重置 |
| mustChangePassword | Boolean (default: true) | 首次登录强制改密码 |
| teacherId | String (FK → Teacher) | 归属老师 |
| lastLoginAt | DateTime? | 最后登录时间 |
| createdAt / updatedAt | DateTime | 时间戳 |

#### LearningProgress（学习进度）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| studentId | String (unique FK) | 一对一绑定学生 |
| currentModuleId | String (default: "m1") | 当前模块 |
| currentLessonId | String (default: "m1-l1") | 当前课时 |
| currentStep | String (default: "theory") | 当前步骤 |
| theoryLang | String (default: "both") | 语言偏好 |
| lessonProgress | **JSON** | `{ "m1-l1": { theoryRead, codeCompleted, quizPassed } }` |
| completedModules | String[] | 已完成模块列表 |
| mockExamUnlocked | Boolean (default: false) | 模拟考试是否解锁 |
| updatedAt | DateTime | 最后更新 |

> **设计决策:** `lessonProgress` 使用 JSON 列而非独立表。原因：key 结构动态、与现有 Zustand 结构一一对应、迁移零成本。

#### QuizAttempt（答题记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| studentId | String (FK) | 所属学生 |
| lessonId | String | 课时 ID |
| quizId | String | 题目 ID |
| selectedAnswer | Int | 选择的答案 |
| correct | Boolean | 是否正确 |
| createdAt | DateTime | 答题时间 |

> 独立表的好处：支持老师端按题目统计正确率。

#### PracticeAttempt（实战记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| studentId + moduleId | compound unique | 每学生每模块一条记录 |
| completed | Boolean | 是否完成 |
| attempts | Int | 尝试次数 |

#### Streak（连续学习记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| studentId | String (unique FK) | 一对一绑定 |
| currentStreak | Int | 当前连续天数 |
| longestStreak | Int | 最长记录 |
| lastActiveDate | String? | YYYY-MM-DD |
| activeDays | String[] | 活跃日期列表 |

#### Course（课程 — 占位，Phase 5 启用）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| teacherId | String (FK) | 所属老师 |
| name | String | 课程名称 |
| description | String? | 描述 |
| syllabusKey | String (default: "default") | 对应 JSON 键 |
| isActive | Boolean (default: true) | 是否启用 |

---

## 4. 认证与会话方案

### 4.1 Cookie 策略
```
老师: cookie name = "teacher-token", httpOnly, secure, sameSite=lax, 7天过期
学生: cookie name = "student-token", httpOnly, secure, sameSite=lax, 7天过期
```

两个独立 cookie，互不干扰，从根本上杜绝角色混淆。

### 4.2 JWT Payload
```typescript
// 学生 token
{ userId: string, role: "student", mustChangePassword: boolean, iat, exp }

// 老师 token
{ userId: string, role: "teacher", iat, exp }
```

### 4.3 Middleware 路由保护矩阵

| 路由 | 需要认证 | 角色 | 未认证行为 |
|------|----------|------|------------|
| `/login` | ❌ | — | — |
| `/teacher/login` | ❌ | — | — |
| `/api/auth/*` | ❌ | — | — |
| `/` (学生主页) | ✅ | student | → redirect `/login` |
| `/profile` | ✅ | student | → redirect `/login` |
| `/change-password` | ✅ | student | → redirect `/login` |
| `/teacher/*` | ✅ | teacher | → redirect `/teacher/login` |
| `/api/chat` | ✅ | student | → 401 |
| `/api/student/*` | ✅ | student | → 401 |
| `/api/teacher/*` | ✅ | teacher | → 401 |

**额外规则:** 学生 `mustChangePassword=true` 且不在 `/change-password` 页面 → 强制跳转。

### 4.4 登录流程

```
Student Login:
Browser                    Server                    Database
  │                          │                          │
  ├── POST /api/auth/student/login ──→                  │
  │   { username, password }  │                          │
  │                          ├── bcrypt.compare ───────→ │
  │                          │←── Student row ──────────┤
  │                          ├── jose.sign(JWT)          │
  │   ←── Set-Cookie: student-token=xxx ──┤             │
  │                          │                          │
  ├── redirect → / 或 /change-password                   │
  │   (middleware 验证 cookie，放行)                       │
```

---

## 5. 进度同步方案

### 5.1 策略：Write-through + localStorage 缓存

```
页面加载:
  GET /api/student/progress → hydrate Zustand store

每次状态变化:
  Zustand update → localStorage (即时)
                 → PUT /api/student/progress (2秒 debounce)
```

### 5.2 合并规则
- **完成类状态** (theoryRead, codeCompleted, quizPassed, completedModules): 取 **OR 合并**（任一端标记完成则为完成）
- **导航状态** (currentModuleId, currentStep): 取服务端（更可靠）
- **偏好** (theoryLang): 取本地（用户正在操作的设备）

### 5.3 现有组件影响
**零改动。** 所有 UI 组件仍然只读 Zustand store。同步层对它们完全透明：
```
Sidebar, Header, LessonView, TheoryPane, CodePane, 
QuizPane, PracticePane, AIChatPanel — 全部不动
```

---

## 6. 路由与文件结构

### 6.1 目录树（新增部分标 ★）

```
src/
├── app/
│   ├── login/page.tsx                           # 现有 → 接入真实认证
│   ├── (student)/                               ★ Route Group
│   │   ├── layout.tsx                           ★ 学生 auth check + 进度加载
│   │   ├── page.tsx                             # 现有 page.tsx 移入
│   │   ├── profile/page.tsx                     ★ 个人资料
│   │   └── change-password/page.tsx             ★ 首次改密码
│   │
│   ├── teacher/
│   │   ├── login/page.tsx                       ★ 老师登录页
│   │   └── (dashboard)/
│   │       ├── layout.tsx                       ★ 老师 layout (侧边栏+auth)
│   │       ├── page.tsx                         ★ 仪表盘首页
│   │       ├── students/
│   │       │   ├── page.tsx                     ★ 学生列表
│   │       │   └── [id]/page.tsx                ★ 学生详情
│   │       └── courses/page.tsx                 ★ 课程管理
│   │
│   ├── api/
│   │   ├── chat/route.ts                        # 现有 → 追加 auth check
│   │   ├── auth/
│   │   │   ├── student/
│   │   │   │   ├── login/route.ts               ★
│   │   │   │   ├── logout/route.ts              ★
│   │   │   │   └── change-password/route.ts     ★
│   │   │   └── teacher/
│   │   │       ├── login/route.ts               ★
│   │   │       └── logout/route.ts              ★
│   │   ├── student/
│   │   │   ├── progress/route.ts                ★ GET/PUT 进度同步
│   │   │   ├── profile/route.ts                 ★ GET/PUT 个人资料
│   │   │   └── streak/route.ts                  ★ POST 更新 streak
│   │   └── teacher/
│   │       ├── dashboard/route.ts               ★ GET 统计数据
│   │       ├── students/route.ts                ★ GET 列表 / POST 创建
│   │       ├── students/[id]/route.ts           ★ GET/PUT/DELETE
│   │       ├── students/[id]/reset-password/route.ts  ★
│   │       ├── students/[id]/progress/route.ts  ★ GET 学生进度
│   │       └── courses/route.ts                 ★ GET/POST
│   │
│   ├── layout.tsx                               # 现有
│   └── globals.css                              # 现有
│
├── components/
│   ├── [现有 8 个组件全部不动]
│   ├── student/
│   │   ├── ProfileForm.tsx                      ★
│   │   └── ChangePasswordForm.tsx               ★
│   └── teacher/
│       ├── TeacherSidebar.tsx                   ★
│       ├── StatsCards.tsx                        ★
│       ├── StudentTable.tsx                     ★
│       ├── CreateStudentModal.tsx               ★
│       ├── StudentProgressView.tsx              ★
│       └── CourseManagement.tsx                 ★
│
├── lib/
│   ├── useAIChat.ts                             # 现有不动
│   ├── usePyodide.ts                            # 现有不动
│   ├── auth.ts                                  ★ JWT sign/verify + cookie 工具
│   ├── prisma.ts                                ★ Prisma Client 单例
│   ├── email.ts                                 ★ 邮件发送
│   └── useProgressSync.ts                       ★ Zustand ↔ 服务端同步 hook
│
├── store/
│   └── useAppStore.ts                           # 修改：新增 hydrate + snapshot
│
├── middleware.ts                                ★ 路由保护
│
└── types/
    └── auth.ts                                  ★ 认证相关类型

prisma/
├── schema.prisma                                ★
├── seed.ts                                      ★ 初始老师账号
└── migrations/                                  ★ auto-generated
```

### 6.2 文件统计
- **新建:** ~35 个文件
- **修改:** ~5 个文件 (login/page.tsx, page.tsx 移动, useAppStore.ts, api/chat/route.ts, package.json)
- **零改动:** 所有现有 UI 组件 + hooks + 内容数据 + 样式

---

## 7. 环境变量

```env
# .env.local (完整版)
LLM_API_KEY=sk-...                    # 现有
DATABASE_URL=postgresql://...          # ★ Neon 连接串
JWT_SECRET=random-32-char-string       # ★ JWT 签名密钥
SMTP_HOST=smtp.resend.com             # ★ Phase 4 才需要
SMTP_PORT=465                          # ★
SMTP_USER=resend                       # ★
SMTP_PASS=re_...                       # ★
EMAIL_FROM=noreply@yourschool.edu      # ★
```

---

## 8. 老师端功能优先级

| 优先级 | 功能 | Phase | 说明 |
|--------|------|-------|------|
| P0 必须 | 创建学生账号 | 4 | 核心需求 |
| P0 必须 | 重置学生密码 + 邮件通知 | 4 | 核心需求 |
| P0 必须 | 查看学生学习进度 | 4 | 核心价值 |
| P1 应有 | 仪表盘统计总览 | 3 | 老师首页 |
| P1 应有 | 批量创建学生 (CSV) | 5 | 50 学生逐个创建太痛苦 |
| P2 锦上添花 | 导出进度报告 | 6+ | 给学校行政 |
| P2 锦上添花 | 全班 quiz 正确率分析 | 6+ | "哪些题错得最多" |
| P3 远期 | 自定义题库 | 6+ | 需要内容编辑 UI，工作量大 |
| P3 远期 | 难度自适应 | 6+ | 基于 quiz 通过率调整 |
| P3 远期 | 公告系统 | 6+ | 不是核心 |

---

## 9. 待讨论问题回复

| 问题 | 回答 |
|------|------|
| 学习进度存哪？ | **PostgreSQL 数据库 (Neon)**，localStorage 作快速读取缓存。`LearningProgress` 表的 `lessonProgress` JSON 列完整存储进度 |
| 要不要引入数据库？ | **必须。** 多用户 = 状态必须在服务端。无 DB 无法：跨设备同步、老师查看进度、管理账号 |
| 用哪个数据库？ | **Neon PostgreSQL。** 免费版够用、Prisma 类型安全、serverless 原生支持、Vercel 一键集成 |
| 老师后台还应该有啥？ | 见上方优先级表。P0-P1 为初版必做，P2-P3 后续迭代 |
| 课程管理怎么做？ | 初版：只读展示 syllabus.json 结构 + 课程开关 toggle。题库管理和难度调整推到 Phase 6+ |

---

## 10. 风险与注意事项

| 风险 | 缓解措施 |
|------|----------|
| Neon 免费版限制 | 0.5GB + 无限计算时间，50 学生绰绰有余。超出再升级 |
| JWT 过期处理 | 7 天过期 + 每次请求检查有效性，过期跳登录页 |
| 进度同步冲突 | 完成状态 OR 合并（只会向前推进，不会丢进度）|
| 邮件发送失败 | 密码重置走异步，失败时 UI 提示老师重试 |
| 现有功能回归 | 所有现有组件零改动，UI 层面无风险 |
| 数据库迁移 | Prisma migrate 自动管理 schema 版本 |

---

## 附录 A: 老师端页面线框图

### 仪表盘
```
┌─────────────────────────────────────────────────┐
│  CAIP Trainer - 教师管理端          [退出登录]    │
├──────────┬──────────────────────────────────────┤
│          │  📊 教学概览                          │
│ 导航栏    │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│          │  │ 25   │ │ 12   │ │ 68%  │ │ 4.2  ││
│ 📊 总览   │  │ 学生数│ │今日活跃│ │平均完成│ │平均streak│
│ 👥 学生   │  └──────┘ └──────┘ └──────┘ └──────┘│
│ 📚 课程   │                                      │
│          │  [最近活跃学生列表]                     │
│          │  [模块完成率柱状图]                     │
└──────────┴──────────────────────────────────────┘
```

### 学生管理
```
┌──────────┬──────────────────────────────────────┐
│          │  👥 学生管理     [+ 创建学生] [📥 CSV] │
│ 导航栏    │  ┌─────────────────────────────────┐ │
│          │  │ 搜索: [___________] [筛选▼]     │ │
│          │  ├─────┬──────┬────────┬─────┬─────┤ │
│          │  │ 姓名 │ 账号 │ 最后登录│ 进度 │ 操作 │ │
│          │  ├─────┼──────┼────────┼─────┼─────┤ │
│          │  │ 张三 │ zs01 │ 今天   │ 72% │ ··· │ │
│          │  │ 李四 │ ls02 │ 昨天   │ 45% │ ··· │ │
│          │  └─────┴──────┴────────┴─────┴─────┘ │
└──────────┴──────────────────────────────────────┘
```

---

## 附录 B: 实施时间估算

| Phase | 内容 | 天数 | 累计 |
|-------|------|------|------|
| 0 | 基础设施 (DB + Auth lib) | 2 | 2 |
| 1 | 学生认证 | 2 | 4 |
| 2 | 进度持久化 | 2 | 6 |
| 3 | 老师认证 + 仪表盘 | 3 | 9 |
| 4 | 学生管理 | 3 | 12 |
| 5 | 课程管理 + 收尾 | 3 | 15 |

每个 Phase 完成后都是一个 **可部署的完整状态**。Phase 2 完成即可作为有意义的 v1 交付。
