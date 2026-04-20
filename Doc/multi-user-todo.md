# 多用户系统升级 — TODO Checklist

**分支:** `feature/multi-user`  
**更新日期:** 2026-04-20  
**标记说明:** ⬜ 待做 | 🔲 进行中 | ✅ 完成 | ⏭️ 跳过

---

## Phase 0: 基础设施 (Day 1-2)

### 0.1 项目初始化
- [ ] 从 main 切出 `feature/multi-user` 分支
- [ ] 提交当前未提交的改动（AI Tutor icon、Header fix、systemPrompt 等）

### 0.2 安装依赖
- [ ] `npm i @prisma/client @neondatabase/serverless jose bcryptjs`
- [ ] `npm i -D prisma @types/bcryptjs`
- [ ] 验证: `npm run build` 通过（依赖不破坏现有代码）

### 0.3 数据库配置
- [ ] 创建 Neon 免费版数据库实例
- [ ] 获取连接串，写入 `.env.local` 的 `DATABASE_URL`
- [ ] 生成 `JWT_SECRET` (32 字符随机串)，写入 `.env.local`
- [ ] 验证: `.env.local` 包含 `LLM_API_KEY`、`DATABASE_URL`、`JWT_SECRET` 三个变量

### 0.4 Prisma Schema
- [ ] 创建 `prisma/schema.prisma`
  - [ ] Teacher 表
  - [ ] Student 表 (含 mustChangePassword, teacherId FK)
  - [ ] LearningProgress 表 (含 lessonProgress JSON 列)
  - [ ] QuizAttempt 表
  - [ ] PracticeAttempt 表 (compound unique: studentId + moduleId)
  - [ ] Streak 表
  - [ ] MockExamScore 表
  - [ ] Course 表 (占位)
- [ ] `npx prisma migrate dev --name init` 成功
- [ ] 验证: `npx prisma studio` 能看到所有 8 张表

### 0.5 种子数据
- [ ] 创建 `prisma/seed.ts`
  - [ ] 创建初始老师账号 (admin / 初始密码)
  - [ ] 密码用 bcryptjs hash
- [ ] `package.json` 添加 `prisma.seed` 配置
- [ ] `npx prisma db seed` 成功
- [ ] 验证: `npx prisma studio` → Teacher 表有 1 条记录

### 0.6 基础 Lib 文件
- [ ] 创建 `src/lib/prisma.ts` — Prisma Client 单例
  - [ ] dev 环境热重载不重复创建连接
  - [ ] 验证: 在任意 API route import 不报错
- [ ] 创建 `src/lib/auth.ts` — 认证工具
  - [ ] `hashPassword(plain)` → bcrypt hash
  - [ ] `verifyPassword(plain, hash)` → boolean
  - [ ] `signToken(payload, role)` → JWT string
  - [ ] `verifyToken(token, role)` → decoded payload | null
  - [ ] `setAuthCookie(response, token, role)` → 设置 httpOnly cookie
  - [ ] `clearAuthCookie(response, role)` → 清除 cookie
  - [ ] 验证: 单元级手动测试 — sign 后能 verify，hash 后能 compare
- [ ] 创建 `src/types/auth.ts` — 类型定义
  - [ ] `TokenPayload` 类型
  - [ ] `AuthUser` 类型
  - [ ] 验证: TypeScript 编译无报错

### 0.7 Phase 0 总验证
- [ ] `npm run build` 通过
- [ ] `npm run dev` → 现有 app 完全正常（登录页、主页、AI Tutor）
- [ ] 数据库连接正常（seed 数据可查看）
- [ ] git commit Phase 0

---

## Phase 1: 学生认证 (Day 3-4)

### 1.1 Middleware
- [ ] 创建 `src/middleware.ts`
  - [ ] 定义 matcher（排除 static、image 等）
  - [ ] `/login`、`/teacher/login`、`/api/auth/*` → 放行
  - [ ] `/` 及学生页 → 检查 `student-token` cookie
    - [ ] 无效/过期 → redirect `/login`
    - [ ] `mustChangePassword && pathname !== '/change-password'` → redirect `/change-password`
  - [ ] `/teacher/*` → 检查 `teacher-token` cookie（Phase 3 启用，先占位）
  - [ ] `/api/student/*`、`/api/chat` → 检查 `student-token`，401
  - [ ] `/api/teacher/*` → 检查 `teacher-token`，401
  - [ ] 通过验证后把 `x-user-id` 和 `x-user-role` 写入 request headers
