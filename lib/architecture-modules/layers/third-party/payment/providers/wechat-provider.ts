// lib/architecture-modules/layers/third-party/payment/providers/wechat-provider.ts
// 微信支付 API v3 完整实现 (支持NATIVE支付)

import crypto from "crypto";
import axios, { AxiosInstance } from "axios";

interface WechatV3Config {
  appId: string; // 公众号/小程序 AppID
  mchId: string;
  apiV3Key: string; // 32字节 API v3 密钥
  privateKey: string; // 商户私钥 (PKCS#8 格式)
  serialNo: string; // 商户证书序列号
  notifyUrl: string; // 支付成功回调地址
}

interface CreateNativeOrderParams {
  out_trade_no: string; // 商户订单号
  amount: number; // 金额（分）
  description: string; // 商品描述
  attach?: string; // 附加数据（原样返回）
}

interface PaymentStatus {
  tradeState: string; // SUCCESS | NOTPAY | CLOSED | REFUND | REVOKED | USERPAYING | PAYERROR
  transactionId?: string; // 微信支付订单号
  amount?: number;
  successTime?: string;
}

export class WechatProviderV3 {
  private config: WechatV3Config;
  private apiBaseUrl = "https://api.mch.weixin.qq.com";
  private axiosInstance: AxiosInstance;

  constructor(config: WechatV3Config) {
    this.config = this.validateConfig(config);
    this.axiosInstance = this.initAxios();
  }

  /**
   * 验证配置
   */
  private validateConfig(config: WechatV3Config): WechatV3Config {
    const required = ["appId", "mchId", "apiV3Key", "privateKey", "serialNo", "notifyUrl"];
    for (const key of required) {
      if (!config[key as keyof WechatV3Config]) {
        throw new Error(`Missing required config: ${key}`);
      }
    }

    // 验证 API v3 密钥长度
    if (config.apiV3Key.length !== 32) {
      throw new Error("API v3 key must be 32 bytes");
    }

    // 处理私钥：支持转义换行符 \n 和 Base64 编码
    let privateKey = config.privateKey.replace(/\\n/g, "\n");

    const keyLength = privateKey.length;
    console.log("[WeChat] 私钥初始长度:", keyLength);

    if (keyLength < 100) {
      // 如果私钥太短，可能是被截断了或是 Base64 编码的
      console.log("[WeChat] 检测到可能被截断的私钥，长度:", keyLength);

      // 尝试从 Base64 解码
      try {
        const decoded = Buffer.from(privateKey, "base64").toString("utf-8");
        if (decoded.includes("BEGIN") && decoded.includes("PRIVATE")) {
          console.log("[WeChat] 成功从 Base64 解码私钥");
          privateKey = decoded;
        }
      } catch (e) {
        console.warn("[WeChat] Base64 解码失败，继续使用原始私钥");
      }
    }

    // 更新配置中的私钥
    config.privateKey = privateKey;

    // 最终验证
    if (config.privateKey.length < 100) {
      console.error("[WeChat] ⚠️  警告：私钥长度异常短！");
    } else if (
      !config.privateKey.includes("BEGIN PRIVATE KEY") &&
      !config.privateKey.includes("BEGIN RSA PRIVATE KEY")
    ) {
      console.error("[WeChat] ⚠️  警告：私钥不包含 PEM 格式头！");
    } else {
      console.log("[WeChat] ✅ 私钥配置正常，长度:", config.privateKey.length);
    }

    return config;
  }

  /**
   * 初始化 axios 实例
   */
  private initAxios(): AxiosInstance {
    return axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  /**
   * NATIVE 支付下单
   * 返回 code_url 用于生成二维码
   */
  async createNativePayment(
    params: CreateNativeOrderParams
  ): Promise<{ codeUrl: string }> {
    try {
      const requestBody: any = {
        appid: this.config.appId,
        mchid: this.config.mchId,
        description: params.description,
        out_trade_no: params.out_trade_no,
        notify_url: this.config.notifyUrl,
        amount: {
          total: params.amount,
          currency: "CNY",
        },
      };

      // 如果有附加数据，添加到请求中
      if (params.attach) {
        requestBody.attach = params.attach;
      }

      console.log(
        "[WeChat] NATIVE 支付请求体:",
        JSON.stringify(requestBody, null, 2)
      );

      const response = await this.requestWithSignature(
        "POST",
        "/v3/pay/transactions/native",
        requestBody
      );

      if (!response.code_url) {
        throw new Error("No code_url in WeChat response");
      }

      return {
        codeUrl: response.code_url,
      };
    } catch (error) {
      console.error("WeChat createNativePayment error:", error);
      throw error;
    }
  }

  /**
   * 查询订单状态（通过商户订单号）
   */
  async queryOrderByOutTradeNo(outTradeNo: string): Promise<PaymentStatus> {
    try {
      const path = `/v3/pay/transactions/out-trade-no/${outTradeNo}`;
      const queryParams = { mchid: this.config.mchId };

      const response = await this.requestWithSignature(
        "GET",
        path,
        null,
        queryParams
      );

      return {
        tradeState: response.trade_state || "UNKNOWN",
        transactionId: response.transaction_id,
        amount: response.amount?.total,
        successTime: response.success_time,
      };
    } catch (error) {
      console.error("WeChat queryOrderByOutTradeNo error:", error);
      throw error;
    }
  }

  /**
   * 验证 Webhook 签名
   */
  verifyWebhookSignature(
    body: string,
    signature: string,
    timestamp: string,
    nonce: string
  ): boolean {
    try {
      // 构建验签串：timestamp\nnonce\nbody\n
      const message = `${timestamp}\n${nonce}\n${body}\n`;

      // 使用 API v3 密钥计算签名
      const expectedSignature = crypto
        .createHmac("sha256", this.config.apiV3Key)
        .update(message)
        .digest("base64");

      const isValid = expectedSignature === signature;

      if (!isValid) {
        console.error("WeChat webhook signature verification failed");
        console.error("Expected:", expectedSignature);
        console.error("Received:", signature);
      }

      return isValid;
    } catch (error) {
      console.error("WeChat signature verification error:", error);
      return false;
    }
  }

  /**
   * 解密 Webhook 回调数据
   * 使用 AES-256-GCM 解密
   */
  decryptWebhookData(
    ciphertext: string,
    nonce: string,
    associatedData: string
  ): any {
    try {
      // API v3 密钥就是解密密钥
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(this.config.apiV3Key, "utf-8"),
        Buffer.from(nonce, "utf-8")
      );

      // 设置附加认证数据
      decipher.setAAD(Buffer.from(associatedData, "utf-8"));

      // 解密
      let decrypted = decipher.update(ciphertext, "base64", "utf8");
      decrypted += decipher.final("utf8");

      return JSON.parse(decrypted);
    } catch (error) {
      console.error("WeChat webhook decryption error:", error);
      throw new Error("Failed to decrypt webhook data");
    }
  }

