/**
 * 邮件发送频率限制工具
 * 防止用户频繁请求发送验证邮件
 */

const EMAIL_COOLDOWN_KEY = "morngpt_email_cooldown";
const COOLDOWN_SECONDS = 60; // 60秒冷却时间

interface CooldownData {
  email: string;
  timestamp: number;
}

/**
 * 检查是否可以发送邮件（是否已过冷却期）
 * @param email 邮箱地址
 * @returns { canSend: boolean, remainingSeconds: number }
 */
export function checkEmailCooldown(email: string): {
  canSend: boolean;
  remainingSeconds: number;
} {
  try {
    const stored = localStorage.getItem(EMAIL_COOLDOWN_KEY);
    if (!stored) {
      return { canSend: true, remainingSeconds: 0 };
    }

    const data: CooldownData = JSON.parse(stored);

    // 如果是不同的邮箱，允许发送
    if (data.email !== email.toLowerCase()) {
      return { canSend: true, remainingSeconds: 0 };
    }

    const elapsed = Math.floor((Date.now() - data.timestamp) / 1000);
    const remaining = COOLDOWN_SECONDS - elapsed;

    if (remaining <= 0) {
      return { canSend: true, remainingSeconds: 0 };
    }

    return { canSend: false, remainingSeconds: remaining };
  } catch {
    // 如果解析失败，允许发送
    return { canSend: true, remainingSeconds: 0 };
  }
}

/**
 * 记录邮件发送时间（设置冷却期）
 * @param email 邮箱地址
 */
export function setEmailCooldown(email: string): void {
  const data: CooldownData = {
    email: email.toLowerCase(),
    timestamp: Date.now(),
  };
  localStorage.setItem(EMAIL_COOLDOWN_KEY, JSON.stringify(data));
}

/**
 * 获取冷却时间的友好显示文本
 * @param seconds 剩余秒数
 * @param isZh 是否中文
 */
export function getCooldownMessage(seconds: number, isZh: boolean): string {
  if (isZh) {
    return `请等待 ${seconds} 秒后再发送验证邮件`;
  }
  return `Please wait ${seconds} seconds before requesting another verification email`;
}