- [ ] 验证: 未登录访问 `http://localhost:3000/` → 跳转 `/login`
- [ ] 验证: 直接访问 `/login` → 正常显示台灯页面

### 1.2 学生登录 API
- [ ] 创建 `src/app/api/auth/student/login/route.ts`
  - [ ] 接收 `{ username, password }`
  - [ ] 查询 Student 表
  - [ ] bcrypt.compare 验证密码
  - [ ] 签发 JWT（含 userId, role, mustChangePassword）
  - [ ] 设置 `student-token` httpOnly cookie
  - [ ] 返回 `{ success: true, mustChangePassword }` 或错误
  - [ ] 更新 `lastLoginAt`
- [ ] 验证: 用 curl 或 Postman 测试 POST `/api/auth/student/login`
  - [ ] 正确账密 → 200 + Set-Cookie
  - [ ] 错误账密 → 401

### 1.3 学生登出 API
- [ ] 创建 `src/app/api/auth/student/logout/route.ts`
  - [ ] 清除 `student-token` cookie
  - [ ] 返回 `{ success: true }`
- [ ] 验证: 调用后 cookie 被清除

### 1.4 改密码 API
- [ ] 创建 `src/app/api/auth/student/change-password/route.ts`
  - [ ] 接收 `{ currentPassword, newPassword }`
  - [ ] 从 headers 获取 userId
  - [ ] 验证旧密码
  - [ ] hash 新密码并更新 Student 表
  - [ ] 设置 `mustChangePassword = false`
  - [ ] 重新签发 JWT（更新 mustChangePassword 字段）
  - [ ] 设置新 cookie
- [ ] 验证: 改密码后 mustChangePassword = false

### 1.5 Route 重组
- [ ] 创建 `src/app/(student)/layout.tsx`
  - [ ] 客户端 layout，加载进度同步（Phase 2 补充逻辑，先空壳）
- [ ] 移动 `src/app/page.tsx` → `src/app/(student)/page.tsx`
  - [ ] 确保内容完全不变
  - [ ] 验证: 登录后访问 `/` 正常显示主页
- [ ] 创建 `src/app/(student)/change-password/page.tsx`
  - [ ] 表单: 当前密码、新密码、确认新密码
  - [ ] 提交 → POST `/api/auth/student/change-password`
  - [ ] 成功 → `router.push('/')`
  - [ ] 样式: 与品牌色系一致的暗色主题

### 1.6 登录页改造
- [ ] 修改 `src/app/login/page.tsx`
  - [ ] **保留全部台灯 SVG 动画代码**
  - [ ] 给 username input 绑定 `value={username}` + `onChange`
  - [ ] 给 password input 绑定 `value={password}` + `onChange`
  - [ ] 登录按钮: `type="submit"` + `onSubmit={handleLogin}`
  - [ ] `handleLogin`: fetch `/api/auth/student/login` → 成功跳转 / 失败显示错误
  - [ ] 错误提示: 表单下方红色文字
  - [ ] 已登录用户访问 `/login` → redirect `/`
- [ ] 验证: 台灯动画完全正常（拖拽、音效、颜色变换、表单显隐）
- [ ] 验证: 输入正确账密 → 跳转主页
- [ ] 验证: 输入错误账密 → 显示错误提示

### 1.7 创建测试学生（临时）
- [ ] 在 seed.ts 中追加创建 1 个测试学生账号
- [ ] 重新 seed
- [ ] 验证: 完整流程 → 登录 → 改密码 → 进入主页

### 1.8 Phase 1 总验证
- [ ] `npm run build` 通过
- [ ] 端到端: 未登录 → `/login` → 登录 → `/change-password` → 改密码 → `/` 主页
- [ ] 学生 cookie 不能访问 `/teacher/*`（返回 redirect 或 401）
- [ ] 登出后跳回 `/login`
- [ ] git commit Phase 1

---

