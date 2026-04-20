# 公网部署认证系统重构设计文档

## Context

当前系统是课堂内部工具，采用自研 JWT + 双 cookie（`student-token` / `teacher-token`）认证，账号由老师后台创建，无自注册、无邮箱验证、无 OAuth、无 CAPTCHA。

随着规划把 Mock Exam 做成付费功能、部署到公网让用户自主使用，现有认证架构在三个维度不够：

1. **功能缺口**：无自注册、无第三方登录、无邮箱验证、无忘记密码
2. **安全缺口**：JWT 无法撤销、无 CSRF 专项防护、无 rate limit、无人机验证
3. **架构刚性**：Teacher/Student 分表 + 分 cookie，未来要加 admin、付费用户等角色扩展成本高

本次重构目标：迁移到 **Auth.js v5（NextAuth.js）** + 统一 User 模型 + 三种登录方式（Google / GitHub / 邮箱密码）+ Cloudflare Turnstile，并保证所有敏感密钥通过 Vercel 环境变量安全管理。

---

## 最终技术方案

| 维度 | 方案 |
|------|------|
| 认证框架 | Auth.js v5（原 NextAuth.js） |
| 登录方式 | Google OAuth + GitHub OAuth + Credentials（邮箱密码） |
| 自注册 | 邮箱+密码注册 → Resend 发验证邮件 → `emailVerified` 标记 |
| 人机验证 | Cloudflare Turnstile（注册/密码登录/忘记密码） |
| 用户体系 | 统一 `User` + `role` 字段（`student` / `teacher` / `admin`） + `StudentProfile` / `TeacherProfile` 1:1 拆分 |
| Session | DB-backed session（可撤销，付费场景必须） |
| Adapter | `@auth/prisma-adapter` |
| 密钥管理 | Vercel Environment Variables（AES-256 加密）+ `src/lib/env.ts` zod 校验 |
| 部署平台 | Vercel |

---

## Schema 改造

### 目标 Prisma Schema（新增/替换模型）

