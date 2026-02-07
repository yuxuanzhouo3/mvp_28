'use client';

import { useState, useEffect } from 'react';

export default function TestPage() {
  const [fcmToken, setFcmToken] = useState<string>('');

  useEffect(() => {
    // 设置FCM Token回调函数
    (window as any).onFCMTokenReceived = (token: string) => {
      setFcmToken(token);
    };

    (window as any).onFCMTokenError = (error: string) => {
      alert(error);
    };

    return () => {
      delete (window as any).onFCMTokenReceived;
      delete (window as any).onFCMTokenError;
    };
  }, []);

  const handleTestNotification = () => {
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

  const handleDelayedNotification = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidNotification) {
      try {
        (window as any).AndroidNotification.scheduleDelayedNotification();
        alert('定时通知已设置！请关闭应用，5秒后将收到通知');
      } catch (error) {
        console.error('设置定时通知失败:', error);
        alert('设置定时通知失败，请检查控制台');
      }
    } else {
      alert('此功能仅在Android应用中可用');
    }
  };

  const handleGetFCMToken = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidNotification) {
      try {
        (window as any).AndroidNotification.getFCMToken();
      } catch (error) {
        console.error('获取FCM Token失败:', error);
        alert('获取FCM Token失败，请检查控制台');
      }
    } else {
      alert('此功能仅在Android应用中可用');
    }
  };

  const copyToClipboard = () => {
    if (fcmToken) {
      navigator.clipboard.writeText(fcmToken).then(() => {
        alert('Token已复制到剪贴板！');
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex flex-col gap-4 w-full max-w-md">
        <button
          className="rounded-lg bg-blue-600 px-8 py-4 text-lg font-medium text-white active:bg-blue-700 touch-manipulation"
          onClick={handleTestNotification}
        >
          测试即时通知
        </button>
        <button
          className="rounded-lg bg-green-600 px-8 py-4 text-lg font-medium text-white active:bg-green-700 touch-manipulation"
          onClick={handleDelayedNotification}
        >
          测试定时通知(5秒)
        </button>
        <button
          className="rounded-lg bg-purple-600 px-8 py-4 text-lg font-medium text-white active:bg-purple-700 touch-manipulation"
          onClick={handleGetFCMToken}
        >
          获取FCM Token
        </button>

        {fcmToken && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-700">FCM Token:</h3>
              <button
                onClick={copyToClipboard}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                复制
              </button>
            </div>
            <p className="text-xs text-gray-600 break-all font-mono">
              {fcmToken}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