## Phase 2: 进度持久化 (Day 5-6)

### 2.1 进度 API
- [ ] 创建 `src/app/api/student/progress/route.ts`
  - [ ] GET: 从 headers 获取 userId → 查询 LearningProgress → 返回 JSON
    - [ ] 不存在则创建默认记录
  - [ ] PUT: 接收进度快照 → 更新 LearningProgress
    - [ ] 合并逻辑: 完成状态 OR 合并，导航状态覆盖
  - [ ] 验证: curl GET 返回默认进度 / PUT 后 GET 返回更新值

### 2.2 Streak API
- [ ] 创建 `src/app/api/student/streak/route.ts`
  - [ ] POST: 更新当前学生的 Streak 记录
  - [ ] 逻辑: 与现有 Zustand updateStreak 一致
  - [ ] 验证: 调用后 Streak 表数据正确

### 2.3 Profile API
- [ ] 创建 `src/app/api/student/profile/route.ts`
  - [ ] GET: 返回 displayName, username(只读), email
  - [ ] PUT: 更新 displayName, email
  - [ ] 验证: 读写正常

### 2.4 同步 Hook
- [ ] 创建 `src/lib/useProgressSync.ts`
  - [ ] 页面加载时 GET /api/student/progress → hydrate Zustand
  - [ ] Zustand 变化时 → 2 秒 debounce → PUT /api/student/progress
  - [ ] 错误处理: 网络失败不阻断 UI，console.warn
  - [ ] 验证: 打开 DevTools Network，看到 debounced PUT 请求

### 2.5 Store 改造
- [ ] 修改 `src/store/useAppStore.ts`
  - [ ] 新增 `hydrateFromServer(data)` action — 用服务端数据覆盖本地
  - [ ] 新增 `getProgressSnapshot()` — 导出可序列化进度快照
  - [ ] **不改动任何现有 action 的逻辑**
  - [ ] 验证: TypeScript 编译通过，现有功能无影响

### 2.6 Student Layout 集成
- [ ] 修改 `src/app/(student)/layout.tsx`
  - [ ] 引入 `useProgressSync` hook
  - [ ] 页面加载时触发同步
  - [ ] 验证: 登录后 Network 面板看到 GET /api/student/progress

### 2.7 Profile 页面
- [ ] 创建 `src/app/(student)/profile/page.tsx`
  - [ ] 显示: 姓名、用户名（只读）、email（可编辑）
  - [ ] 修改密码入口链接 → `/change-password`
  - [ ] 退出登录按钮 → POST `/api/auth/student/logout` → redirect `/login`
  - [ ] 保存按钮 → PUT `/api/student/profile`
  - [ ] 验证: 能看到并修改个人信息
- [ ] 创建 `src/components/student/ProfileForm.tsx`
- [ ] Header 或 Sidebar 增加 Profile 入口链接

### 2.8 Phase 2 总验证
- [ ] `npm run build` 通过
- [ ] 登录 → 做几道题 → 刷新页面 → 进度仍在（来自服务端）
- [ ] 换浏览器（或清除 localStorage）→ 登录同一账号 → 进度同步
- [ ] Profile 页面读写正常
- [ ] 现有学习体验完全无变化（Theory/Code/Quiz/Practice/AI Tutor）
- [ ] git commit Phase 2

---

## Phase 3: 老师认证 + 仪表盘 (Day 7-9)

### 3.1 老师登录 API
- [ ] 创建 `src/app/api/auth/teacher/login/route.ts`
  - [ ] 逻辑同学生登录，但查 Teacher 表、设 `teacher-token` cookie
  - [ ] 验证: curl 测试正确/错误账密

### 3.2 老师登出 API
- [ ] 创建 `src/app/api/auth/teacher/logout/route.ts`
  - [ ] 清除 `teacher-token` cookie
  - [ ] 验证: cookie 被清除

### 3.3 老师登录页
- [ ] 创建 `src/app/teacher/login/page.tsx`
  - [ ] 简洁专业风格（**不用**台灯动画）
  - [ ] 标题: "CAIP Trainer — 教师管理端"
  - [ ] 表单: 账号、密码、登录按钮
  - [ ] 品牌色系一致的暗色主题
  - [ ] 错误提示
  - [ ] 登录成功 → redirect `/teacher`
  - [ ] 验证: 视觉效果与品牌一致

