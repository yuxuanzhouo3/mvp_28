# MornGPT

一个支持国内/国际双版本的 AI 聊天应用，基于 Next.js 15 构建。

## 功能特性

### 双版本架构

| 特性 | 国内版 (zh) | 国际版 (en) |
|------|------------|------------|
| 数据库 | 腾讯云 CloudBase | Supabase |
| 用户认证 | 微信扫码登录 | Google OAuth |
| 支付方式 | 微信支付 / 支付宝 | Stripe / PayPal |
| AI 模型 | 阿里云 DashScope (通义千问) | Mistral AI |
| 文件存储 | CloudBase 云存储 | Supabase Storage |

### 核心功能

- **AI 聊天**: 支持流式响应、多轮对话、上下文记忆
- **多模态**: 支持图片、视频、音频输入 (国内版)
- **17 个专家模型**: 心理咨询、法律顾问、健身教练等垂直领域
- **订阅系统**: Basic / Pro / Enterprise 三档套餐
- **加油包**: 永久额度，支持图片和视频/音频
- **配额管理**: FEFO (先过期先扣) 扣费策略
- **管理后台**: 广告管理、社交链接管理

## 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + shadcn/ui
- **状态管理**: React Context
- **表单**: React Hook Form + Zod
- **国内数据库**: 腾讯云 CloudBase
- **国际数据库**: Supabase (PostgreSQL)
- **支付集成**: Stripe, PayPal, 微信支付, 支付宝

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入必要的配置：

```bash
# 选择版本: zh (国内版) | en (国际版)
NEXT_PUBLIC_DEFAULT_LANGUAGE=zh

# 管理后台密钥 (必须修改!)
ADMIN_SESSION_SECRET=your-random-secret-key
```

详细配置说明见 [.env.example](.env.example)。

### 3. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

## 项目结构

```
mvp28-fix/
├── app/                    # Next.js App Router
│   ├── (chat)/            # 聊天页面
│   ├── admin/             # 管理后台
│   ├── api/               # API 路由
│   │   ├── domestic/      # 国内版 API
│   │   ├── international/ # 国际版 API
│   │   └── payment/       # 支付相关 API
│   ├── auth/              # 认证页面
│   └── payment/           # 支付结果页面
├── components/            # React 组件
│   └── ui/               # shadcn/ui 组件
├── constants/             # 常量配置
│   ├── pricing.ts        # 套餐定价
│   ├── addon-packages.ts # 加油包配置
│   └── expert-models.ts  # 专家模型定义
├── lib/                   # 工具库
│   ├── cloudbase/        # CloudBase 集成
│   ├── supabase/         # Supabase 集成
│   └── payment/          # 支付处理
├── services/              # 业务服务
│   ├── wallet.ts         # 国内版钱包服务
│   └── wallet-supabase.ts # 国际版钱包服务
├── supabase/              # Supabase 配置
│   └── migrations/       # 数据库迁移
└── utils/                 # 工具函数
```

## 定价配置

### 订阅套餐

| 套餐 | 月付 | 年付 (月均) | 每日外部模型 | 月图片 | 月视频/音频 |
|------|------|------------|------------|--------|------------|
| Free | - | - | 10 | 30 | 5 |
| Basic | $9.98 / ￥29.90 | $6.99 / ￥20.90 | 50 | 100 | 20 |
| Pro | $39.98 / ￥99.90 | $27.99 / ￥69.90 | 200 | 500 | 100 |
| Enterprise | $99.98 / ￥199.90 | $69.99 / ￥139.90 | 2000 | 1500 | 200 |

### 加油包 (永久额度)

| 档位 | 价格 | 图片 | 视频/音频 |
|------|------|------|----------|
| Starter | $3.98 / ￥9.9 | 30 | 5 |
| Standard | $9.98 / ￥29.9 | 100 | 20 |
| Premium | $29.98 / ￥69.9 | 300 | 60 |

## 数据库设置

### Supabase (国际版)

1. 创建 Supabase 项目
2. 运行 `supabase/migrations/` 中的迁移文件
3. 配置环境变量

### CloudBase (国内版)

需要创建以下集合：
- `users` - 用户信息
- `conversations` - 会话
- `messages` - 消息
- `subscriptions` - 订阅
- `payments` - 支付记录
- `webhook_events` - Webhook 事件

## 支付配置

### 微信支付 (国内版)

1. 申请微信支付商户号
2. 配置 API v3 密钥
3. 上传商户证书
4. 设置回调地址: `https://yourdomain.com/api/payment/webhook/wechat`

### 支付宝 (国内版)

1. 创建支付宝开放平台应用
2. 配置 RSA 密钥对
3. 设置回调地址: `https://yourdomain.com/api/payment/webhook/alipay`

### Stripe (国际版)

1. 创建 Stripe 账号
2. 获取 API 密钥
3. 配置 Webhook: `https://yourdomain.com/api/payment/stripe/webhook`
4. 监听事件: `checkout.session.completed`, `invoice.payment_succeeded`

### PayPal (国际版)

1. 创建 PayPal 开发者账号
2. 创建 REST API 应用
3. 获取 Client ID 和 Secret

## 部署

### Vercel (推荐)

```bash
vercel deploy
```

### Docker

```bash
docker build -t morngpt .
docker run -p 3000:3000 morngpt
```

## 管理后台

访问 `/admin/login` 进入管理后台。
注意：管理后台登录依赖 Supabase（`admin_users` 表）。即使部署为国内版（`NEXT_PUBLIC_DEFAULT_LANGUAGE=zh`），也需要配置 `SUPABASE_URL`（或 `NEXT_PUBLIC_SUPABASE_URL`）与 `SUPABASE_SERVICE_ROLE_KEY`（仅服务端）。

功能：
- 广告位管理 (增删改查、图片上传)
- 社交链接管理

## 环境变量说明

详见 [.env.example](.env.example)，包含：

- 基础配置 (APP_URL, NODE_ENV, LANGUAGE)
- 数据库配置 (Supabase / CloudBase)
- 认证配置 (微信 / Google OAuth)
- 支付配置 (微信支付 / 支付宝 / Stripe / PayPal)
- AI 模型配置 (DashScope / Mistral)
- 配额设置 (各套餐限额)
- 文件上传限制

## 安全注意事项

- **生产环境必须修改** `ADMIN_SESSION_SECRET`
- **生产环境设置** `GEO_FAIL_CLOSED=true`
- **生产环境设置** `PAYPAL_SKIP_SIGNATURE_VERIFICATION=false`
- **生产环境关闭** 支付宝沙箱模式
- `.env.local` 已在 `.gitignore` 中，不会被提交

## 许可证

Copyright © 2025 Yuxuan Zhou. All rights reserved.
