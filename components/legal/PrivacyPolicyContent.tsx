"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PrivacyPolicyContentProps {
  isDomestic: boolean;
}

// 国内版隐私条款完整内容
const PRIVACY_POLICY_CN = `# 隐私条款（国内版）

**适用版本**：MornGPT 国内版

**合规法规**：《中华人民共和国个人信息保护法》(PIPL)、《网络安全法》、《数据安全法》

**生效日期**：2025年12月23日

**更新日期**：2025年12月23日

---

MornGPT（以下简称"我们"）非常重视您的隐私。本政策适用于您通过 Android、iOS、Windows、Mac 客户端及网页端使用我们的产品与服务。

---

## 一、我们如何收集和使用您的信息

### 1.1 账号注册与登录

#### 1.1.1 邮箱登录
当您使用邮箱注册或登录时，我们将收集以下信息：
- **电子邮箱地址**：用于账号注册、登录验证及账户找回
- **加密密码**：使用 bcrypt 算法（salt rounds: 10）单向加密存储，我们无法获取您的明文密码

#### 1.1.2 微信登录
当您使用微信扫码登录时，我们将通过微信开放平台收集以下信息：
- **微信 OpenID**：您在本应用中的唯一标识符
- **微信 UnionID**（如有）：用于同一开放平台账号下的多应用关联
- **微信昵称**：用于展示您的用户名称
- **微信头像**：用于展示您的用户头像

> **法律依据**：收集上述信息是为了履行与您的合同（提供服务），符合《个人信息保护法》第十三条第二款的规定。

### 1.2 核心业务功能与AI模型交互

#### 1.2.1 普通AI对话
您与普通AI模型的对话将按以下方式处理：
- 对话内容将发送至第三方模型服务商API（如阿里云通义千问 Qwen、DeepSeek、月之暗面 Kimi、智谱 GLM 等）进行推理处理
- **我们不会在服务器端长期保留您的聊天内容用于模型训练**
- 对话记录仅在您登录状态下保存至您的账户，用于历史记录查看和会话恢复
- 游客用户的对话记录不会被保存

#### 1.2.2 专家模型服务（特殊条款）

> **重要提示**：我们的服务包含 **17 个特定的专家模型**。当您选择使用这些专家模型时，即表示您**明确同意我们收集并存储该次对话的完整记录**（包括用户输入与AI输出）。

**17个专家模型包括**：

| 编号 | 专家模型名称 | 数据存储说明 |
|:---:|-------------|-------------|
| 1 | Growth Advisory（增长顾问） | 存储对话记录用于优化商业建议 |
| 2 | Interview/Job（面试求职） | 存储对话记录用于优化职业指导 |
| 3 | AI Coder（编程助手） | 存储对话记录用于优化代码建议 |
| 4 | Content Detection（内容检测） | 存储对话记录用于优化检测能力 |
| 5 | Medical Advice（医疗建议） | 存储对话记录用于优化健康建议 |
| 6 | Multi-GPT（多模型协作） | 存储对话记录用于优化协作效果 |
| 7 | AI Lawyer（法律顾问） | 存储对话记录用于优化法律咨询 |
| 8 | Entertainment Advisor（娱乐顾问） | 存储对话记录用于优化推荐系统 |
| 9 | Housing（房产顾问） | 存储对话记录用于优化房产建议 |
| 10 | Person Matching（人员匹配） | 存储对话记录用于优化匹配算法 |
| 11 | AI Teacher（AI教师） | 存储对话记录用于优化教学效果 |
| 12 | Travel Planning（旅行规划） | 存储对话记录用于优化行程建议 |
| 13 | Product Search（产品搜索） | 存储对话记录用于优化搜索结果 |
| 14 | Fashion（时尚顾问） | 存储对话记录用于优化穿搭建议 |
| 15 | Food & Dining（美食顾问） | 存储对话记录用于优化餐饮推荐 |
| 16 | Content Generation（内容生成） | 存储对话记录用于优化生成质量 |
| 17 | AI Protection（AI保护） | 存储对话记录用于优化安全建议 |

**数据使用目的**：
- 优化特定领域的模型表现
- 专家系统的上下文关联分析
- 改进个性化服务质量

**法律依据**：您使用专家模型的行为构成明确同意（《个人信息保护法》第十三条第一款）。

### 1.3 多模态内容处理

#### 1.3.1 图片上传
- 上传的图片将发送至多模态模型（如 \`qwen3-omni-flash\`）进行分析
- 图片存储于云端存储服务（腾讯云 CloudBase）
- **图片仅用于AI分析和您的历史记录查看，不会用于其他商业用途**
- 支持格式：PNG、JPEG、GIF、WebP（单文件最大 100MB）

#### 1.3.2 视频上传
- 上传的视频将用于多模态内容理解
- 视频存储于云端存储服务
- **视频仅用于AI分析和您的历史记录查看，不会用于其他商业用途**
- 支持格式：MP4、MPEG（单文件最大 100MB）

#### 1.3.3 音频上传
- 上传的音频将用于语音识别和内容理解
- 音频存储于云端存储服务
- **音频仅用于AI分析和您的历史记录查看，不会用于其他商业用途**
- 支持格式：MPEG、WAV（单文件最大 100MB）

**文件上传限制**：
- 单次最多上传 10 个文件
- 单个文件最大 100MB
- 总大小不超过 500MB
- 同一次只能上传同类型文件（图片、视频或音频，不可混合）

---

## 二、设备权限调用

为了提供特定功能，我们可能会请求以下敏感权限。**所有权限均需您主动触发才会调用，我们不会在后台私自获取**。

### 2.1 麦克风权限
- **触发方式**：点击输入区域的「语音输入」按钮或「Pro语音对话」按钮
- **用途**：
  - 语音输入：将您的语音转换为文字输入
  - Pro语音对话：实时语音对话功能
- **数据处理**：语音数据将通过浏览器 Web Speech API 或上传至语音识别服务进行处理

### 2.2 摄像头权限
- **触发方式**：点击输入区域的「相机」按钮
- **用途**：
  - 拍照模式：拍摄照片用于AI分析
  - 录像模式：录制视频用于AI分析
  - Pro视频对话：实时视频对话功能
- **数据处理**：拍摄/录制的内容将作为附件发送给AI进行分析

### 2.3 地理位置权限
- **触发方式**：点击输入区域的「位置」按钮
- **用途**：获取您的当前位置，用于通过AI生成基于位置的服务建议
- **数据处理**：
  - 位置信息将附加到您的消息中发送给AI
  - **我们不会长期存储您的位置信息**
  - 您可以随时点击清除位置信息

### 2.4 存储权限
- **用途**：将AI生成的图片、视频、音频保存至本地设备
- **承诺**：我们不会读取您设备上的其他文件

---

## 三、支付与隐私

### 3.1 支持的支付方式

#### 3.1.1 支付宝 (Alipay)
- **收集信息**：订单号、支付时间、支付金额
- **不收集信息**：我们不会获取您的支付宝账号、银行卡信息或支付密码
- **数据传输**：通过支付宝官方SDK与支付宝服务器直接通信
- **隐私政策**：请参阅[支付宝隐私政策](https://render.alipay.com/p/yuyan/180020010001196791/preview.html)

#### 3.1.2 微信支付 (WeChat Pay)
- **收集信息**：订单号、支付时间、支付金额
- **不收集信息**：我们不会获取您的微信支付账号、银行卡信息或支付密码
- **数据传输**：通过微信支付 V3 API 与微信支付服务器直接通信
- **隐私政策**：请参阅[微信支付隐私政策](https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml)

### 3.2 交易记录保留
我们将保留以下交易信息用于售后服务和财务合规：
- 订单唯一标识符
- 支付提供商订单号
- 支付金额和货币类型
- 支付状态和完成时间
- 购买的产品类型（订阅/加油包）

---

## 四、广告与第三方服务

### 4.1 广告展示规则
- **广告位置**：顶部、底部、左侧、右侧、侧边栏、左下角、右下角
- **广告类型**：图片广告、视频广告
- **广告管理**：您可以在设置中选择是否显示广告

### 4.2 订阅用户去广告权益
- Basic/Pro/Enterprise 订阅用户可以在设置中开启「隐藏广告」功能
- 开启后，应用内将不再展示任何广告

### 4.3 广告数据收集
- 我们的广告系统由自有服务器管理
- **我们不会向第三方广告商共享您的个人信息**
- 广告展示基于位置参数，不基于您的个人画像

---

## 五、内容规范与合规

### 5.1 AI生成内容免责声明
> **重要提示**：AI 生成的所有内容（包括文本、图片、代码等）仅供参考，不构成专业的医疗、法律、投资或其他领域的建议。使用AI生成内容产生的任何后果由用户自行承担。

### 5.2 外部模型API说明
- 本应用接入多个第三方AI模型API（阿里云通义千问、DeepSeek、月之暗面Kimi、智谱GLM等）
- 这些外部API的数据处理遵循各服务商的隐私政策
- **普通对话模式下，外部API服务商不会将您的对话用于模型训练**（具体请参阅各服务商隐私政策）

### 5.3 禁止违规信息
请勿向AI发送或诱导AI生成以下内容：
- 违反中华人民共和国法律法规的内容
- 色情、暴力、血腥内容
- 政治敏感信息
- 侵犯他人合法权益的内容
- 其他违反公序良俗的内容

**处理措施**：
- 系统会自动拦截违规关键词
- 多次违规将导致账号封禁
- 我们保留依法向有关部门报告违法行为的权利

---

## 六、聊天记录管理

### 6.1 聊天记录存储
- **登录用户**：聊天记录保存在云端数据库中，可跨设备同步
- **游客用户**：聊天记录仅保存在本地浏览器中，关闭后可能丢失

### 6.2 聊天记录与专家模型的区别
| 对比项 | 普通聊天记录 | 专家模型对话 |
|:-----:|:----------:|:----------:|
| 存储目的 | 供用户查看历史 | 用于模型优化 |
| 数据使用 | 不用于训练 | 可能用于分析 |
| 删除权利 | 可删除 | 需联系客服 |

### 6.3 上下文消息限制
为保证服务质量，不同套餐的上下文消息数量有所限制：
- Free: 最近 10 条消息
- Basic: 最近 50 条消息
- Pro: 最近 100 条消息
- Enterprise: 最近 200 条消息

> 超出限制的历史消息仍保留在数据库中，但不会发送给AI作为上下文。

---

## 七、客户端下载

### 7.1 支持的平台
- **Android**：APK 直接下载安装
- **iOS**：App Store 下载
- **Windows**：EXE 安装包下载
- **Mac**：DMG 安装包下载

### 7.2 下载安全
- 所有下载链接均由官方服务器提供
- 安装包经过数字签名验证
- 请勿从非官方渠道下载，以防安全风险

### 7.3 应用权限说明（客户端）
不同平台的客户端可能请求以下权限：
- **网络访问**：用于与服务器通信
- **存储权限**：用于保存生成的文件
- **麦克风权限**：用于语音输入功能
- **摄像头权限**：用于拍照/录像功能
- **位置权限**：用于获取位置信息（可选）

---

## 八、账户删除

### 8.1 删除入口
设置 → 隐私与安全 → 危险操作 → 删除账户

### 8.2 删除警告
> **危险警告**：删除账户是**不可恢复**的操作。一旦删除，以下数据将被永久清除且无法找回：
> - 账户基本信息（邮箱、昵称、头像）
> - 所有聊天记录和对话历史
> - 书签和自定义提示词
> - **剩余的订阅时长将被作废，不予退款**
> - **剩余的加油包额度将被清空，不予退款**
> - 个人设置和偏好配置
> - 所有上传的图片、视频、音频文件

### 8.3 删除流程
1. 进入「隐私与安全」设置
2. 点击「删除账户」按钮
3. 系统弹出确认对话框，明确告知不可恢复
4. 确认后立即执行删除
5. 删除完成后自动退出登录

---

## 九、您的权利

### 9.1 访问权
您有权访问我们收集的关于您的个人信息。

### 9.2 更正权
您有权更正您的个人信息（如昵称、头像等）。

### 9.3 删除权
您有权要求我们删除您的个人信息（参见第八章）。

### 9.4 导出权
您可以在「隐私与安全」设置中导出您的个人数据。

### 9.5 撤回同意权
您可以随时撤回对非必要权限的授权（如位置权限）。

---

## 十、未成年人保护

本服务不面向 14 周岁以下的儿童。如果您是未成年人的监护人，发现您的孩子向我们提供了个人信息，请联系我们删除。

---

## 十一、隐私政策更新

我们可能会不时更新本隐私政策。更新后的政策将在本页面发布，重大变更将通过应用内通知或电子邮件告知您。

---

## 十二、联系我们

如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：

- **邮箱**：mornscience@gmail.com
- **服务时间**：周一至周五 9:00-18:00

---

**Copyright © 2025 Yuxuan Zhou. [粤ICP备2024281756号-3]**
`;