### 3.4 老师 Dashboard Layout
- [ ] 创建 `src/app/teacher/(dashboard)/layout.tsx`
  - [ ] 检查 `teacher-token` cookie（middleware 已处理，这里做 UI 层面）
  - [ ] 左侧导航 + 顶栏 + 主内容区
- [ ] 创建 `src/components/teacher/TeacherSidebar.tsx`
  - [ ] 导航项: 📊 总览、👥 学生管理、📚 课程管理
  - [ ] 当前路由高亮
  - [ ] 退出登录按钮
  - [ ] 验证: 导航点击切换路由

### 3.5 Dashboard API
- [ ] 创建 `src/app/api/teacher/dashboard/route.ts`
  - [ ] GET: 查询该老师名下的统计数据
    - [ ] 学生总数
    - [ ] 今日活跃学生数（lastLoginAt = today）
    - [ ] 平均完成度（从 LearningProgress 计算）
    - [ ] 平均 streak
  - [ ] 验证: 返回正确统计数据

### 3.6 Dashboard 页面
- [ ] 创建 `src/app/teacher/(dashboard)/page.tsx`
  - [ ] 4 个统计卡片（学生数、今日活跃、平均完成度、平均 streak）
  - [ ] 最近活跃学生列表（Top 5）
  - [ ] 模块完成率概览
- [ ] 创建 `src/components/teacher/StatsCards.tsx`
  - [ ] 验证: 数据正确显示

### 3.7 Middleware 补全
- [ ] 确认 middleware.ts 中老师路由保护已生效
- [ ] 验证: 未登录访问 `/teacher` → 跳转 `/teacher/login`
- [ ] 验证: 学生 cookie 访问 `/teacher` → 跳转 `/teacher/login`
- [ ] 验证: 老师 cookie 访问 `/` → 跳转 `/login`（不能进学生页）

### 3.8 Phase 3 总验证
- [ ] `npm run build` 通过
- [ ] 老师登录 → 看到仪表盘 → 数据正确
- [ ] 角色隔离: 老师不能进学生页，学生不能进老师页
- [ ] 登出正常
- [ ] git commit Phase 3

---

## Phase 4: 学生管理 (Day 10-12)

### 4.1 学生列表 API
- [ ] 创建 `src/app/api/teacher/students/route.ts`
  - [ ] GET: 查询该老师创建的所有学生
    - [ ] 返回: id, displayName, username, email, lastLoginAt, 完成度
    - [ ] 支持搜索参数 `?q=关键词`
  - [ ] POST: 创建新学生
    - [ ] 接收: displayName, username
    - [ ] 自动生成初始密码（8 位随机）
    - [ ] 设置 mustChangePassword = true
    - [ ] 设置 teacherId = 当前老师
    - [ ] 创建关联的 LearningProgress + Streak 记录
    - [ ] 返回: 学生信息 + 初始密码（仅此次返回）
  - [ ] 验证: GET 返回列表 / POST 创建成功

### 4.2 学生详情 API
- [ ] 创建 `src/app/api/teacher/students/[id]/route.ts`
  - [ ] GET: 返回学生详情 + 学习进度
    - [ ] 含 LearningProgress, Streak, PracticeAttempt
    - [ ] 权限检查: 只能查看自己创建的学生
  - [ ] PUT: 更新学生信息 (displayName, email)
  - [ ] DELETE: 软删除（或停用）学生
  - [ ] 验证: 权限正确，数据正确

### 4.3 密码重置 API
- [ ] 创建 `src/app/api/teacher/students/[id]/reset-password/route.ts`
  - [ ] POST: 生成新密码 → hash → 更新 Student → mustChangePassword=true
  - [ ] 如果学生有 email → 发送邮件通知
  - [ ] 返回: 新密码（仅此次）
  - [ ] 验证: 重置后学生用新密码登录成功

