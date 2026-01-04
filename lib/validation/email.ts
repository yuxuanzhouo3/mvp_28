/**
 * 邮箱校验工具函数
 * 支持国内版和国际版的邮箱格式校验
 */

// 标准邮箱正则表达式
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * 校验邮箱格式
 * @param email 邮箱地址
 * @param isZhText 是否使用中文提示
 */
export function validateEmail(email: string, isZhText: boolean): EmailValidationResult {
  const trimmedEmail = email.trim();

  // 空值检查
  if (!trimmedEmail) {
    return {
      isValid: false,
      error: isZhText ? "请输入邮箱地址" : "Please enter an email address",
    };
  }

  // 长度检查
  if (trimmedEmail.length > 254) {
    return {
      isValid: false,
      error: isZhText ? "邮箱地址过长" : "Email address is too long",
    };
  }

  // 格式检查
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return {
      isValid: false,
      error: isZhText ? "请输入有效的邮箱地址" : "Please enter a valid email address",
    };
  }

  return { isValid: true };
}
