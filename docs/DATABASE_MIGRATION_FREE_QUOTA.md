# CloudBase 数据库迁移说明：Free 用户分级配额系统

## 概述

本文档描述了国内版（`NEXT_PUBLIC_DEFAULT_LANGUAGE=zh`）Free 用户配额管理系统的数据库变更。

## 集合更新：`free_quotas`

### 原有字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `_id` | String | 文档 ID |
| `userId` | String | 用户 ID |
| `day` | String | 日期 (YYYY-MM-DD)，用于每日配额 |
| `used` | Number | 已使用次数（原有字段，保留兼容） |
| `limit_per_day` | Number | 每日限制 |
| `updatedAt` | String | 更新时间 (ISO 8601) |

### 新增字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `daily_count` | Number | 外部模型每日使用次数（替代 `used` 用于外部模型） |
| `month` | String | 月份 (YYYY-MM)，用于月度配额 |
| `month_used_photo` | Number | 高级多模态模型本月图片使用次数 |
| `month_used_video_audio` | Number | 高级多模态模型本月视频/音频使用次数 |

### Schema 设计

```javascript
// free_quotas 集合完整 Schema
{
  _id: String,                    // 文档 ID（自动生成）
  userId: String,                 // 用户 ID（必填）
  
  // === 每日配额（外部模型）===
  day: String,                    // 日期 "YYYY-MM-DD"
  daily_count: Number,            // 外部模型每日已用次数
  limit_per_day: Number,          // 每日限制（可选，用于记录）
  
  // === 每月媒体配额（高级多模态模型）===
  month: String,                  // 月份 "YYYY-MM"
  month_used_photo: Number,       // 本月图片已用次数
  month_used_video_audio: Number, // 本月视频/音频已用次数
  
  // === 元数据 ===
  updatedAt: String,              // 更新时间 ISO 8601
  
  // === 兼容旧版 ===
  used: Number,                   // 保留兼容，新版使用 daily_count
}
```

## 配额重置逻辑

### 每日配额（外部模型）
- **重置时间**: 每日 UTC 0:00（北京时间 8:00）
- **重置方式**: 通过 `day` 字段自动区分，无需手动清理
- **查询条件**: `{ userId, day: "YYYY-MM-DD" }`

### 月度配额（高级多模态模型）
- **重置时间**: 每月 1 日 UTC 0:00
- **重置方式**: 通过 `month` 字段自动区分，无需手动清理
- **查询条件**: `{ userId, month: "YYYY-MM" }`

### 高级多模态纯文本请求
- 向多模态模型发送纯文本时，计入 `NEXT_PUBLIC_FREE_DAILY_LIMIT`（与外部文本模型共用每日额度）
- 发送图片、视频、音频时，计入对应的月度媒体额度

## 原子更新操作示例

### 扣除外部模型每日配额

```javascript
const db = connector.getClient();
const today = new Date().toISOString().split("T")[0]; // "2025-12-12"

// 1. 查询当日配额
const existing = await db.collection("free_quotas")
  .where({ userId, day: today })
  .limit(1)
  .get();

const quotaRow = existing?.data?.[0];
const dailyCount = quotaRow?.daily_count ?? 0;

// 2. 检查是否超限
const dailyLimit = parseInt(process.env.NEXT_PUBLIC_FREE_DAILY_LIMIT || "10");
if (dailyCount >= dailyLimit) {
  throw new Error("Daily quota exceeded");
}

// 3. 原子更新
const newCount = dailyCount + 1;
const payload = {
  userId,
  day: today,
  daily_count: newCount,
  updatedAt: new Date().toISOString(),
};

if (quotaRow?._id) {
  await db.collection("free_quotas").doc(quotaRow._id).update(payload);
} else {
  await db.collection("free_quotas").add(payload);
}
```

### 扣除高级多模态模型月度媒体配额

```javascript
const db = connector.getClient();
const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // "2025-12"

// 1. 查询本月配额
const existing = await db.collection("free_quotas")
  .where({ userId, month: currentMonth })
  .limit(1)
  .get();

const quotaRow = existing?.data?.[0];
const monthUsedPhoto = quotaRow?.month_used_photo ?? 0;
const monthUsedVideoAudio = quotaRow?.month_used_video_audio ?? 0;

// 2. 检查是否超限
const photoLimit = parseInt(process.env.NEXT_PUBLIC_FREE_MONTHLY_PHOTO_LIMIT || "30");
const videoAudioLimit = parseInt(process.env.NEXT_PUBLIC_FREE_MONTHLY_VIDEO_AUDIO_LIMIT || "5");

const imageCount = 1; // 本次请求的图片数量
const videoAudioCount = 0; // 本次请求的视频/音频数量

if (monthUsedPhoto + imageCount > photoLimit) {
  throw new Error("Monthly photo quota exceeded");
}
if (monthUsedVideoAudio + videoAudioCount > videoAudioLimit) {
  throw new Error("Monthly video/audio quota exceeded");
}

// 3. 原子更新
const payload = {
  userId,
  month: currentMonth,
  month_used_photo: monthUsedPhoto + imageCount,
  month_used_video_audio: monthUsedVideoAudio + videoAudioCount,
  updatedAt: new Date().toISOString(),
};

if (quotaRow?._id) {
  await db.collection("free_quotas").doc(quotaRow._id).update(payload);
} else {
  await db.collection("free_quotas").add(payload);
}
```

## 索引建议

为了优化查询性能，建议在 CloudBase 控制台创建以下复合索引：

```javascript
// 索引 1: 每日配额查询
{
  "userId": 1,
  "day": -1
}

// 索引 2: 月度配额查询
{
  "userId": 1,
  "month": -1
}
```

## 环境变量配置

在 `.env.local` 或服务器环境变量中添加：

```bash
# 外部模型每日文本对话次数限制
NEXT_PUBLIC_FREE_DAILY_LIMIT=10

# 高级多模态模型每月图片额度
NEXT_PUBLIC_FREE_MONTHLY_PHOTO_LIMIT=30

# 高级多模态模型每月视频/音频额度
NEXT_PUBLIC_FREE_MONTHLY_VIDEO_AUDIO_LIMIT=5

# Free 用户上下文消息限制（非消耗型）
NEXT_PUBLIC_FREE_CONTEXT_MSG_LIMIT=10
```

## 模型分类

### 通用模型（无限制）
- `qwen-plus`
- `qwen-turbo`
- `qwen-flash`
- `qwen3-coder-plus`
- `qwen3-coder-flash`

### 外部模型（每日配额）
- `qwen3-max`
- `deepseek-r1`
- `deepseek-v3`
- `deepseek-v3.1`
- `deepseek-v3.2-exp`
- `Moonshot-Kimi-K2-Instruct`
- `glm-4.6`

### 高级多模态模型（月度媒体配额）
- `qwen3-omni-flash`

## 迁移步骤

1. **部署新代码**: 无需数据库迁移脚本，新字段会在首次使用时自动创建
2. **配置环境变量**: 添加上述环境变量
3. **创建索引**: 在 CloudBase 控制台创建推荐的复合索引
4. **测试验证**: 使用不同类型的模型测试配额逻辑

## 向后兼容

- 旧版 `used` 字段保留，新版代码会同时检查 `daily_count` 和 `used`
- 如果 `daily_count` 不存在，回退到 `used` 字段
- 新版写入时使用 `daily_count`，确保渐进式迁移