### 4.4 邮件功能
- [ ] `npm i nodemailer && npm i -D @types/nodemailer`
- [ ] 创建 `src/lib/email.ts`
  - [ ] `sendPasswordResetEmail(to, username, newPassword)` 函数
  - [ ] 开发环境: console.log 打印邮件内容
  - [ ] 生产环境: 通过 SMTP 发送
  - [ ] `.env.local` 添加 SMTP 相关变量
- [ ] 验证: 开发环境 console 看到邮件内容 / 生产环境收到邮件

### 4.5 学生列表页面
- [ ] 创建 `src/app/teacher/(dashboard)/students/page.tsx`
  - [ ] 搜索框（实时过滤）
  - [ ] 学生表格: 姓名、账号、最后登录、完成度百分比、操作按钮
  - [ ] "创建学生" 按钮 → 弹窗
  - [ ] 行操作: 查看详情、重置密码
- [ ] 创建 `src/components/teacher/StudentTable.tsx`
  - [ ] 表格组件，支持排序
  - [ ] 验证: 数据正确，搜索正常
- [ ] 创建 `src/components/teacher/CreateStudentModal.tsx`
  - [ ] 表单: 姓名、账号
  - [ ] 创建后显示初始密码（可复制）
  - [ ] 验证: 创建成功，列表自动刷新

### 4.6 学生详情页面
- [ ] 创建 `src/app/teacher/(dashboard)/students/[id]/page.tsx`
  - [ ] 基本信息卡: 姓名、账号、邮箱、最后登录
  - [ ] 操作按钮: 编辑信息、重置密码
  - [ ] 学习进度视图
- [ ] 创建 `src/components/teacher/StudentProgressView.tsx`
  - [ ] 模块完成度（5 个模块进度条）
  - [ ] 课时完成情况（theory/code/quiz 状态）
  - [ ] Quiz 正确率
  - [ ] Streak 数据
  - [ ] Practice 尝试次数和完成状态
  - [ ] 验证: 数据与学生实际进度一致

### 4.7 Phase 4 总验证
- [ ] `npm run build` 通过
- [ ] 端到端: 老师创建学生 → 学生用初始密码登录 → 改密码 → 学习 → 老师查看进度
- [ ] 老师重置密码 → 学生用新密码登录
- [ ] 老师只能看到自己创建的学生（权限隔离）
- [ ] git commit Phase 4

---

## Phase 5: 课程管理 + 收尾 (Day 13-15)

### 5.1 课程管理
- [ ] 创建 `src/app/api/teacher/courses/route.ts`
  - [ ] GET: 返回课程列表（从 DB + syllabus.json 合并）
  - [ ] POST: 创建/更新课程设置
- [ ] 创建 `src/app/teacher/(dashboard)/courses/page.tsx`
  - [ ] 只读展示当前课程结构（从 syllabus.json 读取）
  - [ ] 5 个模块 → 每个模块的课时列表
  - [ ] 课程启用/停用 toggle
- [ ] 创建 `src/components/teacher/CourseManagement.tsx`
- [ ] 验证: 课程结构正确展示

### 5.2 批量创建学生
- [ ] 学生列表页增加 "CSV 导入" 按钮
- [ ] 支持格式: `姓名,账号` (每行一个)
- [ ] 批量创建 → 显示所有初始密码（可下载 CSV）
- [ ] 验证: 上传 CSV → 学生全部创建成功

### 5.3 边界处理
- [ ] Token 过期: 请求返回 401 时自动跳转登录页
- [ ] 网络错误: 进度同步失败时 toast 提示，不阻断 UI
- [ ] 并发会话: 同一账号多设备登录，最后写入者赢
- [ ] 验证: 断网 → 操作 → 恢复网络 → 不崩溃

### 5.4 Loading 状态
- [ ] 所有新页面添加 loading skeleton
- [ ] API 调用中显示 spinner
- [ ] 验证: 慢网络下 UX 正常（Chrome DevTools throttle）

### 5.5 Chat API Auth
- [ ] 修改 `src/app/api/chat/route.ts`
  - [ ] 从 headers 读取 `x-user-id`（middleware 已注入）
  - [ ] 可选: 记录 chat 使用日志
  - [ ] 验证: 未认证调用 → 401

