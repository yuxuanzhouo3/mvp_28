/**
 * Android WebView 调试助手
 * 用于诊断 Android 环境下的 localStorage 和认证问题
 */

export function isAndroidWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).GoogleSignIn;
}

export function testLocalStorageAccess(): {
  canRead: boolean;
  canWrite: boolean;
  hasAuthState: boolean;
  authStateValid: boolean;
  error?: string;
} {
  const result = {
    canRead: false,
    canWrite: false,
    hasAuthState: false,
    authStateValid: false,
    error: undefined as string | undefined,
  };

  try {
    // 测试读取
    const testKey = '__android_test__';
    const testValue = 'test_' + Date.now();

    // 测试写入
    localStorage.setItem(testKey, testValue);
    result.canWrite = true;

    // 测试读取
    const readValue = localStorage.getItem(testKey);
    result.canRead = readValue === testValue;

    // 清理测试数据
    localStorage.removeItem(testKey);

    // 检查认证状态
    const authState = localStorage.getItem('app-auth-state');
    result.hasAuthState = !!authState;

    if (authState) {
      try {
        const parsed = JSON.parse(authState);
        result.authStateValid = !!(parsed.accessToken && parsed.user?.id);
      } catch (e) {
        result.error = 'Auth state parse error: ' + e;
      }
    }
  } catch (error) {
    result.error = 'localStorage access error: ' + error;
  }

  return result;
}

export function logAndroidDebugInfo(): void {
  if (!isAndroidWebView()) {
    console.log('❌ Not running in Android WebView');
    return;
  }

  console.log('🔵 ===== Android WebView Debug Info =====');
  console.log('🔵 User Agent:', navigator.userAgent);
  console.log('🔵 Platform:', navigator.platform);

  const storageTest = testLocalStorageAccess();
  console.log('🔵 localStorage Test:', storageTest);

  // 检查 GoogleSignIn Bridge
  const hasGoogleSignIn = !!(window as any).GoogleSignIn;
  console.log('🔵 GoogleSignIn Bridge:', hasGoogleSignIn);

  if (hasGoogleSignIn) {
    try {
      const currentUser = (window as any).GoogleSignIn.getCurrentUser();
      console.log('🔵 Current Google User:', currentUser);
    } catch (e) {
      console.log('❌ Failed to get current Google user:', e);
    }
  }

  console.log('🔵 =====================================');
}

/**
 * 在 Android 环境下显示 Alert 调试信息
 */
export function alertAndroidDebugInfo(): void {
  if (!isAndroidWebView()) return;

  const storageTest = testLocalStorageAccess();
  const debugInfo = [
    '=== Android Debug Info ===',
    `localStorage 可读: ${storageTest.canRead}`,
    `localStorage 可写: ${storageTest.canWrite}`,
    `有认证状态: ${storageTest.hasAuthState}`,
    `认证状态有效: ${storageTest.authStateValid}`,
    storageTest.error ? `错误: ${storageTest.error}` : '',
  ].filter(Boolean).join('\n');

  alert(debugInfo);
}
