# 环境变量配置说明

## Free 用户配额配置（国内版分级策略）

在 `.env.local` 或服务器环境变量中添加以下配置：

```bash
# 版本配置
NEXT_PUBLIC_DEFAULT_LANGUAGE=zh  # zh=国内版, en=国际版

# =============================================================================
# Free 用户配额配置
# =============================================================================

# 外部模型每日文本对话次数限制
# 适用模型: qwen3-max、qwen-plus、qwen-flash、qwen3-coder-plus、qwen3-coder-flash、
#          deepseek-r1、deepseek-v3、deepseek-v3.1、deepseek-v3.2-exp、Moonshot-Kimi-K2-Instruct、glm-4.6
# 默认值: 10
NEXT_PUBLIC_FREE_DAILY_LIMIT=10

# 高级多模态模型（Qwen3-Omni-Flash）每月图片额度
# 每张图片消耗 1 次额度
# 默认值: 30
NEXT_PUBLIC_FREE_MONTHLY_PHOTO_LIMIT=30

# 高级多模态模型（Qwen3-Omni-Flash）每月视频/音频额度
# 每个视频或音频消耗 1 次额度
# 默认值: 5
NEXT_PUBLIC_FREE_MONTHLY_VIDEO_AUDIO_LIMIT=5

# Free 用户上下文消息限制
# 注意：这是单次请求的参数限制，非消耗型配额
# 限制每次对话携带的历史消息数量
# 默认值: 10
NEXT_PUBLIC_FREE_CONTEXT_MSG_LIMIT=10

# =============================================================================
# Basic 用户配额配置
# =============================================================================

# Basic 用户月度配额
# 默认值: 100
NEXT_PUBLIC_BASIC_MONTHLY_LIMIT=100
```

## 模型分类说明

### 通用模型（无限制）
Free 用户可无限使用以下模型：
- `qwen-turbo` - 作为 General Model 展示，后台仍使用 qwen-turbo 调用

### 外部模型（每日配额）
受 `NEXT_PUBLIC_FREE_DAILY_LIMIT` 限制：
- `qwen3-max` - 通义千问旗舰模型
- `qwen-plus` - 高性价比通用模型
- `qwen-flash` - 轻量极速模型
- `qwen3-coder-plus` - 代码增强版本
- `qwen3-coder-flash` - 极速代码模型
- `deepseek-r1` - 深度推理模型
- `deepseek-v3` - 第三代通用模型
- `deepseek-v3.1` - V3.1 增强版
- `deepseek-v3.2-exp` - V3.2 实验版
- `Moonshot-Kimi-K2-Instruct` - Kimi 文本增强模型
- `glm-4.6` - 智谱 GLM 4.6

### 高级多模态模型（月度媒体配额）
受月度媒体配额限制：
- `qwen3-omni-flash` - 多模态极速模型
  - 纯文本对话：计入 `NEXT_PUBLIC_FREE_DAILY_LIMIT`
  - 图片交互：消耗图片配额
  - 视频/音频交互：消耗视频/音频配额

## 配额重置时间

| 配额类型 | 重置时间 | 说明 |
|---------|---------|------|
| 每日配额 | UTC 0:00 (北京时间 8:00) | 自动通过日期字段区分 |
| 月度配额 | 每月 1 日 UTC 0:00 | 自动通过月份字段区分 |

## 前端提示文案

### 通用模型
显示: **"无限畅聊"**

### 外部模型
显示: **"今日剩余: X/10"**

### 高级多模态模型
显示: **"本月剩余图片: X | 视频: Y"**

### 上下文截断提示
当对话过长时显示: **"已仅保留最近 10 条消息作为上下文记忆"**