### 5.6 文档更新
- [ ] 更新 `Doc/ARCHITECTURE.md` — 新增认证层、数据库层、老师端
- [ ] 更新 `Doc/DESIGN.md` — 新增表结构、API 列表、路由矩阵
- [ ] 更新 `CLAUDE.md` — 新增命令、文件路径、架构说明
- [ ] 更新 `Doc/optimizer.md` — 标记已完成项目

### 5.7 Phase 5 总验证
- [ ] `npm run build` 通过
- [ ] `npm run lint` 无 error
- [ ] 全链路回归:
  - [ ] 学生: 登录 → 改密码 → 学习 Theory/Code/Quiz/Practice → AI Tutor → Profile → 登出
  - [ ] 老师: 登录 → Dashboard → 创建学生 → 查看进度 → 重置密码 → 课程管理 → 登出
  - [ ] 隔离: 学生不能进老师页，老师不能进学生页
  - [ ] 同步: 学生换浏览器进度保持
- [ ] git commit Phase 5
- [ ] 合并到 main（PR review）

---

## Phase 6+: 未来迭代（记录在此，不在本次实施范围）

- [ ] 全班 Quiz 正确率分析（哪些题错得最多）
- [ ] 导出进度报告 (CSV/PDF)
- [ ] 自定义题库（老师添加 quiz 题目）
- [ ] 难度自适应（根据学生 quiz 通过率调整难度）
- [ ] 实时学生活动监控
- [ ] 公告/通知系统
- [ ] 学生之间排行榜
- [ ] 成就/徽章系统

---

## 文件变更汇总

### 新建文件 (~35)
```
prisma/schema.prisma
prisma/seed.ts
src/middleware.ts
src/types/auth.ts
src/lib/prisma.ts
src/lib/auth.ts
src/lib/email.ts
src/lib/useProgressSync.ts
src/app/(student)/layout.tsx
src/app/(student)/page.tsx              ← 从 src/app/page.tsx 移入
src/app/(student)/profile/page.tsx
src/app/(student)/change-password/page.tsx
src/app/api/auth/student/login/route.ts
src/app/api/auth/student/logout/route.ts
src/app/api/auth/student/change-password/route.ts
src/app/api/student/progress/route.ts
src/app/api/student/profile/route.ts
src/app/api/student/streak/route.ts
src/app/teacher/login/page.tsx
src/app/teacher/(dashboard)/layout.tsx
src/app/teacher/(dashboard)/page.tsx
src/app/teacher/(dashboard)/students/page.tsx
src/app/teacher/(dashboard)/students/[id]/page.tsx
src/app/teacher/(dashboard)/courses/page.tsx
src/app/api/auth/teacher/login/route.ts
src/app/api/auth/teacher/logout/route.ts
src/app/api/teacher/dashboard/route.ts
src/app/api/teacher/students/route.ts
src/app/api/teacher/students/[id]/route.ts
src/app/api/teacher/students/[id]/reset-password/route.ts
src/app/api/teacher/students/[id]/progress/route.ts
src/app/api/teacher/courses/route.ts
src/components/student/ProfileForm.tsx
src/components/student/ChangePasswordForm.tsx
src/components/teacher/TeacherSidebar.tsx
src/components/teacher/StatsCards.tsx
src/components/teacher/StudentTable.tsx
src/components/teacher/CreateStudentModal.tsx
src/components/teacher/StudentProgressView.tsx
src/components/teacher/CourseManagement.tsx
```

### 修改文件 (~5)
```
src/app/login/page.tsx            → 接入真实认证
src/store/useAppStore.ts          → 新增 hydrate + snapshot actions
src/app/api/chat/route.ts         → 追加 auth check
package.json                      → 新增依赖
.env.local                        → 新增 DATABASE_URL, JWT_SECRET, SMTP_*
```

### 零改动文件
```
src/components/Sidebar.tsx
src/components/Header.tsx
src/components/LessonView.tsx
src/components/TheoryPane.tsx
src/components/CodePane.tsx
src/components/QuizPane.tsx
src/components/PracticePane.tsx
src/components/AIChatPanel.tsx
src/lib/usePyodide.ts
src/lib/useAIChat.ts
src/content/syllabus.json
src/content/challenges.json
config/ai_model.json
src/app/globals.css
src/app/layout.tsx
```
