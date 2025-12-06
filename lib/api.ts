/**
 * API Service
 * Handles communication with the MornGPT backend
 */

import { getCurrentModelConfig } from '@/config';

// Get API base URL based on current version configuration
const getApiBaseUrl = () => {
  // Get current model configuration based on environment variable
  const modelConfig = getCurrentModelConfig();
  return modelConfig.apiBaseUrl;
};

const API_BASE_URL = getApiBaseUrl();

export interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  temperature: number;
  maxTokens: number;
  category: string;
  providerId: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  modelId: string;
  category: string;
  messageCount: number;
  createdAt: string;
  lastUpdated: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const finalHeaders = {
        ...options.headers,
        'Content-Type': 'application/json',
      };

      const response = await fetch(url, {
        headers: finalHeaders,
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get available models
  async getModels(): Promise<ApiResponse<Model[]>> {
    return this.request<Model[]>('/models');
  }

  // Get models by tier
  async getModelsByTier(tier: string): Promise<ApiResponse<Model[]>> {
    return this.request<Model[]>(`/models/tier/${tier}`);
  }

  // Send chat message
  async sendMessage(
    message: string,
    modelId: string,
    chatId?: string,
    token?: string,
    language?: string
  ): Promise<ApiResponse<{ response: string; chatId: string; usage?: any }>> {
    // Use guest endpoint for local testing
    const endpoint = token ? '/chat/send' : '/chat/send-guest';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add language header for Chinese support
    if (language === 'zh') {
      headers['Accept-Language'] = 'zh-CN,zh;q=0.9';
    }

    return this.request<{ response: string; chatId: string; usage?: any }>(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          // Send both for backward compatibility; server prefers \"model\"
          model: modelId,
          modelId,
          message,
          chatId,
          language,
        }),
      }
    );
  }

  // Send streaming chat message
  async sendMessageStream(
    message: string,
    modelId: string,
    chatId?: string,
    token?: string,
    language?: string,
    messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    onChunk?: (chunk: string) => void,
    onEnd?: () => void,
    onError?: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    let alreadyNotified = false;
    try {
      // Use guest endpoint for local testing
      const endpoint = token ? '/chat/stream' : '/chat/stream-guest';
      const url = `${this.baseUrl}${endpoint}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Add language header for Chinese support
      if (language === 'zh') {
        headers['Accept-Language'] = 'zh-CN,zh;q=0.9';
      }

      const bodyPayload = JSON.stringify({
        // Send both for backward compatibility; server prefers "model"
        model: modelId,
        modelId,
        message,
        messages,
        chatId,
        language,
      });

      const doRequest = async (attempt: number): Promise<void> => {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: bodyPayload,
          signal,
        });

        if (!response.ok) {
          // Try to surface a meaningful backend message first
          let serverMessage = "";
          let errorCode = "";
          try {
            const errJson = await response.json();
            serverMessage =
              errJson?.message ||
              errJson?.error ||
              errJson?.detail ||
              `HTTP ${response.status}`;
            errorCode = errJson?.code || errJson?.error || "";
          } catch {
            // fallback to plain text
            try {
              serverMessage = await response.text();
            } catch {
              serverMessage = `HTTP ${response.status}`;
            }
          }

          // Auto-retry once on 429 to smooth transient limits
          if (response.status === 429 && attempt === 1 && !(signal?.aborted)) {
            await new Promise((r) => setTimeout(r, 1500));
            return doRequest(2);
          }

          // Provide friendlier, status-aware messages for UI
          const isZh = language === "zh";
          const isCapacity =
            /capacity/i.test(serverMessage) ||
            /3505/.test(errorCode) ||
            /service_tier_capacity_exceeded/i.test(errorCode);
          const friendly =
            response.status === 401 || response.status === 403
              ? isZh
                ? "登录已失效，请重新登录。"
                : "Session expired — please sign in again."
              : response.status === 429
              ? isZh
                ? "请求过快，请稍后再试。"
                : "Too many requests — please slow down and retry."
              : isCapacity
              ? isZh
                ? "该模型当前容量已满，请稍后再试或更换模型。"
                : "This model is at capacity; please retry later or switch models."
              : response.status >= 500
              ? isZh
                ? "服务器暂不可用，请稍后重试。"
                : "Server is unavailable, please retry shortly."
              : serverMessage;

          onError?.(friendly);
          alreadyNotified = true;
          return; // stop streaming gracefully without throwing
        }

        const reader = response.body?.getReader();
        if (!reader) {
          const msg = "No response body reader available";
          onError?.(msg);
          throw new Error(msg);
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const decoded = decoder.decode(value, { stream: true });
          buffer += decoded;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                onEnd?.();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.chunk) {
                  onChunk?.(parsed.chunk);
                  await new Promise(resolve => setTimeout(resolve, 0));
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 1));
        }

        onEnd?.();
      };

      await doRequest(1);
    } catch (error) {
      console.error('Streaming error:', error);
      if (!alreadyNotified) {
        onError?.(error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  // Get chat sessions
  async getChatSessions(token: string): Promise<ApiResponse<ChatSession[]>> {
    return this.request<ChatSession[]>('/chat/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  // Get chat messages
  async getChatMessages(
    chatId: string,
    token: string
  ): Promise<ApiResponse<ChatMessage[]>> {
    return this.request<ChatMessage[]>(
      `/chat/sessions/${chatId}/messages`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  }

  // Create new chat session
  async createChat(
    title: string,
    modelId: string,
    token: string
  ): Promise<ApiResponse<ChatSession>> {
    return this.request<ChatSession>('/chat/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        modelId,
      }),
    });
  }

  // User registration
  async register(
    email: string,
    password: string,
    name: string
  ): Promise<ApiResponse<{ user: any; token: string }>> {
    return this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        name,
      }),
    });
  }

  // User login
  async login(
    email: string,
    password: string
  ): Promise<ApiResponse<{ user: any; token: string }>> {
    return this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    });
  }

  // Get usage statistics
  async getUsageStats(token: string): Promise<ApiResponse<any>> {
    return this.request<any>('/chat/usage', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<any>> {
    return this.request<any>('/health');
  }
}

export const apiService = new ApiService(); 
