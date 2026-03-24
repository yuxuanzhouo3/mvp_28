/**
 * 平台检测工具函数
 * 用于检测移动端、微信环境等
 */

/**
 * 检测是否为移动端设备
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();

  // 检测常见移动端标识
  const mobileKeywords = [
    "android",
    "webos",
    "iphone",
    "ipad",
    "ipod",
    "blackberry",
    "windows phone",
    "mobile",
    "tablet",
  ];

  return mobileKeywords.some((keyword) => userAgent.includes(keyword));
}

/**
 * 检测是否在微信环境中
 */
export function isWeChatBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes("micromessenger");
}

/**
 * 检测是否在微信小程序 WebView 中
 */
export function isWeChatMiniProgram(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // 检测微信小程序环境
  // @ts-ignore - wx 是微信小程序全局对象
  if (typeof wx !== "undefined" && wx.miniProgram) {
    return true;
  }

  // 通过 userAgent 检测
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes("miniprogram");
}

/**
 * 检测是否支持 MediaRecorder API（用于录音/录像）
 */
export function isMediaRecorderSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return typeof MediaRecorder !== "undefined";
}

/**
 * 检测是否支持 getUserMedia API（用于摄像头/麦克风）
 */
export function isGetUserMediaSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * 检测是否在安全上下文中（HTTPS 或 localhost）
 */
export function isSecureContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // 使用原生 isSecureContext 属性
  if (typeof window.isSecureContext === "boolean") {
    return window.isSecureContext;
  }

  // 回退检测
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;

  return (
    protocol === "https:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * 获取完整的平台信息
 */
export function getPlatformInfo() {
  return {
    isMobile: isMobileDevice(),
    isWeChat: isWeChatBrowser(),
    isMiniProgram: isWeChatMiniProgram(),
    isSecure: isSecureContext(),
    supportsMediaRecorder: isMediaRecorderSupported(),
    supportsGetUserMedia: isGetUserMediaSupported(),
    // 综合判断是否支持媒体录制功能
    supportsMediaCapture: isSecureContext() && isMediaRecorderSupported() && isGetUserMediaSupported(),
  };
}

/**
 * 检测媒体功能可用性并返回不可用原因
 */
export function checkMediaCapability(): { supported: boolean; reason?: string } {
  if (typeof window === "undefined") {
    return { supported: false, reason: "非浏览器环境" };
  }

  if (!isSecureContext()) {
    return { supported: false, reason: "需要 HTTPS 安全连接" };
  }

  if (!isGetUserMediaSupported()) {
    return { supported: false, reason: "浏览器不支持摄像头/麦克风访问" };
  }

  if (!isMediaRecorderSupported()) {
    return { supported: false, reason: "浏览器不支持媒体录制" };
  }

  // 微信小程序 WebView 可能有限制
  if (isWeChatMiniProgram()) {
    return { supported: true, reason: "微信小程序环境，部分功能可能受限" };
  }

  return { supported: true };
}
