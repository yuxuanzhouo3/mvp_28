"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Lock, Eye, Home } from "lucide-react";

interface Message {
  role: string;
  content: string;
}

interface ShareData {
  title: string;
  messages: Message[];
  createdAt: string;
  accessCount: number;
}

export default function SharePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shareId = params.shareId as string;
  const urlSecret = searchParams.get('secret');

  const [data, setData] = useState<ShareData | null>(null);
  const [secret, setSecret] = useState(urlSecret || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSecret, setNeedsSecret] = useState(false);

  const loadShare = async (secretKey?: string) => {
    setLoading(true);
    setError('');

    try {
      const url = new URL(`/api/share/${shareId}`, window.location.origin);
      if (secretKey) {
        url.searchParams.set('secret', secretKey);
      }

      const response = await fetch(url.toString());
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setNeedsSecret(true);
          setError('需要密钥才能访问此分享');
        } else if (response.status === 404) {
          setError('分享不存在');
        } else if (response.status === 410) {
          setError('分享已过期');
        } else {
          setError(result.error || '加载失败');
        }
        return;
      }

      setData(result.data);
      setNeedsSecret(false);
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShare(urlSecret || undefined);
  }, [shareId, urlSecret]);

  const handleSecretSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadShare(secret);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (needsSecret && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center mb-4">
            <Lock className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-gray-100">需要密钥</h1>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            此分享受密钥保护，请输入密钥以查看内容
          </p>
          <form onSubmit={handleSecretSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="输入密钥"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="text-center font-mono text-lg"
            />
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              访问分享
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-4">{error}</p>
          <Button onClick={() => window.location.href = '/'} className="bg-blue-600 hover:bg-blue-700">
            <Home className="w-4 h-4 mr-2" />
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <MessageSquare className="w-6 h-6 text-blue-500" />
              {data.title}
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Eye className="w-4 h-4" />
              <span>{data.accessCount} 次访问</span>
            </div>
          </div>

          <div className="space-y-4">
            {data.messages.map((message, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="font-semibold mb-2 text-sm text-gray-700 dark:text-gray-300">
                  {message.role === 'user' ? '👤 用户' : '🤖 AI 助手'}
                </div>
                <div className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            由 MornGPT 提供支持
          </p>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <Home className="w-3 h-3 mr-1" />
            访问 MornGPT
          </Button>
        </div>
      </div>
    </div>
  );
}
