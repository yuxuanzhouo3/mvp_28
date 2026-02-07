'use client';

export default function TestPage() {
  const handleTestNotification = () => {
    // 检查是否在Android WebView环境中
    if (typeof window !== 'undefined' && (window as any).AndroidNotification) {
      try {
        (window as any).AndroidNotification.sendTestNotification();
        alert('通知已发送！请查看手机通知栏');
      } catch (error) {
        console.error('发送通知失败:', error);
        alert('发送通知失败，请检查控制台');
      }
    } else {
      alert('此功能仅在Android应用中可用');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <button
        className="rounded-lg bg-blue-600 px-8 py-4 text-lg font-medium text-white active:bg-blue-700 touch-manipulation"
        onClick={handleTestNotification}
      >
        测试
      </button>
    </div>
  );
}
