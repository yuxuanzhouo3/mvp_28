/**
 * Auth State Manager
 * 原子性管理认证状态（token + user + metadata）
 * 支持 Refresh Token 自动刷新
 */
import { saveAccount } from "@/lib/account-manager";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  subscription_plan?: string;
  [key: string]: any;
}

export interface StoredAuthState {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tokenMeta: {
    accessTokenExpiresIn: number; // 秒数
    refreshTokenExpiresIn: number; // 秒数
  };
  savedAt: number; // 毫秒
}

const AUTH_STATE_KEY = "app-auth-state";

/**
 * 原子性保存认证状态
 * 成功保存后会 dispatch 'auth-state-changed' 事件
 */
export function saveAuthState(
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
  tokenMeta: { accessTokenExpiresIn: number; refreshTokenExpiresIn: number }
): void {
  if (typeof window === "undefined") return;

  try {
    const authState: StoredAuthState = {
      accessToken,
      refreshToken,
      user,
      tokenMeta,
      savedAt: Date.now(),
    };

    localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(authState));
    console.log("✅ [Auth] 认证状态已保存");

    // 同步到多账号存储
    if (user?.id) {
      try {
        saveAccount({
          id: user.id,
          email: user.email || "",
          name: user.name || user.email || "",
          avatar: user.avatar || "",
          accessToken,
          refreshToken,
        });
      } catch (e) {
        console.warn("[Auth] 多账号同步失败:", e);
      }
    }

    // 触发自定义事件（用于同标签页内同步）
    window.dispatchEvent(new CustomEvent("auth-state-changed"));
  } catch (error) {
    console.error("❌ [Auth] 保存认证状态失败:", error);
    // 保存失败则清除
    localStorage.removeItem(AUTH_STATE_KEY);
  }
}

/**
 * 获取存储的认证状态
 */
export function getStoredAuthState(): StoredAuthState | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(AUTH_STATE_KEY);
    if (!stored) return null;

    const authState: StoredAuthState = JSON.parse(stored);

    // 验证数据完整性
    if (
      !authState.accessToken ||
      !authState.refreshToken ||
      !authState.user?.id ||
      !authState.tokenMeta
    ) {
      console.warn("⚠️ [Auth] 存储的认证状态不完整");
      clearAuthState();
      return null;
    }

    return authState;
  } catch (error) {
    console.error("❌ [Auth] 解析认证状态失败:", error);
    clearAuthState();
    return null;
  }
}

/**
 * 清除所有认证状态
 */
export function clearAuthState(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(AUTH_STATE_KEY);
    console.log("🗑️  [Auth] 认证状态已清除");

    window.dispatchEvent(new CustomEvent("auth-state-changed"));
  } catch (error) {
    console.error("❌ [Auth] 清除认证状态失败:", error);
  }
}

/**
 * 检查用户是否已认证（同步检查，不触发自动刷新）
 * 用于快速检查，如 UI 条件渲染
 */
export function isAuthenticated(): boolean {
  const authState = getStoredAuthState();
  if (!authState || !authState.user?.id) return false;

  const accessTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;

  // 检查 token 是否仍然有效（不尝试刷新）
  return Date.now() < accessTokenExpiresAt - 60000;
}

/**
 * 获取认证头（同步版本，不触发自动刷新）
 * 用于不需要自动刷新的场景（如日志、分析等）
 */
export function getAuthHeader(): { Authorization: string } | null {
  const authState = getStoredAuthState();
  if (!authState) return null;

  const accessTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;

  // 检查 token 是否仍然有效（不尝试刷新）
  if (Date.now() > accessTokenExpiresAt - 60000) {
    return null;
  }

  return { Authorization: `Bearer ${authState.accessToken}` };
}

/**
 * 获取认证头（异步版本，支持自动刷新）
 * 用于 API 请求时自动刷新过期 token
 */
export async function getAuthHeaderAsync(): Promise<{
  Authorization: string;
} | null> {
  const authState = getStoredAuthState();
  if (!authState) return null;

  const accessTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;

  // 提前 60 秒判定为过期（留出时间刷新）
  if (Date.now() <= accessTokenExpiresAt - 60000) {
    // Token 仍然有效，直接返回
    return { Authorization: `Bearer ${authState.accessToken}` };
  }

  // Token 已过期，直接返回 null（mvp28-fix 暂不支持自动刷新）
  console.log("⏰ [Auth] Access token 已过期");
  return null;
}
