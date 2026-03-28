# Google Sign-In Android WebView 集成 - 完整配置指南

## ✅ 已完成的集成

### Android 端（MornClient 项目）

**1. 依赖配置**
- ✅ 添加 `play-services-auth:21.2.0` 到 [app/build.gradle:223](D:\Software\Code\Work\APP\MornClient\EN\android\app\build.gradle#L223)

**2. 核心类**
- ✅ [GoogleSignInHelper.java](D:\Software\Code\Work\APP\MornClient\EN\android\app\src\main\java\co\median\android\GoogleSignInHelper.java) - 处理 Google Sign-In 逻辑
- ✅ [GoogleSignInBridge.java](D:\Software\Code\Work\APP\MornClient\EN\android\app\src\main\java\co\median\android\GoogleSignInBridge.java) - JavaScript Bridge 接口

**3. MainActivity 集成**
- ✅ [MainActivity.java:144](D:\Software\Code\Work\APP\MornClient\EN\android\app\src\main\java\co\median\android\MainActivity.java#L144) - 添加成员变量
- ✅ [MainActivity.java:437-440](D:\Software\Code\Work\APP\MornClient\EN\android\app\src\main\java\co\median\android\MainActivity.java#L437-L440) - 注册 JavaScript Bridge
- ✅ [MainActivity.java:1040-1043](D:\Software\Code\Work\APP\MornClient\EN\android\app\src\main\java\co\median\android\MainActivity.java#L1040-L1043) - 处理 Activity 结果

### Web 端（mvp34 项目）

**1. Bridge 封装**
- ✅ [lib/google-signin-bridge.ts](D:\Software\Code\Work\demo\mvp34\lib\google-signin-bridge.ts) - 封装 Android Bridge 调用
  - `signInWithGoogle()` - 调用原生登录
  - `signOutGoogle()` - 调用原生登出
  - `getCurrentUser()` - 获取当前用户
  - `isAndroidWebView()` - 检测 Android WebView 环境

**2. 登录页面集成**
- ✅ [components/auth-page.tsx:377-450](D:\Software\Code\Work\demo\mvp34\components\auth-page.tsx#L377-L450) - 集成 Android 原生登录
  - 环境检测：检查 `window.GoogleSignIn` 是否存在
  - 调用 Bridge：使用 `signInWithGoogle()` 获取 ID Token
  - 后端验证：调用 `/api/auth/google-native` 验证 Token
  - 状态更新：调用 `updateUser()` 立即更新 AuthContext
  - 保存认证：使用 `saveAuthState()` 保存到 localStorage

**3. 认证上下文管理**
- ✅ [context/AuthContext.tsx](D:\Software\Code\Work\demo\mvp34\context\AuthContext.tsx) - 统一的认证状态管理
  - 初始化时从 localStorage 读取认证状态（支持 Android Native 登录）
  - 提供 `updateUser()` 方法用于立即更新用户状态
  - 同时支持 Supabase OAuth 和 Android Native 登录

**4. 后端 API**
- ✅ [app/api/auth/google-native/route.ts](D:\Software\Code\Work\demo\mvp34\app\api\auth\google-native\route.ts) - 处理原生登录认证
  - 验证 Google ID Token
  - 使用 Admin API 创建或获取用户
  - 等待数据库触发器创建 profile
  - 创建自定义 JWT session
  - 返回用户信息和 session

**5. 认证状态管理**
- ✅ [lib/auth-state-manager.ts](D:\Software\Code\Work\demo\mvp34\lib\auth-state-manager.ts) - localStorage 认证状态管理
  - `saveAuthState()` - 保存认证状态
  - `getStoredAuthState()` - 读取认证状态
  - `clearAuthState()` - 清除认证状态

**6. 依赖**
- ✅ 添加 `google-auth-library` 用于验证 ID Token

## 🔧 必需的配置步骤

### 1. 获取 Google OAuth 客户端 ID

#### 步骤 A：创建 Google Cloud 项目
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Google Sign-In API**

#### 步骤 B：创建 Android OAuth 客户端
1. 进入 **APIs & Services** > **Credentials**
2. 点击 **Create Credentials** > **OAuth 2.0 Client ID**
3. 选择 **Android** 作为应用类型
4. 填写以下信息：
   - **Name**: MornClient Android
   - **Package name**: `co.median.android.app`（从 appConfig.json 获取）
   - **SHA-1 certificate fingerprint**: 见下方获取方法

#### 步骤 C：获取 SHA-1 证书指纹

**Debug 版本：**
```bash
cd "D:\Software\Code\Work\APP\MornClient\EN\android"
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Release 版本：**
```bash
keytool -list -v -keystore /path/to/your/release.keystore -alias your_alias
```

复制输出中的 **SHA1** 指纹并粘贴到 Google Cloud Console。

#### 步骤 D：创建 Web OAuth 客户端（用于 Supabase）
1. 再次点击 **Create Credentials** > **OAuth 2.0 Client ID**
2. 选择 **Web application**
3. 添加授权的重定向 URI：
   - `https://your-supabase-project.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback`（开发环境）

**重要说明：为什么需要两个 OAuth 客户端？**
- **Android 客户端**：用于 Android Native Google Sign-In SDK，验证来自 Android 应用的 ID Token
- **Web 客户端**：用于 Supabase OAuth 流程，处理浏览器环境的 Google 登录

### 2. 配置 Web 项目环境变量

编辑 `D:\Software\Code\Work\demo\mvp34\.env.local`：

```env
# Google OAuth 客户端 ID（Android 版本）
# 用于验证来自 Android Native SDK 的 ID Token
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_android_client_id.apps.googleusercontent.com

# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**环境变量说明：**
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Android OAuth 客户端 ID，用于后端验证 ID Token
- `SUPABASE_SERVICE_ROLE_KEY`: 用于绕过 RLS 策略创建用户（仅后端使用）

### 3. 配置 Supabase

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 进入 **Authentication** > **Providers**
3. 启用 **Google** 提供商
4. 填写 **Client ID** 和 **Client Secret**（使用 Web OAuth 客户端的凭据）

### 4. 数据库配置

确保数据库中存在以下触发器（用于自动创建用户 profile）：

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name),
    avatar = COALESCE(NULLIF(EXCLUDED.avatar, ''), profiles.avatar),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## 🚀 编译和测试

### 1. 编译 Android 应用

```bash
cd "D:\Software\Code\Work\APP\MornClient\EN\android"

# Debug 版本
./gradlew assembleDebug

# Release 版本
./gradlew assembleRelease
```

APK 输出位置：
- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release: `app/build/outputs/apk/release/app-release.apk`

### 2. 构建 Web 项目

```bash
cd "D:\Software\Code\Work\demo\mvp34"

# 安装依赖
pnpm install

# 构建生产版本
pnpm build

# 启动开发服务器
pnpm dev
```

### 3. 测试流程

#### 测试环境准备
1. 在 Android 设备或模拟器上安装 APK
2. 确保设备已登录 Google 账号
3. 启动应用并导航到登录页面

#### 测试步骤
1. **打开登录页面**
   - 在应用中访问 `/auth/login`

2. **点击 Google 登录按钮**
   - 应该看到"使用 Google 登录"按钮

3. **验证 Bridge 可用**
   - 打开 Chrome DevTools（`chrome://inspect`）
   - 在 Console 中执行：
   ```javascript
   console.log(typeof window.GoogleSignIn);
   // 应该输出 "object"
   ```

4. **执行登录**
   - 点击"使用 Google 登录"按钮
   - 应该弹出系统账号选择器（不是网页）
   - 选择 Google 账号
   - 登录成功后应该跳转到首页

5. **验证登录状态**
   - 检查用户信息是否正确显示
   - 刷新页面，确认登录状态保持

## 🔍 调试指南

### Android 端调试

**1. 查看日志**
```bash
adb logcat | grep -E "GoogleSignIn|MainActivity|GoogleSignInBridge"
```

**2. 检查 Bridge 注册**
```bash
adb logcat | grep "addJavascriptInterface"
```

**3. 常见错误**

**错误：Sign in failed: 10**
- **原因**：SHA-1 证书指纹不匹配
- **解决**：重新获取 SHA-1 并更新 Google Cloud Console

**错误：Sign in failed: 12501**
- **原因**：用户取消登录
- **解决**：正常行为，无需处理

**错误：Sign in failed: 7**
- **原因**：网络连接问题
- **解决**：检查网络连接

### Web 端调试

**1. 启用远程调试**
- Chrome 访问 `chrome://inspect`
- 连接 Android 设备
- 选择 WebView 进行调试

**2. 测试 Bridge 调用**
```javascript
// 在 Console 中测试
window.GoogleSignIn.signIn(
  'your_client_id.apps.googleusercontent.com',
  'testCallback'
);

// 定义回调函数
window.testCallback = function(result) {
  console.log('Login result:', result);
};
```

**3. 检查环境检测**
```javascript
// 检查是否在 Android WebView 中
console.log('Is Android WebView:', !!window.GoogleSignIn);
```

**4. 查看网络请求**
- 在 Network 标签中查看 `/api/auth/google-native` 请求
- 检查请求体和响应

## ⚠️ 常见问题

### 1. 登录成功但用户信息不立即显示

**问题：** 登录成功后跳转到首页，但用户名和头像不显示，需要刷新页面才能看到

**原因：** AuthContext 只在初始化时从 localStorage 读取，登录后保存的数据不会自动更新到 Context

**解决方案：**
1. 在 AuthContext 中添加 `updateUser()` 方法
2. 登录成功后立即调用 `updateUser()` 更新状态

```typescript
// context/AuthContext.tsx
const updateUser = useCallback((newUser: User | DomesticUser | null) => {
  setUser(newUser);
}, []);

// components/auth-page.tsx
const { updateUser } = useAuth();

// 登录成功后
saveAuthState(...);
updateUser(data.user);  // ✅ 立即更新状态
router.push(next);
```

### 2. 403 错误仍然出现

**问题：** 点击登录后仍然跳转到 `accounts.google.com` 并显示 403 错误

**原因：**
- Web 代码未正确检测 Android 环境
- Bridge 未正确注册

**解决：**
1. 检查 `window.GoogleSignIn` 是否存在
2. 确认 MainActivity 中已注册 Bridge
3. 查看 [components/auth-page.tsx:377-450](D:\Software\Code\Work\demo\mvp34\components\auth-page.tsx#L377-L450) 的环境检测逻辑

### 3. Bridge 未定义

**问题：** `window.GoogleSignIn is undefined`

**原因：**
- WebView 未完全加载
- Bridge 注册失败

**解决：**
1. 确认 MainActivity 中的 Bridge 注册代码已添加
2. 检查 `mWebview.getWebView()` 是否返回 null
3. 在 WebView 加载完成后再调用 Bridge

### 4. 回调函数未执行

**问题：** 登录成功但回调函数未被调用

**原因：**
- 回调函数名称不匹配
- 回调函数未挂载到 window 对象

**解决：**
1. 确保回调函数使用唯一名称（如添加时间戳）
2. 检查 Android Bridge 的 JavaScript 调用逻辑
3. 在 Console 中手动测试回调函数

### 5. ID Token 验证失败

**问题：** 后端 API 返回 "Invalid token"

**原因：**
- Client ID 配置错误
- Token 已过期
- 使用了错误的 Client ID（Web 客户端 ID 而非 Android 客户端 ID）

**解决：**
1. 确认 `.env.local` 中的 `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 是 Android 客户端 ID
2. 检查后端 API 的 Client ID 配置
3. 使用 [jwt.io](https://jwt.io/) 解码 ID Token 检查 `aud` 字段

### 6. 数据库触发器未创建 Profile

**问题：** 后端等待 profile 创建超时

**原因：**
- 数据库触发器未正确配置
- `user_metadata` 字段格式不正确

**解决：**
1. 检查数据库触发器是否存在：
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

2. 验证触发器函数：
```sql
SELECT proname, prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

3. 确保 Admin API 创建用户时传递了正确的 `user_metadata`：
```typescript
user_metadata: {
  full_name: displayName,
  avatar_url: picture,
  provider: 'google',
}
```

### 7. RLS 策略阻止操作

**问题：** "new row violates row-level security policy"

**原因：** 使用普通 Supabase 客户端尝试创建 profile

**解决：** 使用 Service Role 客户端绕过 RLS
```typescript
const serviceClient = createServiceClient();
// 使用 serviceClient 进行数据库操作
```

### 8. 重复键冲突

**问题：** "duplicate key value violates unique constraint 'profiles_pkey'"

**原因：** 竞态条件，profile 已被触发器创建

**解决：** 完全依赖数据库触发器，不手动创建 profile

## 📊 工作流程图

```
用户点击"Google 登录"
    ↓
检测环境（isAndroidWebView）
    ↓
┌─────────────┬─────────────┐
│ Android     │ 浏览器      │
│ WebView     │             │
└─────────────┴─────────────┘
    ↓              ↓
调用 Bridge    Supabase OAuth
    ↓              ↓
原生账号选择器  跳转 Google
    ↓              ↓
返回 idToken   返回 callback
    ↓              ↓
调用后端 API   Supabase 处理
    ↓              ↓
验证 Token     创建会话
    ↓              ↓
使用 Admin API 创建用户
    ↓
等待数据库触发器创建 profile
    ↓
创建自定义 JWT session
    ↓              ↓
返回用户信息   返回用户信息
    ↓              ↓
保存到 localStorage
    ↓              ↓
调用 updateUser() 更新 AuthContext
    ↓              ↓
跳转首页       跳转首页
    ↓              ↓
用户信息立即显示
```

## 🔑 关键实现细节

### 1. 状态管理架构

**问题：** 登录成功后用户信息不立即显示

**原因：** AuthContext 只在初始化时从 localStorage 读取，登录后保存的数据不会自动更新到 Context

**解决方案：**
1. 在 AuthContext 中添加 `updateUser()` 方法
2. 登录成功后立即调用 `updateUser()` 更新状态
3. 同时保存到 localStorage 以支持页面刷新

**代码实现：**

```typescript
// context/AuthContext.tsx
const updateUser = useCallback((newUser: User | DomesticUser | null) => {
  setUser(newUser);
}, []);

// 在 value 中暴露
const value = useMemo(() => ({
  user,
  session,
  loading,
  signIn,
  signUp,
  signOut,
  refreshSession,
  updateUser,  // ✅ 新增
}), [user, session, loading, signIn, signUp, signOut, refreshSession, updateUser]);
```

```typescript
// components/auth-page.tsx
const { updateUser } = useAuth();

// 登录成功后
if (data.session && data.user) {
  // 1. 保存到 localStorage
  saveAuthState(
    data.session.access_token,
    data.session.refresh_token,
    data.user,
    { ... }
  );

  // 2. 立即更新 AuthContext
  updateUser(data.user);  // ✅ 关键步骤

  // 3. 跳转到首页
  router.push(next);
}
```

### 2. 数据库触发器依赖

**重要：** 后端不手动创建 profile，完全依赖数据库触发器

**原因：**
- 避免竞态条件（race condition）
- 确保数据一致性
- 利用数据库的 `ON CONFLICT` 处理重复

**实现：**
```typescript
// app/api/auth/google-native/route.ts

// 1. 使用 Admin API 创建 auth 用户
const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
  email: payload.email!,
  email_confirm: true,
  user_metadata: {
    full_name: displayName || payload.name,
    avatar_url: payload.picture,
    provider: 'google',
  },
});

// 2. 等待触发器创建 profile（最多 5 秒）
let profile = null;
for (let i = 0; i < 10; i++) {
  await new Promise(resolve => setTimeout(resolve, 500));
  const { data: fetchedProfile } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();
  if (fetchedProfile) {
    profile = fetchedProfile;
    break;
  }
}
```

### 3. 双 OAuth 客户端架构

**为什么需要两个 OAuth 客户端？**

| 客户端类型 | 用途 | 使用场景 |
|-----------|------|---------|
| **Android 客户端** | 验证来自 Android Native SDK 的 ID Token | Android WebView 环境 |
| **Web 客户端** | Supabase OAuth 流程 | 浏览器环境 |

**配置要点：**
- Android 客户端需要 SHA-1 证书指纹
- Web 客户端需要重定向 URI
- 两者的 Client ID 不同，不可混用

### 4. 环境检测逻辑

```typescript
// 检测是否在 Android WebView 中
const isAndroidWebView = typeof window !== 'undefined' && !!(window as any).GoogleSignIn;

if (isAndroidWebView) {
  // 使用 Android Native Google Sign-In
  const { signInWithGoogle } = await import('@/lib/google-signin-bridge');
  const result = await signInWithGoogle(clientId);
  // 调用后端 API 验证
} else {
  // 使用 Supabase OAuth
  await signInWithGoogle();
}
```

## 🎯 验收标准

在 Android WebView 环境中：
- ✅ 点击"Google 登录"按钮后，显示原生账号选择器（不是网页）
- ✅ 选择账号后，无需输入密码（使用系统已登录的账号）
- ✅ 登录成功后，正确跳转到首页
- ✅ 用户信息正确显示（邮箱、姓名、头像）
- ✅ **用户信息立即显示（无需刷新页面）** ⭐
- ✅ 刷新页面后，登录状态保持
- ✅ 不会出现 403 错误

在浏览器环境中：
- ✅ 点击"Google 登录"按钮后，跳转到 Google 登录页面
- ✅ 使用 Supabase OAuth 流程完成登录
- ✅ 登录成功后，正确跳转到首页

## 💡 最佳实践

### 1. 状态管理

**推荐做法：**
```typescript
// ✅ 登录成功后立即更新状态
saveAuthState(...);           // 保存到 localStorage
updateUser(data.user);        // 立即更新 Context
router.push(next);            // 跳转页面

// ❌ 错误做法：只保存不更新
saveAuthState(...);
router.push(next);            // 用户信息不会立即显示
```

### 2. 错误处理

**推荐做法：**
```typescript
try {
  const result = await signInWithGoogle(clientId);
  // 处理成功
} catch (error) {
  // 根据错误类型提供友好提示
  if (error.message.includes('User cancelled')) {
    // 用户取消，不显示错误
  } else {
    toast.error('登录失败，请重试');
  }
}
```

### 3. 环境检测

**推荐做法：**
```typescript
// ✅ 使用专用函数检测
import { isAndroidWebView } from '@/lib/google-signin-bridge';

if (isAndroidWebView()) {
  // Android Native 登录
} else {
  // Supabase OAuth
}

// ❌ 错误做法：直接检查 window 对象
if (window.GoogleSignIn) { ... }
```

### 4. 数据库操作

**推荐做法：**
```typescript
// ✅ 依赖数据库触发器
const { data: authData } = await serviceClient.auth.admin.createUser({
  email: payload.email,
  user_metadata: { full_name, avatar_url }
});

// 等待触发器创建 profile
for (let i = 0; i < 10; i++) {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();
  if (profile) break;
  await new Promise(resolve => setTimeout(resolve, 500));
}

// ❌ 错误做法：手动创建 profile
await serviceClient.from('profiles').insert({ ... });  // 可能导致竞态条件
```

### 5. 安全性

**推荐做法：**
- 后端验证所有 ID Token
- 使用环境变量管理敏感信息
- 使用 Service Role 客户端时要谨慎
- 不在前端暴露 Service Role Key

**环境变量配置：**
```env
# ✅ 正确：使用环境变量
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
SUPABASE_SERVICE_ROLE_KEY=xxx

# ❌ 错误：硬编码在代码中
const clientId = "xxx.apps.googleusercontent.com";
```

## 📚 相关文档

- [完整集成文档](D:\Software\Code\Work\APP\MornClient\EN\android\GOOGLE_SIGNIN_INTEGRATION.md)
- [Google Sign-In for Android](https://developers.google.com/identity/sign-in/android/start)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

## 🔐 安全建议

1. **保护 Client ID**
   - 不要在公开代码中硬编码 Client ID
   - 使用环境变量管理

2. **验证 ID Token**
   - 后端必须验证 Google ID Token 的有效性
   - 检查 audience、issuer、expiration

3. **HTTPS 通信**
   - 生产环境必须使用 HTTPS
   - 配置正确的 SSL 证书

4. **Token 存储**
   - 不要在 localStorage 中存储敏感 Token
   - 使用 HttpOnly Cookie 或安全存储

## ✅ 最终检查清单

在部署到生产环境前，确保：

### Google Cloud 配置
- [ ] Google Cloud Console 中已创建 Android OAuth 客户端
- [ ] SHA-1 证书指纹已正确配置（Debug 和 Release）
- [ ] Google Cloud Console 中已创建 Web OAuth 客户端
- [ ] Web OAuth 客户端已配置正确的重定向 URI

### 环境变量配置
- [ ] `.env.local` 中已配置 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`（Android 客户端 ID）
- [ ] `.env.local` 中已配置 `SUPABASE_SERVICE_ROLE_KEY`
- [ ] 环境变量在生产环境中正确设置

### Supabase 配置
- [ ] Supabase 中已启用 Google 提供商
- [ ] Supabase Google 提供商使用 Web OAuth 客户端凭据
- [ ] 数据库触发器 `handle_new_user` 已正确配置
- [ ] `profiles` 表结构正确（id, email, name, avatar 字段）

### Android 应用配置
- [ ] Android 应用已正确注册 JavaScript Bridge
- [ ] `GoogleSignInHelper.java` 和 `GoogleSignInBridge.java` 已添加
- [ ] MainActivity 中已添加 Bridge 注册代码
- [ ] `build.gradle` 中已添加 `play-services-auth` 依赖

### Web 应用配置
- [ ] `lib/google-signin-bridge.ts` 已创建
- [ ] `components/auth-page.tsx` 中已集成 Android 原生登录
- [ ] `app/api/auth/google-native/route.ts` 已创建
- [ ] `context/AuthContext.tsx` 中已添加 `updateUser()` 方法
- [ ] `lib/auth-state-manager.ts` 已创建
- [ ] 已安装 `google-auth-library` 依赖

### 功能测试
- [ ] 在真实 Android 设备上测试通过
- [ ] 在浏览器环境中测试通过（Supabase OAuth）
- [ ] 登录后用户信息立即显示（无需刷新）
- [ ] 刷新页面后登录状态保持
- [ ] 日志中无错误信息
- [ ] 用户体验流畅，无卡顿

### 安全检查
- [ ] 后端正确验证所有 ID Token
- [ ] Service Role Key 未暴露在前端
- [ ] 敏感信息使用环境变量管理
- [ ] 生产环境使用 HTTPS

---

## 📝 快速参考

### 关键文件路径

**Android 端：**
- [GoogleSignInHelper.java](D:\Software\Code\Work\APP\MornClient\EN\android\app\src\main\java\co\median\android\GoogleSignInHelper.java)
- [GoogleSignInBridge.java](D:\Software\Code\Work\APP\MornClient\EN\android\app\src\main\java\co\median\android\GoogleSignInBridge.java)
- [MainActivity.java](D:\Software\Code\Work\APP\MornClient\EN\android\app\src\main\java\co\median\android\MainActivity.java)

**Web 端：**
- [lib/google-signin-bridge.ts](D:\Software\Code\Work\demo\mvp34\lib\google-signin-bridge.ts)
- [components/auth-page.tsx](D:\Software\Code\Work\demo\mvp34\components\auth-page.tsx)
- [app/api/auth/google-native/route.ts](D:\Software\Code\Work\demo\mvp34\app\api\auth\google-native\route.ts)
- [context/AuthContext.tsx](D:\Software\Code\Work\demo\mvp34\context\AuthContext.tsx)
- [lib/auth-state-manager.ts](D:\Software\Code\Work\demo\mvp34\lib\auth-state-manager.ts)

### 环境变量模板

```env
# Google OAuth（Android 客户端 ID）
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx-xxx.apps.googleusercontent.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### 常用调试命令

```bash
# 查看 Android 日志
adb logcat | grep -E "GoogleSignIn|MainActivity"

# 远程调试 WebView
chrome://inspect

# 测试 Bridge
window.GoogleSignIn.signIn('client_id', 'callback')

# 检查认证状态
localStorage.getItem('app-auth-state')
```

---

**集成完成！** 🎉

现在你的应用已经完全支持在 Android WebView 中使用原生 Google Sign-In SDK 进行登录，同时在浏览器环境中使用 Supabase OAuth 流程。用户登录后信息会立即显示，无需刷新页面。
