/**
 * Cookie Helper for JWT Token Management
 * 用于在客户端和服务端设置/读取 JWT token
 */

/**
 * 设置 cookie（客户端）
 */
export function setCookie(name: string, value: string, days: number = 7): void {
  if (typeof window === 'undefined') return;

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax; Secure`;
}

/**
 * 获取 cookie（客户端）
 */
export function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;

  const nameEQ = name + '=';
  const ca = document.cookie.split(';');

  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }

  return null;
}

/**
 * 删除 cookie（客户端）
 * 注意：必须使用与设置时相同的属性（SameSite, Secure）才能正确删除
 */
export function deleteCookie(name: string): void {
  if (typeof window === 'undefined') return;

  // 使用与 setCookie 相同的属性来确保能正确删除
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax; Secure`;

  // 同时尝试不带 Secure 属性的删除（兼容 HTTP 环境）
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;

  console.log(`🔵 [deleteCookie] 已删除 cookie: ${name}`);
}

/**
 * 从 Next.js cookies() 中读取 cookie（服务端）
 */
export function getCookieFromHeaders(cookieStore: any, name: string): string | null {
  try {
    const cookie = cookieStore.get(name);
    return cookie?.value || null;
  } catch {
    return null;
  }
}
