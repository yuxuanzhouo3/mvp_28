/**
 * 带认证的 fetch 包装函数
 * 自动从 localStorage 读取自定义 JWT token 并添加到请求头
 */

export async function fetchWithAuth(
  url: string | URL | Request,
  options?: RequestInit
): Promise<Response> {
  const headers: HeadersInit = {
    ...(options?.headers || {}),
  };

  // 尝试从 localStorage 获取自定义 JWT token（Android Native Google Sign-In）
  if (typeof window !== "undefined") {
    try {
      const authState = localStorage.getItem("app-auth-state");
      if (authState) {
        const parsed = JSON.parse(authState);
        if (parsed.accessToken) {
          headers["Authorization"] = `Bearer ${parsed.accessToken}`;
        }
      }
    } catch (e) {
      // localStorage 读取失败，继续使用 cookie
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
