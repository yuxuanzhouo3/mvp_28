# 多平台 API 调度与调用策略文档

## 1. 概述

本系统支持 17 家 AI API 提供商，涵盖 **文本/对话（LLM）**、**图片生成（Text2Image）**、**语音转文字（STT）**、**文字转语音（TTS）**、**多模态** 五大任务类型。
通过**统一调度器**，可按优先级顺序自动切换 API，优先使用免费额度，保障服务稳定，同时节省成本。

---

## 2. API 优先级表

### 2.1 文本 / 对话类（LLM）

| 优先级 | 提供商            | 模型/说明          | 免费额度           | 特点    |
| --- | -------------- | -------------- | -------------- | ----- |
| 1   | Groq           | LLaMA 3        | 日限宽松           | 延迟极低  |
| 2   | Mistral API    | mixtral-8x7b   | 免费调用           | 稳定    |
| 3   | Cohere         | Command R+     | 每月 5 万 tokens  | 对话优化  |
| 4   | Together AI    | Mixtral 等      | 每月 5 万 tokens  | 多模型   |
| 5   | AI21 Labs      | Jamba          | 每月 10 万 tokens | 长文本   |
| 6   | OpenRouter     | 聚合多平台          | 活动额度           | 灵活    |
| 7   | Google Gemini  | 1.5 Flash      | 每日免费           | 多模态支持 |
| 8   | DeepInfra      | LLaMA 系        | 约 1 万 tokens   | 延迟低   |
| 9   | Fireworks AI   | LLaMA / SDXL   | 额度不定           | 免费随活动 |
| 10  | Anthropic      | Claude 3 Haiku | 新号免费           | 高质量对话 |
| 11  | OpenAI         | GPT-4o-mini    | 新号免费           | 广泛应用  |
| 12  | Perplexity API | RAG 搜索问答       | 免费             | 带搜索能力 |

---

### 2.2 图片生成类（Text → Image）

| 优先级 | 提供商          | 模型        | 免费额度     | 特点  |
| --- | ------------ | --------- | -------- | --- |
| 1   | Stability AI | SDXL      | 每月 25 次  | 高质量 |
| 2   | Replicate    | 多模型       | 每月 500 次 | 灵活  |
| 3   | DeepInfra    | SDXL      | 免费调用     | 延迟低 |
| 4   | HuggingFace  | Diffusion | 限速       | 多模型 |
| 5   | Fireworks AI | SDXL 等    | 免费额度变化   | 活动多 |

---

### 2.3 语音转文字（STT）

| 优先级 | 提供商         | 模型             | 免费额度    | 特点   |
| --- | ----------- | -------------- | ------- | ---- |
| 1   | AssemblyAI  | Transcribe     | 每月 5 小时 | 精度高  |
| 2   | Gladia      | Speech-to-Text | 每月 1 小时 | 多语言  |
| 3   | HuggingFace | Whisper        | 限速      | 开源模型 |

---

### 2.4 文字转语音（TTS）

| 优先级 | 提供商        | 模型      | 免费额度       | 特点   |
| --- | ---------- | ------- | ---------- | ---- |
| 1   | Play.ht    | 高保真 TTS | 每月 2.5 万字符 | 音质好  |
| 2   | ElevenLabs | 高保真 TTS | 每月 1 万字符   | 自然音色 |

---

### 2.5 多模态（图文/视频/音频混合）

| 优先级 | 提供商           | 模型         | 免费额度 | 特点    |
| --- | ------------- | ---------- | ---- | ----- |
| 1   | Google Gemini | Pro Vision | 免费调用 | 图文视频  |
| 2   | Replicate     | 多模态模型      | 免费调用 | 视频+图像 |
| 3   | Gladia        | 音频 + 文本    | 免费调用 | 语音多模态 |

---

## 3. 调度策略

* **任务分类**：text, image, stt, tts, multimodal
* **优先级顺序调用**：

  1. 从优先级第一的 API 开始调用
  2. 如果返回额度不足/报错，自动切换到下一个
* **额度管理**：

  * 在本地 `quota.json` 文件记录每个 API 剩余额度
  * 每次调用更新
  * 每日限额 API（Groq、Gemini）每天 0 点重置
* **灵活调整**：

  * 支持配置文件自定义优先级
  * 方便根据活动/成本动态调整

---

## 4. 环境变量配置（`.env`）

```env
# 核心 API Key（18 个）
OPENAI_API_KEY=
GOOGLE_GEMINI_API_KEY=
COHERE_API_KEY=
GROQ_API_KEY=
HUGGINGFACE_API_KEY=
FIREWORKS_API_KEY=
DEEPINFRA_API_KEY=
REPLICATE_API_KEY=
MISTRAL_API_KEY=
TOGETHER_API_KEY=
AI21_API_KEY=
OPENROUTER_API_KEY=
ANTHROPIC_API_KEY=
PERPLEXITY_API_KEY=
STABILITY_API_KEY=
ASSEMBLYAI_API_KEY=
GLADIA_API_KEY=
ELEVENLABS_API_KEY=
```

---

## 5. 调用逻辑流程图

```
         [任务请求]
               ↓
      ┌─────────────────┐
      │ 判断任务类型     │
      └─────────────────┘
               ↓
   [读取对应优先级 API 列表]
               ↓
   ┌───────────────────────────┐
   │ 依次尝试调用 API           │
   │ 成功 → 返回结果            │
   │ 失败/额度不足 → 下一个 API │
   └───────────────────────────┘
               ↓
         [记录调用与剩余额度]
```

---

## 6. 部署建议

1. **本地测试**：使用 `.env.development`
2. **生产部署**：使用 `.env.production`，禁用测试 API Key
3. **定时任务**：

   * 每天重置每日限额 API 状态
   * 每周检查免费额度剩余
4. **监控**：

   * 接口失败率
   * API 调用量和消耗情况
