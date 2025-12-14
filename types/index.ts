// Speech Recognition types
export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any)
    | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

export interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string;
  isMultiGPT?: boolean;
  isStreaming?: boolean;
  subTasks?: Array<{
    task: string;
    model: string;
    response: string;
  }>;
  images?: string[];
  videos?: string[];
  imagePreviews?: string[];
  videoPreviews?: string[];
  audios?: string[];
  audioPreviews?: string[];
}

// Generic attachment item used by the chat input & upload pipeline
export interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: "image" | "video" | "audio" | "file";
  file?: File;
  preview?: string;
  fileId?: string; // CloudBase fileID after upload
  format?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  modelType: string;
  category: string;
  lastUpdated: Date;
  isModelLocked: boolean;
}

// 钱包结构（国内版配额统一入口）
export interface UserWallet {
  // 月度配额（随订阅或免费额度重置）
  monthly_image_balance: number;
  monthly_video_balance: number;
  monthly_reset_at?: string;
  // 加油包配额（永久有效）
  addon_image_balance: number;
  addon_video_balance: number;
  // 外部模型每日用量（按天重置）
  daily_external_used?: number;
  daily_external_day?: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  bio?: string;
  isPro: boolean;
  isPaid: boolean;
  plan?: "Basic" | "Pro" | "Enterprise";
  planExp?: string;
  avatar?: string;
  wallet?: UserWallet;
  pendingDowngrade?: {
    targetPlan: "Basic" | "Pro" | "Enterprise";
    effectiveAt?: string;
  } | null;
  settings?: {
    theme: "light" | "dark" | "auto";
    language: string;
    notifications: boolean;
    soundEnabled: boolean;
    autoSave: boolean;
    sendHotkey?: "enter" | "shift+enter" | "ctrl+enter" | "cmd+enter";
    shortcutsEnabled?: boolean;
    adsEnabled?: boolean;
  };
}

export interface BookmarkedMessage {
  id: string;
  messageId: string;
  chatId: string;
  title: string;
  content: string;
  timestamp: Date;
  customName?: string;
  folder?: string;
}

export interface BookmarkFolder {
  id: string;
  name: string;
  color?: string;
  createdAt: Date;
}

export interface ExternalModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  category: string;
  modality?: "multimodal" | "text";
  type: "free" | "premium" | "popular" | "paid";
  price: string;
}

export interface UserSettings {
  theme: "light" | "dark" | "auto";
  language: string;
  notifications: boolean;
  soundEnabled: boolean;
  autoSave: boolean;
  sendHotkey?: "enter" | "shift+enter" | "ctrl+enter" | "cmd+enter";
  shortcutsEnabled?: boolean;
  adsEnabled?: boolean;
}