```prisma
// ============ NextAuth Core ============

model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  emailVerified DateTime?
  name          String?
  image         String?
  // 自定义字段
  role          Role      @default(STUDENT)
  isActive      Boolean   @default(true)
  passwordHash  String?   // Credentials provider 用；OAuth-only 用户为 null
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // NextAuth 关联
  accounts      Account[]
  sessions      Session[]

  // 业务 Profile（1:1 可选）
  studentProfile StudentProfile?
  teacherProfile TeacherProfile?
}

enum Role {
  STUDENT
  TEACHER
  ADMIN
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String  // "google" | "github" | "credentials"
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String   // email
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============ Business Profiles ============

model StudentProfile {
  id        String  @id @default(cuid())
  userId    String  @unique
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  // 原 Student 表迁移过来的字段
  username     String? @unique     // 可选；OAuth 用户可无
  displayName  String
  teacherId    String?             // 公网用户可无老师；内部学生仍关联
  lastLoginAt  DateTime?

  teacher      TeacherProfile? @relation(fields: [teacherId], references: [id], onDelete: SetNull)

  // 保留原有业务关系
  progress         LearningProgress?
  streak           Streak?
  quizAttempts     QuizAttempt[]
  practiceAttempts PracticeAttempt[]
  mockExamScores   MockExamScore[]
  tokenUsages      TokenUsage[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([teacherId])
}

model TeacherProfile {
  id          String  @id @default(cuid())
  userId      String  @unique
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  username    String? @unique     // 内部老师保留；OAuth 老师可无
  displayName String

  students    StudentProfile[]
  courses     Course[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 现有模型字段调整

- `LearningProgress.studentId` → 改指向 `StudentProfile.id`
- `QuizAttempt`, `PracticeAttempt`, `Streak`, `MockExamScore`, `TokenUsage`, `Course` 同理
- 原 `Teacher`、`Student` 表 → 迁移数据后删除
- 移除原 `mustChangePassword`（新架构用 `emailVerified` 替代验证流程，内部老师首次登录强制改密可用别的标记）

### 数据迁移脚本

新建 `prisma/migrate-to-unified-user.ts`：

```typescript
// 伪代码，执行顺序
// 1. 读出所有 Teacher
//    → 创建 User (role=TEACHER, passwordHash 复制, email 复制)
//    → 创建 TeacherProfile 关联
//    → 记录 oldTeacherId -> newTeacherProfileId 映射
// 2. 读出所有 Student
//    → 创建 User (role=STUDENT, passwordHash 复制)
//    → 创建 StudentProfile 关联，teacherId 用映射表替换
//    → 记录 oldStudentId -> newStudentProfileId 映射
// 3. 更新所有子表的 studentId 为新 ID
//    LearningProgress / QuizAttempt / PracticeAttempt / Streak / MockExamScore / TokenUsage
// 4. 更新 Course.teacherId
// 5. DROP TABLE Teacher, Student
```

---

## NextAuth 配置

### `src/auth.ts`（Auth.js v5 入口）

```typescript
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { verifyTurnstile } from "@/lib/turnstile";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },  // DB-backed session（可撤销）
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true, // 允许同邮箱跨 provider 绑定
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: {},
        password: {},
        turnstileToken: {},
      },
      async authorize(credentials) {
        // 1. Turnstile 验证
        const ok = await verifyTurnstile(credentials.turnstileToken as string);
        if (!ok) throw new Error("CAPTCHA_FAILED");

        // 2. 查用户
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user || !user.passwordHash) return null;

        // 3. 必须邮箱已验证
        if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

        // 4. 校验密码
        const ok2 = await verifyPassword(credentials.password as string, user.passwordHash);
        if (!ok2) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // 把 role 和 userId 塞进 session
      session.user.id = user.id;
      session.user.role = (user as { role: "STUDENT" | "TEACHER" | "ADMIN" }).role;
      return session;
    },
    async signIn({ user, account }) {
      // OAuth 登录成功后，确保有 Profile
      if (account?.provider !== "credentials") {
        await ensureProfileExists(user.id!, "STUDENT");
      }
      return true;
    },
  },
});
```

### `src/app/api/auth/[...nextauth]/route.ts`

```typescript
export { GET, POST } from "@/auth";
```

### `src/middleware.ts`（重写）

```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // 公开路由
  const publicRoutes = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password"];
  if (publicRoutes.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  // 未登录 → 跳 /login
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 角色校验：/teacher/* 必须是 TEACHER/ADMIN
  if ((pathname.startsWith("/teacher") || pathname.startsWith("/api/teacher")) &&
      session.user.role !== "TEACHER" && session.user.role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

---

## 自注册 + 邮箱验证

### 新增 API

| 路由 | 方法 | 作用 |
|------|------|------|
| `/api/auth/register` | POST | 接收 email+password+turnstile → 创建未验证 User → 发验证邮件 |
| `/api/auth/verify-email` | GET/POST | 点击链接 → 校验 token → 设置 `emailVerified` |
| `/api/auth/forgot-password` | POST | 接收 email+turnstile → 生成重置 token → 发邮件 |
| `/api/auth/reset-password` | POST | 接收 token+新密码+turnstile → 更新 passwordHash |

### 邮件服务

- `src/lib/email.ts` — 封装 Resend SDK
- 模板：验证邮件、密码重置邮件（`src/emails/*.tsx` 用 React Email）

### 新增前端页面

- `src/app/register/page.tsx` — 注册表单（email + password + 确认 + Turnstile 组件）
- `src/app/verify-email/page.tsx` — 验证结果页（从 URL 取 token → 调 API）
- `src/app/forgot-password/page.tsx` — 忘记密码表单
- `src/app/reset-password/page.tsx` — 重置密码表单

---

## Cloudflare Turnstile 集成

### 依赖
- `@marsidev/react-turnstile`（前端组件）

### 前端组件 `src/components/auth/TurnstileWidget.tsx`
```tsx
"use client";
import { Turnstile } from "@marsidev/react-turnstile";

export function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void }) {
  return (
    <Turnstile
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
      onSuccess={onVerify}
      options={{ theme: "dark", size: "flexible" }}
    />
  );
}
```

### 后端校验 `src/lib/turnstile.ts`
```typescript
export async function verifyTurnstile(token: string): Promise<boolean> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
    }),
  });
  const data = await res.json();
  return data.success === true;
}
```

### 集成点
- `/api/auth/register` — 必须验证
- Credentials provider `authorize()` — 必须验证（登录）
- `/api/auth/forgot-password` — 必须验证
- OAuth 登录 **不需要**（OAuth 提供商自带防护）

---

## 密钥与环境变量管理

### 统一 env schema `src/lib/env.ts`

```typescript
import { z } from "zod";

const serverEnvSchema = z.object({
  // NextAuth
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),  // Vercel 自动注入 VERCEL_URL

  // OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),

  // Turnstile (后端)
  TURNSTILE_SECRET_KEY: z.string().min(1),

  // Email
  RESEND_API_KEY: z.string().startsWith("re_"),
  EMAIL_FROM: z.string().email(),

  // LLM
  LLM_API_KEY: z.string().min(1),

  // Database
  DATABASE_URL: z.string().startsWith("postgresql://"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
});

export const env = serverEnvSchema.parse(process.env);
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
});
```

### `.env.example`（提交 git）

```bash
# NextAuth
AUTH_SECRET=                    # openssl rand -base64 32
AUTH_URL=http://localhost:3000  # 生产不设，Vercel 自动用 VERCEL_URL

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Resend Email
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com

# LLM
LLM_API_KEY=

# Database
DATABASE_URL=
```

### Vercel 密钥安全保障

- 所有非 `NEXT_PUBLIC_*` 变量在 Vercel Dashboard 配置（AES-256 加密存储，运行时注入）
- 敏感密钥（`*_SECRET`、`*_API_KEY`、`DATABASE_URL`）在 Vercel 标记为 **Sensitive**（设置后不可回读）
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 是**设计上公开**的（打进 bundle 无风险）
- `LLM_API_KEY` 仅在服务端 `/api/chat/route.ts` 引用，Next.js 保证不进前端
- Production / Preview / Development 三套环境分别配置密钥

### DeepSeek API Key 额外防护

- **仅服务端使用**：只在 `src/app/api/chat/route.ts` 出现
- **Rate Limiting**：新增 `src/lib/ratelimit.ts`，基于 `@upstash/ratelimit` + Upstash Redis（免费额度够用），按 user 限制 20 次/分钟
- **用量监控**：已有 `TokenUsage` 表，加每日阈值报警（Phase 2 再做）
- **付费墙**：未登录/未付费用户禁用 `/api/chat`（Phase 2 结合订阅系统）

---

## 所有受影响文件

### 新建 (~18 个)

| 路径 | 说明 |
|------|------|
| `src/auth.ts` | NextAuth v5 配置入口 |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handler |
| `src/app/api/auth/register/route.ts` | 自注册 API |
| `src/app/api/auth/verify-email/route.ts` | 邮箱验证 API |
| `src/app/api/auth/forgot-password/route.ts` | 忘记密码 API |
| `src/app/api/auth/reset-password/route.ts` | 重置密码 API |
| `src/app/register/page.tsx` | 注册页 |
| `src/app/verify-email/page.tsx` | 验证结果页 |
| `src/app/forgot-password/page.tsx` | 忘记密码页 |
| `src/app/reset-password/page.tsx` | 重置密码页 |
| `src/components/auth/TurnstileWidget.tsx` | Turnstile 组件 |
| `src/components/auth/OAuthButtons.tsx` | Google/GitHub 登录按钮 |
| `src/lib/env.ts` | 环境变量 zod 校验 |
| `src/lib/password.ts` | bcrypt 封装（从旧 auth.ts 拆出） |
| `src/lib/turnstile.ts` | Turnstile 后端校验 |
| `src/lib/email.ts` | Resend 邮件发送封装 |
| `src/lib/ratelimit.ts` | Rate limiting |
| `src/emails/VerifyEmail.tsx` | 验证邮件模板 |
| `src/emails/ResetPassword.tsx` | 重置邮件模板 |
| `prisma/migrate-to-unified-user.ts` | 数据迁移脚本 |

### 修改 (~20 个)

| 路径 | 改动 |
|------|------|
| `prisma/schema.prisma` | User/Account/Session/VerificationToken + StudentProfile/TeacherProfile + 所有子表 FK |
| `prisma/seed.ts` | 用新 schema 创建 admin + 测试用户 |
| `src/middleware.ts` | 完全重写，用 `auth()` wrapper |
| `src/lib/auth.ts` | 删除（功能拆到 `src/auth.ts` + `src/lib/password.ts`） |
| `src/types/auth.ts` | 扩展 NextAuth `Session` / `User` 类型（`declare module`） |
| `src/app/login/page.tsx` | 加 OAuth 按钮 + Turnstile + 改用 `signIn()` |
| `src/app/teacher/login/page.tsx` | 改用统一 `/login`（或保留独立入口但调 `signIn("credentials", { redirectTo: "/teacher" })`） |
| `src/app/(student)/change-password/page.tsx` | 改用 session.user.id |
| `src/app/(student)/profile/page.tsx` | logout 改用 `signOut()` |
| `src/components/teacher/TeacherSidebar.tsx` | logout 改用 `signOut()` |
| `src/app/api/auth/student/login/route.ts` | **删除**（NextAuth 接管） |
| `src/app/api/auth/student/logout/route.ts` | **删除** |
| `src/app/api/auth/teacher/login/route.ts` | **删除** |
| `src/app/api/auth/teacher/logout/route.ts` | **删除** |
| `src/app/api/auth/student/change-password/route.ts` | 改用 `auth()` 读 session |
| `src/app/api/auth/teacher/change-password/route.ts` | 改用 `auth()` 读 session |
| `src/app/api/student/profile/route.ts` | `auth()` 读 session，studentProfile 查询 |
| `src/app/api/student/progress/route.ts` | `auth()` 读 session |
| `src/app/api/chat/route.ts` | `auth()` 读 session，加 rate limit |
| `src/app/api/teacher/dashboard/route.ts` | `auth()` 读 session，teacherProfile 查询 |
| `src/app/api/teacher/students/route.ts` | 同上，create 同时建 User + StudentProfile |
| `src/app/api/teacher/students/[id]/route.ts` | studentProfile 为主体 |
| `src/app/api/teacher/students/[id]/reset-password/route.ts` | 同上 |
| `src/app/api/teacher/token-usage/route.ts` | studentProfile 关联 |
| `package.json` | 新增：`next-auth@beta`, `@auth/prisma-adapter`, `@marsidev/react-turnstile`, `resend`, `@react-email/*`, `@upstash/ratelimit`, `@upstash/redis`, `zod` |
| `.env.example` | 新增所有 OAuth / Turnstile / Resend 变量 |

### 删除 (6 个)
- `src/app/api/auth/student/login/route.ts`
- `src/app/api/auth/student/logout/route.ts`
- `src/app/api/auth/teacher/login/route.ts`
- `src/app/api/auth/teacher/logout/route.ts`
- `src/lib/auth.ts`（拆分后整体删除）
- 旧 `Teacher` / `Student` Prisma 模型（schema 里移除）

---

## 执行顺序（分阶段）

### Phase 0：前置准备（老大负责，不在编码范围）
- [ ] 合并 `feature/multi-user` → `main`
- [ ] 开新分支 `feature/public-auth`
- [ ] 申请 Google OAuth Client ID / Secret（GCP Console）
- [ ] 申请 GitHub OAuth App Client ID / Secret
- [ ] 申请 Cloudflare Turnstile Site Key / Secret Key
- [ ] 申请 Resend API Key（验证邮件发送域名）
- [ ] 申请 Upstash Redis（免费档，rate limit 用）

### Phase 1：Schema 改造 + 数据迁移（1 天）
1. 修改 `prisma/schema.prisma`（新增 User/Account/Session/Profile，保留旧表）
2. `npx prisma migrate dev --name add_user_profile`
3. 写数据迁移脚本 `prisma/migrate-to-unified-user.ts`
4. 本地测试迁移（备份现有 DB）
5. 更新 `prisma/seed.ts`

### Phase 2：NextAuth 基础 + OAuth（1 天）
1. 安装依赖：`next-auth@beta @auth/prisma-adapter`
2. 实现 `src/auth.ts` + `src/lib/env.ts` + `src/lib/password.ts`
3. 新建 `src/app/api/auth/[...nextauth]/route.ts`
4. 重写 `src/middleware.ts`
5. 改造 `src/types/auth.ts`（NextAuth 类型扩展）
6. 所有 API routes 的 `x-user-id` → `auth()`
7. 本地跑通 Google + GitHub 登录

### Phase 3：自注册 + 邮箱验证 + 忘记密码（1.5 天）
1. 安装 `resend @react-email/components`
2. 实现 `src/lib/email.ts` + 两个邮件模板
3. 实现 4 个 API：register / verify-email / forgot-password / reset-password
4. 实现 4 个前端页面
5. 统一 `/login` 页加 OAuth 按钮 + 密码登录表单
6. 删除 `/teacher/login`（或改为引导到 `/login`）

### Phase 4：Cloudflare Turnstile（0.5 天）
1. 安装 `@marsidev/react-turnstile`
2. 实现 `TurnstileWidget` + `src/lib/turnstile.ts`
3. 集成到 register / login(credentials) / forgot-password

### Phase 5：Rate Limiting + 收尾（0.5 天）
1. 安装 `@upstash/ratelimit @upstash/redis`
2. 实现 `src/lib/ratelimit.ts`
3. 接入 `/api/chat`（主要成本大头）
4. 删除旧文件（旧 auth.ts、旧 login/logout routes）
5. 更新 `.env.example`

### Phase 6：测试 + 部署（0.5 天）
1. E2E 测试所有登录流程
2. 测试角色越权（student 访问 /teacher 被拒）
3. `npm run build` + `npm run lint` 通过
4. Vercel Dashboard 配置所有环境变量
5. Preview 部署验证
6. Production 部署

**总工时：5-6 天**

---

## 验证清单（End-to-End）

### 注册/登录
- [ ] Google OAuth 登录 → 新用户自动创建 User + StudentProfile
- [ ] GitHub OAuth 登录 → 同上
- [ ] 同一邮箱 Google 和密码登录 → 自动关联到同一 User（`allowDangerousEmailAccountLinking`）
- [ ] 邮箱密码注册 → 收到验证邮件 → 点击链接 → `emailVerified` 被设置
- [ ] 未验证邮箱用户密码登录 → 拒绝并提示
- [ ] 忘记密码 → 收到重置链接 → 点击 → 新密码登录成功
- [ ] Turnstile 未验证或验证失败 → 注册/登录被拒

### 角色与权限
- [ ] Student 访问 `/teacher/*` → 被重定向
- [ ] Student 访问 `/api/teacher/*` → 403
- [ ] Teacher 访问 `/teacher/*` → 正常
- [ ] 未登录访问任何受保护路由 → 跳 `/login`
- [ ] Session 在 DB 被删除后，下一次请求立即失效（验证可撤销）

### 业务功能回归
- [ ] 学生 AI 对话 → TokenUsage 仍然正确记录（studentProfile 关联）
- [ ] 老师 Token 消耗页 → 数据正常聚合
- [ ] 老师创建学生 → User + StudentProfile 同时创建
- [ ] 老师重置学生密码 → 学生能用新密码登录
- [ ] 学生学习进度 → upsert 正常

### 部署
- [ ] `npm run build` 在 Vercel 成功（env.ts zod 不 fail）
- [ ] 生产环境 OAuth 回调 URL 配置正确（`https://yourdomain.com/api/auth/callback/google` 等）
- [ ] Rate limit 生效（超 20 次/分钟返回 429）
- [ ] 敏感密钥在 Vercel 标记为 Sensitive

---

## 关键风险与对策

| 风险 | 对策 |
|------|------|
| 数据迁移失败导致数据丢失 | 执行前 `pg_dump` 全库备份；迁移脚本支持幂等重跑；本地先跑通 |
| NextAuth v5 API 仍在变动 | 锁定 `next-auth@5.0.0-beta.x` 具体版本，升级前看 changelog |
| Google/GitHub 邮箱账号劫持 | `allowDangerousEmailAccountLinking` 仅对**已验证邮箱**的 OAuth 开启（Google/GitHub 都默认只返回已验证邮箱） |
| DeepSeek key 被滥用 | Rate limit + TokenUsage 监控 + 付费墙（Phase 2 收费系统） |
| 老师端独立登录入口依赖 | Phase 2 统一到 `/login`，role 判断后自动跳 `/teacher` |
| 现有 student01/admin 账号迁移 | 迁移脚本保留原 passwordHash，用户登录方式不变（邮箱 → username 兼容） |

---

## 关键文件索引（实施时参考）

| 关注点 | 文件 |
|--------|------|
| 现有 middleware 逻辑 | `src/middleware.ts` |
| 现有 JWT/bcrypt 封装 | `src/lib/auth.ts`（即将拆分/删除） |
| Prisma schema | `prisma/schema.prisma` |
| Prisma client 初始化 | `src/lib/prisma.ts` |
| 所有消费 `x-user-id` 的路由 | `src/app/api/{auth,student,teacher,chat}/**/route.ts` |
| 所有登录页 | `src/app/login/page.tsx`, `src/app/teacher/login/page.tsx` |
| 登出按钮 | `src/app/(student)/profile/page.tsx`, `src/components/teacher/TeacherSidebar.tsx` |
| 种子数据 | `prisma/seed.ts` |
