/**
 * API Service
 * Handles communication with the MornGPT backend
 */

// Mobile-friendly API base URL detection
const getApiBaseUrl = () => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side rendering - use default
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  }
  
  // Check if we're in a mobile environment
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // For mobile, we need to use the actual backend URL
    // Check if we're accessing via localhost or IP address
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    console.log('Mobile device detected:', {
      hostname,
      port,
      userAgent: navigator.userAgent,
      isMobile
    });
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Local development - use localhost:5000
      const apiUrl = 'http://localhost:5000';
      console.log('Using localhost API URL:', apiUrl);
      return apiUrl;
    } else {
      // Production or remote access - use the same hostname with port 5000
      const apiUrl = `http://${hostname}:5000`;
      console.log('Using remote API URL:', apiUrl);
      return apiUrl;
    }
  }
  
  // Desktop environment - use relative URL since we have API proxy
  const apiUrl = '';
  console.log('Desktop environment, using relative API URL (proxy)');
  return apiUrl;
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
      console.log('API request URL:', url);
      console.log('API request options:', options);
      console.log('API request body:', options.body);
      
      const finalHeaders = {
        ...options.headers,
        'Content-Type': 'application/json',
      };
      console.log('Final headers being sent:', finalHeaders);
      
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
    return this.request<Model[]>('/api/models');
  }

  // Get models by tier
  async getModelsByTier(tier: string): Promise<ApiResponse<Model[]>> {
    return this.request<Model[]>(`/api/models/tier/${tier}`);
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
    const endpoint = token ? '/api/chat/send' : '/api/chat/send-guest';
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
    onChunk?: (chunk: string) => void,
    onEnd?: () => void,
    onError?: (error: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      // Use guest endpoint for local testing
      const endpoint = token ? '/api/chat/stream' : '/api/chat/stream-guest';
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

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          modelId,
          message,
          chatId,
          language,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
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
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', data);
            }
          }
        }
      }

      onEnd?.();
    } catch (error) {
      console.error('Streaming error:', error);
      onError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Get chat sessions
  async getChatSessions(token: string): Promise<ApiResponse<ChatSession[]>> {
    return this.request<ChatSession[]>('/api/chat/sessions', {
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
      `/api/chat/sessions/${chatId}/messages`,
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
    return this.request<ChatSession>('/api/chat/sessions', {
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
    return this.request<{ user: any; token: string }>('/api/auth/register', {
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
    return this.request<{ user: any; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    });
  }

  // Get usage statistics
  async getUsageStats(token: string): Promise<ApiResponse<any>> {
    return this.request<any>('/api/chat/usage', {
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