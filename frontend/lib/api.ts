/**
 * API Service
 * Handles communication with the MornGPT backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
    token?: string
  ): Promise<ApiResponse<{ response: string; chatId: string; usage?: any }>> {
    // Use guest endpoint for local testing
    const endpoint = token ? '/api/chat/send' : '/api/chat/send-guest';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
        }),
      }
    );
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