  /**
   * 处理完整的 Webhook 通知
   */
  async handleWebhookNotification(webhookBody: any): Promise<any> {
    try {
      const { resource } = webhookBody;

      if (!resource) {
        throw new Error("Missing resource in webhook");
      }

      // 解密资源数据
      const decryptedData = this.decryptWebhookData(
        resource.ciphertext,
        resource.nonce,
        resource.associated_data
      );

      return decryptedData;
    } catch (error) {
      console.error("WeChat webhook handling error:", error);
      throw error;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 带签名的 API 请求
   */
  private async requestWithSignature(
    method: string,
    path: string,
    body: any = null,
    queryParams: Record<string, any> = {}
  ): Promise<any> {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = this.generateNonce();

      // 构建完整 URL
      let url = path;
      if (Object.keys(queryParams).length > 0) {
        const queryString = Object.entries(queryParams)
          .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
          .join("&");
        url = `${path}?${queryString}`;
      }

      // 构建签名
      const bodyStr = body ? JSON.stringify(body) : "";
      const signature = this.buildSignature(
        method,
        url,
        timestamp,
        nonce,
        bodyStr
      );

      // 发送请求
      const config: any = {
        method,
        url: `${this.apiBaseUrl}${url}`,
        headers: {
          Authorization: signature,
          "Wechat-Pay-Timestamp": timestamp,
          "Wechat-Pay-Nonce": nonce,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      };

      if (body && method.toUpperCase() !== "GET") {
        config.data = body;
      }

      const response = await this.axiosInstance(config);

      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        console.error("WeChat API error:", error.response.data);
        throw new Error(
          `WeChat API error: ${error.response.data.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 构建 API 请求签名
   */
  private buildSignature(
    method: string,
    path: string,
    timestamp: string,
    nonce: string,
    body: string
  ): string {
    try {
      // 构建签名消息（微信 API v3 要求的格式）
      const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;

      // 格式化私钥
      const privateKey = this.formatPrivateKey(this.config.privateKey);

      // 使用商户私钥签名
      const sign = crypto
        .createSign("RSA-SHA256")
        .update(message)
        .sign(privateKey, "base64");

      // 返回 Authorization 头的值
      return `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonce}",signature="${sign}",timestamp="${timestamp}",serial_no="${this.config.serialNo}"`;
    } catch (error) {
      console.error("WeChat signature building error:", error);
      throw new Error("Failed to build signature");
    }
  }

  /**
   * 格式化私钥
   */
  private formatPrivateKey(key: string): string {
    // 去除所有空白符和换行符
    let cleanKey = key.trim().replace(/\s/g, "");

    // 检测格式
    const isPKCS1 = key.includes("BEGIN RSA PRIVATE KEY");
    const isPKCS8 = key.includes("BEGIN PRIVATE KEY");

    if (!isPKCS1 && !isPKCS8) {
      // 如果没有 PEM 格式头，假设是纯 Base64 内容
      cleanKey = key.trim().replace(/\s/g, "");
    } else {
      // 已有 PEM 格式头，提取内容
      const match = key.match(
        /-----BEGIN[^-]*-----\s*([\s\S]*?)\s*-----END[^-]*-----/
      );
      if (match && match[1]) {
        cleanKey = match[1].replace(/\s/g, "");
      }
    }

    // 重新格式化为标准 PEM 格式（每行 64 字符）
    const header = isPKCS1 ? "BEGIN RSA PRIVATE KEY" : "BEGIN PRIVATE KEY";
    const footer = isPKCS1 ? "END RSA PRIVATE KEY" : "END PRIVATE KEY";

    let formattedKey = `-----${header}-----\n`;
    for (let i = 0; i < cleanKey.length; i += 64) {
      formattedKey += cleanKey.slice(i, i + 64) + "\n";
    }
    formattedKey += `-----${footer}-----`;

    return formattedKey;
  }

  /**
   * 生成随机 nonce 字符串
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString("hex");
  }
}

