# Supabase 认证配置指南

本文档说明如何配置 mvp28-fix 项目的国际版（`NEXT_PUBLIC_DEFAULT_LANGUAGE=en`）Supabase 认证功能。

## 环境变量配置

在 `.env.local` 或部署环境中配置以下变量：

```bash
# Supabase 基础配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# 或者使用这个变量名
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Supabase 服务端密钥（用于管理员操作）
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 语言版本配置
NEXT_PUBLIC_DEFAULT_LANGUAGE=en  # 国际版使用 en
```

## Supabase Dashboard 配置

### 1. 邮箱认证配置

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入项目 → Authentication → Providers
3. 确保 Email 认证已启用
4. 配置邮件模板（可选）

### 2. Google OAuth 配置

1. 进入 Authentication → Providers → Google
2. 启用 Google Provider
3. 配置 Google OAuth 凭据：
   - 在 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 2.0 凭据
   - 获取 Client ID 和 Client Secret
   - 填入 Supabase Dashboard

### 3. 重定向 URL 配置

在 Authentication → URL Configuration 中配置：

- **Site URL**: `https://your-domain.com`
- **Redirect URLs** (添加以下 URL):
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/auth/update-password`
  - `http://localhost:3000/auth/callback` (开发环境)
  - `http://localhost:3000/auth/update-password` (开发环境)

### 4. Google Cloud Console 配置

在 Google Cloud Console 的 OAuth 2.0 凭据中配置：

**授权的 JavaScript 来源**:
- `https://your-domain.com`
- `http://localhost:3000` (开发环境)

**授权的重定向 URI**:
- `https://your-project.supabase.co/auth/v1/callback`

## 数据库迁移

确保已运行数据库迁移脚本 `supabase/migrations/20251215_new_table.sql`，该脚本会：

1. 创建 `profiles` 表（用户资料）
2. 创建 `user_wallets` 表（用户钱包/配额）
3. 创建 `handle_new_user()` 触发器（自动为新用户创建 profile 和 wallet）

## 认证流程说明

### 邮箱注册流程

1. 用户填写邮箱、密码、姓名
2. 调用 `supabase.auth.signUp()` 创建用户
3. Supabase 发送确认邮件
4. 用户点击邮件中的确认链接
5. 跳转到 `/auth/callback` 处理认证
6. 触发器自动创建 profile 和 wallet 记录

### 邮箱登录流程

1. 用户填写邮箱和密码
2. 调用 `supabase.auth.signInWithPassword()`
3. 认证成功后跳转到首页

### Google 登录流程

1. 用户点击 "Continue with Google" 按钮
2. 调用 `supabase.auth.signInWithOAuth({ provider: "google" })`
3. 重定向到 Google 授权页面
4. 用户授权后回调到 `/auth/callback`
5. 处理 PKCE 流程，交换 code 获取 session
6. 触发器自动创建 profile 和 wallet 记录（如果是新用户）

### 忘记密码流程

1. 用户点击 "Forgot password?"
2. 输入邮箱，调用 `supabase.auth.resetPasswordForEmail()`
3. Supabase 发送密码重置邮件
4. 用户点击邮件中的链接，跳转到 `/auth/update-password`
5. 用户设置新密码

## 故障排除

### Google 登录失败

1. 检查 Google OAuth 凭据是否正确配置
2. 确认重定向 URL 已添加到 Supabase 和 Google Cloud Console
3. 检查浏览器控制台是否有错误信息

### 邮箱验证链接无效

1. 检查 Supabase 的 Site URL 是否正确
2. 确认 Redirect URLs 包含 `/auth/callback`
3. 检查链接是否过期（默认 24 小时）

### 用户登录后没有 profile

1. 检查 `handle_new_user()` 触发器是否正确创建
2. 检查 Supabase Dashboard → Database → Functions 是否有该触发器
3. 查看 Supabase 日志是否有错误信息

## 相关文件

- `components/auth-page.tsx` - 登录/注册页面组件
- `app/auth/callback/page.tsx` - OAuth 回调处理
- `app/auth/forgot-password/page.tsx` - 忘记密码页面
- `app/auth/update-password/page.tsx` - 更新密码页面
- `app/auth/sign-up-success/page.tsx` - 注册成功页面
- `lib/supabase/client.ts` - Supabase 浏览器端客户端
- `lib/supabase/server.ts` - Supabase 服务端客户端
- `app/api/auth/me/route.ts` - 获取当前用户 API
- `supabase/migrations/20251215_new_table.sql` - 数据库迁移脚本
