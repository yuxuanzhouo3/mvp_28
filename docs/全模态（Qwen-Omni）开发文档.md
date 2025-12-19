## 全模态（Qwen-Omni）

Qwen-Omni 模型能够接收文本与单一其他模态（图片、音频、视频）的组合输入，并生成文本或语音形式的回复， 提供多种拟人音色，支持多语言和方言的语音输出，可应用于文本创作、视觉识别、语音助手等场景。

## **快速开始**

**前提条件**

- 已[配置 API Key](https://help.aliyun.com/zh/model-studio/get-api-key)并[配置API Key到环境变量](https://help.aliyun.com/zh/model-studio/configure-api-key-through-environment-variables)。
- Qwen-Omni 模型仅支持 OpenAI 兼容方式调用，需要[安装最新版SDK](https://help.aliyun.com/zh/model-studio/install-sdk)。OpenAI Python SDK 最低版本为 1.52.0， Node.js SDK 最低版本为 4.68.0。

**调用方式**：Qwen-Omni 目前仅支持以流式输出的方式进行调用，`stream`参数必须设置为`True`，否则会报错。

以下示例将一段文本发送至 Qwen-Omni的API接口，并流式返回文本和音频的回复。

```nodejs
// 运行前的准备工作:
// Windows/Mac/Linux 通用:
// 1. 确保已安装 Node.js (建议版本 >= 14)
// 2. 运行以下命令安装必要的依赖:
//    npm install openai wav

import OpenAI from "openai";
import { createWriteStream } from 'node:fs';
import { Writer } from 'wav';

// 定义音频转换函数：将Base64字符串转换并保存为标准的 WAV 音频文件
async function convertAudio(audioString, audioPath) {
    try {
        // 解码Base64字符串为Buffer
        const wavBuffer = Buffer.from(audioString, 'base64');
        // 创建WAV文件写入流
        const writer = new Writer({
            sampleRate: 24000,  // 采样率
            channels: 1,        // 单声道
            bitDepth: 16        // 16位深度
        });
        // 创建输出文件流并建立管道连接
        const outputStream = createWriteStream(audioPath);
        writer.pipe(outputStream);

        // 写入PCM数据并结束写入
        writer.write(wavBuffer);
        writer.end();

        // 使用Promise等待文件写入完成
        await new Promise((resolve, reject) => {
            outputStream.on('finish', resolve);
            outputStream.on('error', reject);
        });

        // 添加额外等待时间确保音频完整
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log(`\n音频文件已成功保存为 ${audioPath}`);
    } catch (error) {
        console.error('处理过程中发生错误:', error);
    }
}

//  1. 初始化客户端
const openai = new OpenAI(
    {
        // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
        apiKey: process.env.DASHSCOPE_API_KEY,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
);
// 2. 发起请求
const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",  
    messages: [
        {
            "role": "user",
            "content": "你是谁？"
        }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});

let audioString = "";
console.log("大模型的回复：")

// 3. 处理流式响应并解码音频
for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        // 处理文本内容
        if (chunk.choices[0].delta.content) {
            process.stdout.write(chunk.choices[0].delta.content);
        }
        // 处理音频内容
        if (chunk.choices[0].delta.audio) {
            if (chunk.choices[0].delta.audio["data"]) {
                audioString += chunk.choices[0].delta.audio["data"];
            }
        }
    }
}
// 4. 保存音频文件
convertAudio(audioString, "audio_assistant.wav");
```

**返回结果**

运行`Python`和`Node.js`代码后，将在控制台看到模型的文本回复，并在代码文件目录下找到一个名为`audio_assistant.wav` 的音频文件。

```json
大模型的回复：
我是阿里云研发的大规模语言模型，我叫通义千问。有什么我可以帮助你的吗？
```

运行`HTTP`代码将直接返回文本和`Base64`编码（`audio`字段）的音频数据。

```json
data: {"choices":[{"delta":{"content":"我"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,"created":1757647879,"system_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-a68eca3b-c67e-4666-a72f-73c0b4919860"}
data: {"choices":[{"delta":{"content":"是"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,"created":1757647879,"system_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-a68eca3b-c67e-4666-a72f-73c0b4919860"}
......
data: {"choices":[{"delta":{"audio":{"data":"/v8AAAAAAAAAAAAAAA...","expires_at":1757647879,"id":"audio_a68eca3b-c67e-4666-a72f-73c0b4919860"}},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,"created":1757647879,"system_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-a68eca3b-c67e-4666-a72f-73c0b4919860"}
data: {"choices":[{"finish_reason":"stop","delta":{"content":""},"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,"created":1764763585,"system_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-e8c82e9e-073e-4289-a786-a20eb444ac9c"}
data: {"choices":[],"object":"chat.completion.chunk","usage":{"prompt_tokens":207,"completion_tokens":103,"total_tokens":310,"completion_tokens_details":{"audio_tokens":83,"text_tokens":20},"prompt_tokens_details":{"text_tokens":207}},"created":1757940330,"system_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-9cdd5a26-f9e9-4eff-9dcc-93a878165afc"}
```

## **模型列表**

相比于 [Qwen-VL](https://help.aliyun.com/zh/model-studio/vision) 与 [Qwen-Audio](https://help.aliyun.com/zh/model-studio/audio-language-model) 模型，Qwen-Omni 模型可以：

- 理解视频文件中的视觉与音频信息；
- 理解多种模态的数据；
- 输出音频；

在视觉理解、音频理解等能力上也表现出色。

建议优先使用Qwen3-Omni-Flash**，**相较于Qwen-Omni-Turbo（后续不再更新），模型的能力得到大幅提升：

- **支持思考模式和非思考模式，**可通过 `enable_thinking` 参数实现两种模式的切换，默认不开启思考模式。
- 在非思考模式下，对于模型输出的音频：
  - qwen3-omni-flash-2025-12-01支持的音色增加至49种，qwen3-omni-flash-2025-09-15、qwen3-omni-flash支持的音色种类增加至 17 种，Qwen-Omni-Turbo 仅支持 4 种；
  - 支持语言种类增加至 10 种，Qwen-Omni-Turbo 仅支持 2 种。

## **使用方式**

**输入**

- **支持的输入模态**：
  - [文本输入](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#957a002581dve)
  - [图片+文本输入](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#cfe42b3edcrve)
  - [音频+文本输入](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#b4d9c9c405qwg)
  - [视频（包括图像列表与视频文件形式）+文本输入](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#4a1a20f083dji)

> 在单条 `user` 消息中，`content` 数组可以包含文本和**一种**其他模态（图片、音频或视频），不能同时包含多种。

- **输入多模态数据的方式：**
  - 公网 URL
  - Base64 编码，具体用法请参见[输入 Base64 编码的本地文件](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#c516d1e824x03)

**输出**

- **支持的输出模态：**其中输出的音频为`Base64`编码数据，可参见[解析输出的Base64 编码的音频数据](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#423736d367a7x)将其换为音频文件。

  | **输出模态** | `**modalities**`**参数值**                                   | **回复风格**                                                 |
  | ------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
  | 文本         | ["text"]（默认值）                                           | 比较书面化，回复内容较为正式。                               |
  | 文本+音频    | ["text","audio"]Qwen3-Omni-Flash在思考模式下，不支持输出音频。 | 比较口语化，回复内容包含语气词，会引导用户与其进一步交流。Qwen-Omni-Turbo 在输出模态包括音频时**不支持设定 System Message。** |
  
- **支持输出的音频语言：**

  - Qwen-Omni-Turbo**：**仅支持汉语（普通话）和英语。
  - Qwen3-Omni-Flash（非思考模式）：支持汉语（普通话，部分方言），英语，法语、德语、俄语、意语、西语、葡语、日语、韩语。

- **支持的音色：**输出音频的音色与文件格式通过`audio`参数来配置，如：`audio={"voice": "Cherry", "format": "wav"}`：

  - 文件格式（`format`）：只支持设定为`"wav"`；
  - 音频音色（`voice）`：各模型支持的音色可参见[音色列表](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#61a6a8b444e6b)。

**限制**

- **必须使用流式输出**：所有对 Qwen-Omni 模型的请求都必须设置 `stream=True`。
- **仅 Qwen3-Omni-Flash** 模型属于混合思考模型，调用方法请参见[开启/关闭思考模式](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#c02e7bf0f9ysx)，在思考模式下，**不支持输出音频。**

## **开启/关闭思考模式**

Qwen3-Omni-Flash 模型属于混合思考模型，通过`enable_thinking`参数控制是否开启思考模式：

- `true`：开启思考模式
- `false`（默认）：关闭思考模式

> `Qwen-Omni-Turbo`不属于思考模型。

OpenAI 兼容

```nodejs
import OpenAI from "openai";

const openai = new OpenAI({
     // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey:"sk-xxx",
    // 新加坡和北京地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
    apiKey: process.env.DASHSCOPE_API_KEY, 
    // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",
    messages: [
        { role: "user", content: "你是谁？" }
    ],
    // stream 必须设置为 True，否则会报错
    stream: true,
    stream_options: {
        include_usage: true
    },
    // 开启/关闭思考模式，在思考模式下不支持输出音频；qwen-omni-turbo不支持设置enable_thinking。
    extra_body:{'enable_thinking': true},
    //  设置输出数据的模态，非思考模式下当前支持两种：["text","audio"]、["text"]，思考模式仅支持：["text"]
    modalities: ["text"],
    // 设置音色，思考模式下不支持设置audio参数
    //audio: { voice: "Cherry", format: "wav" }
});

for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```

**返回结果**

```json
data: {"choices":[{"delta":{"content":null,"role":"assistant","reasoning_content":""},"index":0,"logprobs":null,"finish_reason":null}],"object":"chat.completion.chunk","usage":null,"created":1757937336,"system_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-ce3d6fe5-e717-4b7e-8b40-3aef12288d4c"}
data: {"choices":[{"finish_reason":null,"logprobs":null,"delta":{"content":null,"reasoning_content":"嗯"},"index":0}],"object":"chat.completion.chunk","usage":null,"reated":1757937336,"system_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-ce3d6fe5-e717-4b7e-8b40-3aef12288d4c"}
data: {"choices":[{"delta":{"content":null,"reasoning_content":"，"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,"reated":1757937336,"system_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-ce3d6fe5-e717-4b7e-8b40-3aef12288d4c"}
......
data: {"choices":[{"delta":{"content":"告诉我"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,"created":1757937336,"tem_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-ce3d6fe5-e717-4b7e-8b40-3aef12288d4c"}
data: {"choices":[{"delta":{"content":"！"},"finish_reason":null,"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,"created":1757937336,"systm_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-ce3d6fe5-e717-4b7e-8b40-3aef12288d4c"}
data: {"choices":[{"finish_reason":"stop","delta":{"content":"","reasoning_content":null},"index":0,"logprobs":null}],"object":"chat.completion.chunk","usage":null,"created":1757937336,"system_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-ce3d6fe5-e717-4b7e-8b40-3aef12288d4c"}
data: {"choices":[],"object":"chat.completion.chunk","usage":{"prompt_tokens":11,"completion_tokens":363,"total_tokens":374,"completion_tokens_details":{"reasoning_tokens":195,"text_tokens":168},"prompt_tokens_details":{"text_tokens":11}},"created":1757937336,"system_fingerprint":null,"model":"qwen3-omni-flash","id":"chatcmpl-ce3d6fe5-e717-4b7e-8b40-3aef12288d4c"}
```

## **图片+文本输入**

Qwen-Omni 模型支持传入多张图片。对输入图片的要求如下：

- 单个图片文件的大小不超过10 MB;
- 图片数量受模型图文总 Token 上限（即最大输入）的限制，所有图片的总 Token 数必须小于模型的最大输入;
- 图片的宽度和高度均应大于10像素，宽高比不应超过200:1或1:200；
- 支持的图片类型请参见[视觉理解](https://help.aliyun.com/zh/model-studio/vision#afa499b5b1rl5)。

以下示例代码以传入图片公网 URL 为例，传入本地图片请参见：[输入 Base64 编码的本地文件](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#c516d1e824x03)。当前只支持以流式输出的方式进行调用。

OpenAI 兼容

```nodejs
import OpenAI from "openai";

const openai = new OpenAI(
    {
        // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
        // 新加坡和北京地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
        apiKey: process.env.DASHSCOPE_API_KEY,
        // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
);
const completion = await openai.chat.completions.create({
    // 模型为Qwen3-Omni-Flash时，请在非思考模式下运行
    model: "qwen3-omni-flash", 
    messages: [
        {
            "role": "user",
            "content": [{
                "type": "image_url",
                "image_url": { "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241022/emyrja/dog_and_girl.jpeg" },
            },
            { "type": "text", "text": "图中描绘的是什么景象？" }]
        }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});

for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```

**音频+文本输入**

- 仅支持输入一个音频文件；
- 文件大小
  - Qwen3-Omni-Flash：不能超过 100MB，时长最长 20 分钟。
  - Qwen-Omni-Turbo：不能超过 10MB，时长最长 3 分钟。

以下示例代码以传入音频公网 URL 为例，传入本地音频请参见：[输入 Base64 编码的本地文件](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#c516d1e824x03)。当前只支持以流式输出的方式进行调用。

OpenAI 兼容

```nodejs
import OpenAI from "openai";

// 初始化 openai 客户端
const openai = new OpenAI({
     // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey:"sk-xxx",
    // 新加坡和北京地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
    apiKey: process.env.DASHSCOPE_API_KEY, 
    // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",  // 模型为Qwen3-Omni-Flash时，请在非思考模式下运行
    messages: [
        {
            "role": "user",
            "content": [{
                "type": "input_audio",
                "input_audio": { "data": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250211/tixcef/cherry.wav", "format": "wav" },
            },
            { "type": "text", "text": "这段音频在说什么" }]
        }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});

for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```

**视频+文本输入**

视频的传入方式可以为[图片列表形式](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#0f4360d63a8nk)或[视频文件形式（可理解视频中的音频）](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#5ed48035d09so)。

以下示例代码以传入视频公网 URL 为例，传入本地视频请参见：[输入 Base64 编码的本地文件](https://help.aliyun.com/zh/model-studio/qwen-omni?spm=a2c4g.11186623.help-menu-2400256.d_0_2_5.4ec668fbClB7bH&scm=20140722.H_2867839._.OR_help-T_cn~zh-V_1#c516d1e824x03)。当前只支持以流式输出的方式进行调用。

#### **图片列表形式**

**图片数量**

- Qwen3-Omni-Flash：最少传入 2 张图片，最多可传入 128 张图片。
- Qwen-Omni-Turbo：最少传入 4 张图片，最多可传入 80 张图片。

OpenAI 兼容

```nodejs
import OpenAI from "openai";

const openai = new OpenAI({
     // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
    // 新加坡和北京地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
    apiKey: process.env.DASHSCOPE_API_KEY, 
    // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});


const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",  // 模型为Qwen3-Omni-Flash时，请在非思考模式下运行
    messages: [{
        role: "user",
        content: [
            {
                type: "video",
                video: [
                    "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241108/xzsgiz/football1.jpg",
                    "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241108/tdescd/football2.jpg",
                    "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241108/zefdja/football3.jpg",
                    "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241108/aedbqh/football4.jpg"
                ]
            },
            {
                type: "text",
                text: "描述这个视频的具体过程"
            }
        ]
    }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});

for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```

**视频文件形式（可理解视频中的音频）**

- 仅支持输入一个视频文件；
- 文件大小：
  - Qwen3-Omni-Flash：限制为 256 MB，时长限制为 150s；
  - Qwen-Omni-Turbo：限制为 150 MB，时长限制为 40s；
- 视频文件中的视觉信息与音频信息会分开计费。

OpenAI 兼容

```nodejs
import OpenAI from "openai";

const openai = new OpenAI({
     // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
    // 新加坡和北京地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
    apiKey: process.env.DASHSCOPE_API_KEY, 
    // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",  // 模型为Qwen3-Omni-Flash时，请在非思考模式下运行
    messages: [
        {
            "role": "user",
            "content": [{
                "type": "video_url",
                "video_url": { "url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241115/cqqkru/1.mp4" },
            },
            { "type": "text", "text": "视频的内容是什么?" }]
        }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});


for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```

**多轮对话**

您在使用 Qwen-Omni 模型的多轮对话功能时，需要注意：

- Assistant Message

  添加到 messages 数组中的 Assistant Message 只可以包含文本数据。

- User Message

  一条 User Message 只可以包含文本和一种模态的数据，在多轮对话中您可以在不同的 User Message 中输入不同模态的数据。

OpenAI 兼容

```nodejs
import OpenAI from "openai";

const openai = new OpenAI({
     // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
    // 新加坡和北京地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
    apiKey: process.env.DASHSCOPE_API_KEY, 
    // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",  // 模型为Qwen3-Omni-Flash时，请在非思考模式下运行
    messages: [
        {
            "role": "user",
            "content": [
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": "https://dashscope.oss-cn-beijing.aliyuncs.com/audios/welcome.mp3",
                        "format": "mp3",
                    },
                },
                { "type": "text", "text": "这段音频在说什么" },
            ],
        },
        {
            "role": "assistant",
            "content": [{ "type": "text", "text": "这段音频在说：欢迎使用阿里云" }],
        },
        {
            "role": "user",
            "content": [{ "type": "text", "text": "介绍一下这家公司？" }]
        }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text"]
});


for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```

**解析输出的Base64 编码的音频数据**

Qwen-Omni 模型输出的音频为流式输出的 Base64 编码数据。您可以在模型生成过程中维护一个字符串变量，将每个返回片段的 Base64 编码添加到字符串变量后，待生成结束后进行 Base64 解码，得到音频文件；也可以将每个返回片段的 Base64 编码数据实时解码并播放。

```nodejs
// 运行前的准备工作:
// Windows/Mac/Linux 通用:
// 1. 确保已安装 Node.js (建议版本 >= 14)
// 2. 运行以下命令安装必要的依赖:
//    npm install openai wav
// 
// 如果要使用实时播放功能 (方式2), 还需要:
// Windows:
//    npm install speaker
// Mac:
//    brew install portaudio
//    npm install speaker
// Linux (Ubuntu/Debian):
//    sudo apt-get install libasound2-dev
//    npm install speaker

import OpenAI from "openai";

const openai = new OpenAI({
     // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey:"sk-xxx",
    // 新加坡和北京地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
    apiKey: process.env.DASHSCOPE_API_KEY, 
    // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",  //模型为Qwen3-Omni-Flash时，请在非思考模式下运行
    messages: [
        {
            "role": "user",
            "content": "你是谁？"
        }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});

// 方式1: 待生成结束后再进行解码
// 需要安装: npm install wav
import { createWriteStream } from 'node:fs';  // node:fs 是 Node.js 内置模块，无需安装
import { Writer } from 'wav';

async function convertAudio(audioString, audioPath) {
    try {
        // 解码Base64字符串为Buffer
        const wavBuffer = Buffer.from(audioString, 'base64');
        // 创建WAV文件写入流
        const writer = new Writer({
            sampleRate: 24000,  // 采样率
            channels: 1,        // 单声道
            bitDepth: 16        // 16位深度
        });
        // 创建输出文件流并建立管道连接
        const outputStream = createWriteStream(audioPath);
        writer.pipe(outputStream);

        // 写入PCM数据并结束写入
        writer.write(wavBuffer);
        writer.end();

        // 使用Promise等待文件写入完成
        await new Promise((resolve, reject) => {
            outputStream.on('finish', resolve);
            outputStream.on('error', reject);
        });

        // 添加额外等待时间确保音频完整
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log(`音频文件已成功保存为 ${audioPath}`);
    } catch (error) {
        console.error('处理过程中发生错误:', error);
    }
}

let audioString = "";
for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        if (chunk.choices[0].delta.audio) {
            if (chunk.choices[0].delta.audio["data"]) {
                audioString += chunk.choices[0].delta.audio["data"];
            }
        }
    } else {
        console.log(chunk.usage);
    }
}
// 执行转换
convertAudio(audioString, "audio_assistant_mjs.wav");


// 方式2: 边生成边实时播放
// 需要先按照上方系统对应的说明安装必要组件
// import Speaker from 'speaker'; // 引入音频播放库

// // 创建扬声器实例（配置与 WAV 文件参数一致）
// const speaker = new Speaker({
//     sampleRate: 24000,  // 采样率
//     channels: 1,        // 声道数
//     bitDepth: 16,       // 位深
//     signed: true        // 有符号 PCM
// });
// for await (const chunk of completion) {
//     if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
//         if (chunk.choices[0].delta.audio) {
//             if (chunk.choices[0].delta.audio["data"]) {
//                 const pcmBuffer = Buffer.from(chunk.choices[0].delta.audio.data, 'base64');
//                 // 直接写入扬声器播放
//                 speaker.write(pcmBuffer);
//             }
//         }
//     } else {
//         console.log(chunk.usage);
//     }
// }
// speaker.on('finish', () => console.log('播放完成'));
// speaker.end(); // 根据实际 API 流结束情况调用
```

## **输入 Base64 编码的本地文件**

### 图片

以保存在本地的[eagle.png](https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250326/nlgymo/eagle.png)为例。

```nodejs
import OpenAI from "openai";
import { readFileSync } from 'fs';

const openai = new OpenAI({
     // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
    // 新加坡和北京地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
    apiKey: process.env.DASHSCOPE_API_KEY, 
    // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

const encodeImage = (imagePath) => {
    const imageFile = readFileSync(imagePath);
    return imageFile.toString('base64');
};
const base64Image = encodeImage("eagle.png")

const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",  // 模型为Qwen3-Omni-Flash时，请在非思考模式下运行
    messages: [
        {
            "role": "user",
            "content": [{
                "type": "image_url",
                "image_url": { "url": `data:image/png;base64,${base64Image}` },
            },
            { "type": "text", "text": "图中描绘的是什么景象？" }]
        }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});

for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```

### 音频

以保存在本地的[welcome.mp3](https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250214/pijhos/welcome.mp3)为例。

```nodejs
import OpenAI from "openai";
import { readFileSync } from 'fs';

const openai = new OpenAI({
     // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
    // 新加坡和北京地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
    apiKey: process.env.DASHSCOPE_API_KEY, 
    // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

const encodeAudio = (audioPath) => {
    const audioFile = readFileSync(audioPath);
    return audioFile.toString('base64');
};
const base64Audio = encodeAudio("welcome.mp3")

const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",  // 模型为Qwen3-Omni-Flash时，请在非思考模式下运行
    messages: [
        {
            "role": "user",
            "content": [{
                "type": "input_audio",
                "input_audio": { "data": `data:;base64,${base64Audio}`, "format": "mp3" },
            },
            { "type": "text", "text": "这段音频在说什么" }]
        }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});

for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```

### 视频

#### 视频文件

以保存在本地的[spring_mountain.mp4](https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250326/fqojlv/spring_mountain.mp4)为例。

```nodejs
import OpenAI from "openai";
import { readFileSync } from 'fs';

const openai = new OpenAI(
    {
        // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
        apiKey: process.env.DASHSCOPE_API_KEY,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
);

const encodeVideo = (videoPath) => {
    const videoFile = readFileSync(videoPath);
    return videoFile.toString('base64');
};
const base64Video = encodeVideo("spring_mountain.mp4")

const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",  // 模型为Qwen3-Omni-Flash时，请在非思考模式下运行
    messages: [
        {
            "role": "user",
            "content": [{
                "type": "video_url",
                "video_url": { "url": `data:;base64,${base64Video}` },
            },
            { "type": "text", "text": "她在唱什么" }]
        }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});

for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```

#### 图片列表

以保存在本地的[football1.jpg](https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250319/vzfwkh/football1.jpg)、[football2.jpg](https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250319/vgkgqy/football2.jpg)、[football3.jpg](https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250127/fytnla/football3.jpg)与[football4.jpg](https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250127/ygitwp/football4.jpg)为例。

```nodejs
import OpenAI from "openai";
import { readFileSync } from 'fs';

const openai = new OpenAI({
     // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
    // 新加坡和北京地域的API Key不同。获取API Key：https://help.aliyun.com/zh/model-studio/get-api-key
    apiKey: process.env.DASHSCOPE_API_KEY, 
    // 以下是北京地域base_url，如果使用新加坡地域的模型，需要将base_url替换为：https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

const encodeImage = (imagePath) => {
    const imageFile = readFileSync(imagePath);
    return imageFile.toString('base64');
  };
const base64Image1 = encodeImage("football1.jpg")
const base64Image2 = encodeImage("football2.jpg")
const base64Image3 = encodeImage("football3.jpg")
const base64Image4 = encodeImage("football4.jpg")

const completion = await openai.chat.completions.create({
    model: "qwen3-omni-flash",  // 模型为Qwen3-Omni-Flash时，请在非思考模式下运行
    messages: [{
        role: "user",
        content: [
            {
                type: "video",
                video: [
                    `data:image/jpeg;base64,${base64Image1}`,
                    `data:image/jpeg;base64,${base64Image2}`,
                    `data:image/jpeg;base64,${base64Image3}`,
                    `data:image/jpeg;base64,${base64Image4}`
                ]
            },
            {
                type: "text",
                text: "描述这个视频的具体过程"
            }
        ]
    }],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});

for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```

**限流**

模型限流规则及常见问题，请参见[限流](https://help.aliyun.com/zh/model-studio/rate-limit)。

## **常见问题**

### **Q：如何给 Qwen-Omni-Turbo 模型设置角色？**

A：Qwen-Omni-Turbo模型在输出模态包括音频时**不支持设定 System Message，**即使您在 System Message 中说明：“你是XXX...”等角色信息，Qwen-Omni 的自我认知依然会是通义千问。

- **方法1（推荐）：**Qwen3-Omni-Flash模型已支持设定**System Message，**建议切换至该系列模型。

- **方法2：**在messages 数组的开头手动添加用于角色设定的 User Message 和 Assistant Message，达到给 Qwen-Omni 模型设置角色的效果。

**用于角色设定的示例代码**

```nodejs
import OpenAI from "openai";

const openai = new OpenAI(
    {
        // 若没有配置环境变量，请用阿里云百炼API Key将下行替换为：apiKey: "sk-xxx",
        apiKey: process.env.DASHSCOPE_API_KEY,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
);
const completion = await openai.chat.completions.create({
    model: "qwen-omni-turbo",
    messages: [
        { role: "user", content: "你是一个商场的导购员，你负责的商品有手机、电脑、冰箱" },
        { role: "assistant", content: "好的，我记住了你的设定。" },
        { role: "user", content: "你是谁？" }
    ],
    stream: true,
    stream_options: {
        include_usage: true
    },
    modalities: ["text", "audio"],
    audio: { voice: "Cherry", format: "wav" }
});

for await (const chunk of completion) {
    if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
        console.log(chunk.choices[0].delta);
    } else {
        console.log(chunk.usage);
    }
}
```