// 国际版隐私条款完整内容
const PRIVACY_POLICY_EN = `# Privacy Policy (Global Edition)

**Applicable Edition**: MornGPT Global Edition

**Compliance**: GDPR (EU), CCPA (California), COPPA, and other applicable international data protection regulations.

**Effective Date**: December 23, 2025

**Last Updated**: December 23, 2025

---

MornGPT ("we," "us," or "our") is committed to protecting your privacy. This policy applies to our services across Android, iOS, Windows, Mac, and Web platforms.

---

## 1. Data Collection and Usage

### 1.1 Account Registration & Authentication

#### 1.1.1 Email Registration
When you register or sign in with email, we collect:
- **Email address**: For account registration, authentication, and account recovery
- **Encrypted password**: Stored using bcrypt hashing (salt rounds: 10). We cannot access your plain-text password.

#### 1.1.2 Google Sign-In (OAuth)
When you sign in with Google, we collect through Google's OAuth service:
- **Google unique ID**: Your unique identifier within our application
- **Email address**: Associated with your Google account
- **Display name**: Your Google profile name
- **Profile picture**: Your Google avatar (optional)

> **Legal Basis**: We process this data based on contract performance (GDPR Article 6(1)(b)) - providing the service you requested.

### 1.2 AI Model Interaction & Data Handling

#### 1.2.1 General AI Conversations
Your conversations with general AI models are processed as follows:
- Messages are sent to third-party AI API providers (e.g., Mistral AI) for inference
- **We do not store your chat logs on our servers for training purposes**
- Conversation history is saved to your account only when logged in, for viewing history and session recovery
- Guest users' conversations are NOT saved

#### 1.2.2 Expert Model Services (Special Clause)

> **IMPORTANT NOTICE**: Our service includes **17 specialized Expert Models**. By utilizing any of these Expert Models, you **explicitly consent to the collection and archival of your complete dialogue history** (including your input and AI output).

**The 17 Expert Models include**:

| No. | Expert Model Name | Data Storage Purpose |
|:---:|-------------------|----------------------|
| 1 | Growth Advisory | Stored to optimize business recommendations |
| 2 | Interview/Job | Stored to optimize career guidance |
| 3 | AI Coder | Stored to optimize code suggestions |
| 4 | Content Detection | Stored to optimize detection capabilities |
| 5 | Medical Advice | Stored to optimize health recommendations |
| 6 | Multi-GPT | Stored to optimize multi-model collaboration |
| 7 | AI Lawyer | Stored to optimize legal consultation |
| 8 | Entertainment Advisor | Stored to optimize recommendations |
| 9 | Housing | Stored to optimize real estate advice |
| 10 | Person Matching | Stored to optimize matching algorithms |
| 11 | AI Teacher | Stored to optimize teaching effectiveness |
| 12 | Travel Planning | Stored to optimize travel suggestions |
| 13 | Product Search | Stored to optimize search results |
| 14 | Fashion | Stored to optimize style recommendations |
| 15 | Food & Dining | Stored to optimize dining recommendations |
| 16 | Content Generation | Stored to optimize content quality |
| 17 | AI Protection | Stored to optimize security advice |

**Data Usage Purposes**:
- Continuous fine-tuning and contextual accuracy improvement
- Expert system context analysis
- Service quality enhancement

**Legal Basis**: Your use of Expert Models constitutes explicit consent (GDPR Article 6(1)(a)).

### 1.3 Multimodal Content Processing

> **Note**: The international edition currently does not support multimodal file uploads. This section will apply when the feature is enabled.

#### 1.3.1 Image Upload
- Images will be sent to multimodal AI models for analysis
- Images are stored in cloud storage services (Supabase Storage)
- **Images are used solely for AI analysis and your history viewing, not for other commercial purposes**
- Supported formats: PNG, JPEG, GIF, WebP (max 100MB per file)

#### 1.3.2 Video Upload
- Videos will be used for multimodal content understanding
- Videos are stored in cloud storage services
- **Videos are used solely for AI analysis and your history viewing**
- Supported formats: MP4, MPEG (max 100MB per file)

#### 1.3.3 Audio Upload
- Audio files will be used for speech recognition and content understanding
- Audio files are stored in cloud storage services
- **Audio files are used solely for AI analysis and your history viewing**
- Supported formats: MPEG, WAV (max 100MB per file)

**File Upload Limits**:
- Maximum 10 files per upload
- Maximum 100MB per file
- Maximum 500MB total size
- Single media type per upload (images, videos, OR audio - not mixed)

---

## 2. Device Permissions

We may request the following permissions to provide specific features. **All permissions are only triggered when you actively initiate them; we do not access them in the background.**

### 2.1 Microphone Permission
- **Trigger**: Clicking the "Voice Input" or "Pro Voice Chat" button in the input area
- **Purpose**:
  - Voice Input: Convert your speech to text
  - Pro Voice Chat: Real-time voice conversation
- **Processing**: Voice data is processed through the browser's Web Speech API or uploaded to speech recognition services

### 2.2 Camera Permission
- **Trigger**: Clicking the "Camera" button in the input area
- **Purpose**:
  - Photo Mode: Capture photos for AI analysis
  - Video Mode: Record videos for AI analysis
  - Pro Video Chat: Real-time video conversation
- **Processing**: Captured content is sent as attachments to AI for analysis

### 2.3 Location Permission
- **Trigger**: Clicking the "Location" button in the input area
- **Purpose**: Obtain your current location for AI to generate location-based service suggestions
- **Processing**:
  - Location is attached to your message and sent to AI
  - **We do not store your location information long-term**
  - You can clear location information at any time

### 2.4 Storage Permission
- **Purpose**: Save AI-generated images, videos, and audio to your local device
- **Commitment**: We do not read other files on your device

---

## 3. Payment & Privacy

### 3.1 Supported Payment Methods

#### 3.1.1 Stripe
- **Data Collected**: Order ID, payment time, payment amount
- **Data NOT Collected**: We do not obtain your credit card number, CVV, or banking credentials
- **Data Transmission**: Direct communication with Stripe servers via official Stripe SDK
- **Security**: Stripe is PCI DSS Level 1 certified
- **Privacy Policy**: See [Stripe Privacy Policy](https://stripe.com/privacy)

#### 3.1.2 PayPal
- **Data Collected**: Order ID, payment time, payment amount
- **Data NOT Collected**: We do not obtain your PayPal account credentials or linked payment details
- **Data Transmission**: Direct communication with PayPal servers via official PayPal SDK
- **Privacy Policy**: See [PayPal Privacy Policy](https://www.paypal.com/us/legalhub/privacy-full)

### 3.2 Transaction Record Retention
We retain the following transaction information for after-sales service and financial compliance:
- Unique order identifier
- Payment provider order ID
- Payment amount and currency type
- Payment status and completion time
- Purchased product type (subscription/addon pack)

### 3.3 Currency Handling
- International edition prices are in USD
- Automatic currency conversion may be applied by your payment provider
- Exchange rates are determined by the payment provider at the time of transaction

---

## 4. Advertising & Third-Party Services

### 4.1 Advertising Display Rules
- **Ad Positions**: Top, bottom, left, right, sidebar, bottom-left, bottom-right
- **Ad Types**: Image ads, video ads
- **Ad Management**: You can choose whether to display ads in Settings

### 4.2 Ad-Free Benefits for Subscribers
- Basic/Pro/Enterprise subscribers can enable "Hide Ads" in Settings
- When enabled, no advertisements will be displayed in the application

### 4.3 Advertising Data Collection
- Our advertising system is managed by our own servers
- **We do NOT share your personal information with third-party advertisers**
- Ad display is based on position parameters, NOT on your personal profile

### 4.4 Third-Party Analytics
We may use analytics tools to understand how users interact with our service. These tools may collect:
- Device type and operating system
- Browser type and version
- General geographic region
- Usage patterns (pages visited, features used)

**We do NOT sell your data to third parties.**

---

## 5. Content Guidelines & Compliance

### 5.1 AI-Generated Content Disclaimer
> **IMPORTANT**: All AI-generated content (including text, images, code, etc.) is **for reference only** and does not constitute professional medical, legal, financial, or other professional advice. Users bear all responsibility for any consequences arising from the use of AI-generated content.

### 5.2 External Model API Information
- This application integrates multiple third-party AI model APIs (e.g., Mistral AI)
- Data processing by external APIs follows each provider's privacy policy
- **In general conversation mode, external API providers do NOT use your conversations for model training** (please refer to each provider's privacy policy for specifics)

### 5.3 Prohibited Content
Do NOT send to AI or attempt to generate:
- Illegal content under applicable laws
- Pornographic, violent, or graphic content
- Content that infringes on others' legal rights
- Hate speech or discriminatory content
- Other content that violates public order and morals

**Consequences**:
- System will automatically block prohibited keywords
- Multiple violations will result in account suspension
- We reserve the right to report illegal activities to relevant authorities

---

## 6. Chat History Management

### 6.1 Chat History Storage
- **Logged-in Users**: Chat history is saved in cloud database, synced across devices
- **Guest Users**: Chat history is only saved locally in the browser and may be lost when closed

### 6.2 Difference Between Chat History and Expert Model Data

| Comparison | General Chat History | Expert Model Conversations |
|:----------:|:--------------------:|:--------------------------:|
| Storage Purpose | For user to view history | For model optimization |
| Data Usage | Not used for training | May be used for analysis |
| Deletion Rights | Can delete | Contact support required |

### 6.3 Context Message Limits
To ensure service quality, context message limits vary by plan:
- Free: Last 10 messages
- Basic: Last 50 messages
- Pro: Last 100 messages
- Enterprise: Last 200 messages

> Messages beyond the limit are still stored in the database but are not sent to AI as context.

---

## 7. Client Downloads

### 7.1 Supported Platforms
- **Android**: Direct APK download and installation
- **iOS**: Download from App Store
- **Windows**: EXE installer download
- **Mac**: DMG installer download

### 7.2 Download Security
- All download links are provided by official servers
- Installation packages are digitally signed
- Do NOT download from unofficial sources to avoid security risks

### 7.3 Application Permissions (Clients)
Clients on different platforms may request the following permissions:
- **Network Access**: For server communication
- **Storage Permission**: For saving generated files
- **Microphone Permission**: For voice input features
- **Camera Permission**: For photo/video capture
- **Location Permission**: For location information (optional)

---

## 8. Account Deletion

### 8.1 Deletion Entry Point
Settings → Privacy & Security → Danger Zone → Delete Account

### 8.2 Deletion Warning
> **DANGER WARNING**: Account deletion is an **irreversible** operation. Once deleted, the following data will be **permanently erased and CANNOT be recovered**:
> - Basic account information (email, name, avatar)
> - All chat history and conversation records
> - Bookmarks and custom prompts
> - **Remaining subscription time will be forfeited with NO refund**
> - **Remaining addon pack credits will be cleared with NO refund**
> - Personal settings and preferences
> - All uploaded images, videos, and audio files

### 8.3 Deletion Process
1. Navigate to "Privacy & Security" settings
2. Click "Delete Account" button
3. System displays confirmation dialog clearly stating irreversibility
4. Upon confirmation, deletion executes immediately
5. After deletion, you are automatically logged out

---

## 9. Your Rights

### 9.1 Right of Access (GDPR Article 15)
You have the right to access the personal information we have collected about you.

### 9.2 Right to Rectification (GDPR Article 16)
You have the right to correct your personal information (e.g., name, avatar).

### 9.3 Right to Erasure (GDPR Article 17)
You have the right to request deletion of your personal information (see Section 8).

### 9.4 Right to Data Portability (GDPR Article 20)
You can export your personal data in the "Privacy & Security" settings.

### 9.5 Right to Withdraw Consent (GDPR Article 7)
You may withdraw consent for non-essential permissions (e.g., location) at any time.

### 9.6 Right to Object (GDPR Article 21)
You have the right to object to certain data processing activities.

### 9.7 CCPA Rights (California Residents)
If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
- Right to know what personal information is collected
- Right to know whether personal information is sold or disclosed
- Right to opt out of the sale of personal information
- Right to non-discrimination for exercising your rights

**We do NOT sell your personal information.**

---

## 10. International Data Transfers

Your data may be transferred to and processed in countries outside your country of residence. We ensure appropriate safeguards are in place, including:
- Standard Contractual Clauses (SCCs) approved by the European Commission
- Compliance with applicable data protection regulations

---

## 11. Children's Privacy

Our service is NOT directed to children under the age of 13 (or 16 in the EU). If you are a guardian and discover that your child has provided us with personal information, please contact us for deletion.

---

## 12. Data Security

We implement appropriate technical and organizational measures to protect your personal data, including:
- Encryption of data in transit (TLS/SSL)
- Secure password hashing (bcrypt)
- Access controls and authentication
- Regular security assessments

However, no system is completely secure. We cannot guarantee absolute security of your data.

---

## 13. Data Retention

We retain your personal data only for as long as necessary:
- **Account data**: Until you delete your account
- **Chat history**: Until you delete it or delete your account
- **Transaction records**: As required by applicable laws (typically 7 years)
- **Server logs**: Typically 90 days for security and debugging purposes

---

## 14. Privacy Policy Updates

We may update this Privacy Policy from time to time. Updated policies will be posted on this page. Significant changes will be communicated through in-app notifications or email.

---

## 15. Contact Us

If you have any questions or suggestions about this Privacy Policy, please contact us:

- **Email**: mornscience@gmail.com
- **Business Hours**: Monday to Friday, 9:00 AM - 6:00 PM (UTC+8)

For EU residents, you also have the right to lodge a complaint with a supervisory authority.

---

**Copyright © 2025 Yuxuan Zhou. All Rights Reserved.**
`;

export function PrivacyPolicyContent({ isDomestic }: PrivacyPolicyContentProps) {
  const content = isDomestic ? PRIVACY_POLICY_CN : PRIVACY_POLICY_EN;

  return (
    <div className="privacy-policy-content prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b-2 border-gradient-to-r from-blue-500 to-purple-500">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-6 mb-3 flex items-center">
              <span className="w-1 h-5 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full mr-2" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-3 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-3">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-none space-y-2 ml-0 my-3">
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li className="text-gray-600 dark:text-gray-300 text-sm flex items-start">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 mt-1.5 flex-shrink-0" />
              <span>{children}</span>
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20 pl-4 py-2 my-4 rounded-r-lg">
              <div className="text-amber-800 dark:text-amber-200 text-sm">
                {children}
              </div>
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 dark:text-white">
              {children}
            </strong>
          ),
          hr: () => (
            <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default PrivacyPolicyContent;
